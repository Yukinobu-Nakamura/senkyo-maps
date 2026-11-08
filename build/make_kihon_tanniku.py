#!/usr/bin/env python3
"""国勢調査2020 基本単位区境界(e-Stat) → 街区(○番)単位の枠表示用 GeoJSON(gzip) 生成.

用途: 🔍地名検索で「池袋三丁目62番」のように番地まで入力したとき、その街区だけを枠で囲む。
      (小地域=町丁目境界には街区が無い。街区の「面」を公開している国のデータは基本単位区のみ)

入力: e-Stat 統計GIS 境界データ「令和2年国勢調査 基本単位区(JGD2011)」市区町村単位 zip(shp)
  https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=B002005212020&code=<5桁>&coordSys=1&format=shape&downloadType=5&datum=2011
  定義書: https://www.e-stat.go.jp/help/data-definition-information/downloaddata/B002005212020.pdf
  ※小地域の A002005212020 と違い **都道府県一括(code=2桁)は提供されない**(404)。市区町村ごとに取る。
  ※e-Stat 側で都度生成されるらしく 1件 1〜40秒かかる。礼儀として直列・間隔を空けて取得する。

出力: <outdir>/kb_<code>.geojson.gz  (座標6桁・属性最小・gzip)
  properties: n=町丁目名(S_NAME) / b=街区符号2桁(KIHON3先頭2桁) / s=世帯数 / j=人口 / u=統合した調査区数
  + <outdir>/kb_index.json  {version, updated, codes:[...]}

■ ポリゴンの単位は「調査区」。街区にまとめる必要がある(実測: 豊島区 4,231調査区 / 3,085街区)
  KIHON3(3桁) = 基本単位区の番号(2桁) + 分割番号(1桁)。世帯の多い街区は複数の調査区に分割される
  (「011/012/013」= 1番を3分割。help_kigo_a.pdf の KIGO_A=同一共同住宅の複数調査区も同じ街区)。
  → **KIHON1+KIHON2+KIHON3[:2] をキーに unary_union で統合**する。
■ 境界は道路中心線で引かれる(町丁の面積合計が小地域の面積と一致=道路込みで隙間なし)。
  Google マップの街区(道路縁)より道路半幅ぶん外側に膨らむ。加工はしない(形が崩れる街区が出るため)。
■ 住居表示未実施(地番)地域では基本単位区は「街区に準じた区画」で「○番地」と対応しない。
  クライアント側は候補名が「○番」(「番地」でない)のときだけ街区モードにする。
■ HCODE 8154(水面調査区)は除外。KIGO_E の重複境界(E1,E2…)は基本単位区では無い前提だが、同キーに
  複数ポリゴンがあれば統合で吸収される。JINKO/SETAI は分割調査区ごとに値を持つので合計する。

使い方:
  python3 build/make_kihon_tanniku.py --codes 13116 13101            # 指定コード
  python3 build/make_kihon_tanniku.py --pref 13                       # 都道府県(setai_index.json 収録分)
  python3 build/make_kihon_tanniku.py --all                           # 収録 970 市区コード全部(数時間)
  共通: --outdir ~/projects/senkyo-maps-data/kb --cache ~/work_kb --skip-existing
  依存: ~/.venvs/geo (shapely, pyshp)。`~/.venvs/geo/bin/python build/make_kihon_tanniku.py ...`
"""
import argparse, gzip, io, json, os, sys, time, zipfile, urllib.request, datetime
from collections import defaultdict

try:
    import shapefile  # pyshp
    from shapely.geometry import shape, mapping
    from shapely.ops import unary_union
    from shapely.validation import make_valid
except ImportError:
    sys.exit("shapely / pyshp が要ります: ~/.venvs/geo/bin/python で実行してください")

ESTAT = ("https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=B002005212020"
         "&code={code}&coordSys=1&format=shape&downloadType=5&datum=2011")
UA = "Mozilla/5.0 (senkyo-maps build; contact via GitHub Yukinobu-Nakamura/senkyo-maps)"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def fetch_zip(code, cache_dir, retries=3):
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, f"B{code}.zip")
    if os.path.exists(path) and zipfile.is_zipfile(path):
        return path
    url = ESTAT.format(code=code)
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
            if data[:2] == b"PK":
                with open(path, "wb") as f:
                    f.write(data)
                return path
            # zip でなければ HTML(該当なし)。空レスポンスも同じ扱い
            return None
        except Exception as e:  # noqa
            wait = 10 * (i + 1)
            print(f"  ! {code} 取得失敗({e}) {wait}s 後に再試行", file=sys.stderr)
            time.sleep(wait)
    return None


def read_records(zip_path):
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        base = next((n[:-4] for n in names if n.lower().endswith(".shp")), None)
        if not base:
            raise RuntimeError("shp が無い")
        parts = {ext: io.BytesIO(z.read(base + ext)) for ext in (".shp", ".shx", ".dbf") if base + ext in names}
    rd = shapefile.Reader(shp=parts[".shp"], shx=parts.get(".shx"), dbf=parts[".dbf"], encoding="cp932")
    fields = [f[0] for f in rd.fields[1:]]
    for sr in rd.iterShapeRecords():
        rec = dict(zip(fields, sr.record))
        yield rec, sr.shape


def round_coords(obj, nd=6):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], float):
            return [round(obj[0], nd), round(obj[1], nd)]
        return [round_coords(o, nd) for o in obj]
    return obj


def convert(code, zip_path):
    groups = defaultdict(list)       # key -> [(geom, setai, jinko)]
    meta = {}
    n_rec = n_water = 0
    for rec, shp in read_records(zip_path):
        n_rec += 1
        if str(rec.get("HCODE", "")).strip() == "8154":
            n_water += 1
            continue
        pref_city = f"{str(rec['PREF']).zfill(2)}{str(rec['CITY']).zfill(3)}"
        if pref_city != code:
            continue  # 念のため(市区町村単位 zip なら一致するはず)
        k1 = str(rec.get("KIHON1", "")).strip().zfill(4)
        k2 = str(rec.get("KIHON2", "")).strip().zfill(2)
        k3 = str(rec.get("KIHON3", "")).strip().zfill(3)
        key = k1 + k2 + k3[:2]
        g = shape(shp.__geo_interface__)
        if not g.is_valid:
            g = make_valid(g)
        groups[key].append((g, int(rec.get("SETAI") or 0), int(rec.get("JINKO") or 0)))
        if key not in meta:
            meta[key] = {"n": str(rec.get("S_NAME", "")).strip(), "b": k3[:2]}
    feats = []
    n_multi = n_empty = 0
    for key, items in groups.items():
        geoms = [g for g, _, _ in items]
        u = unary_union(geoms) if len(geoms) > 1 else geoms[0]
        # 面(Polygon/MultiPolygon)だけ残す(make_valid で線・点が混ざることがある)
        if u.geom_type == "GeometryCollection":
            polys = [g for g in u.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
            u = unary_union(polys) if polys else None
        if u is None or u.is_empty:
            n_empty += 1
            continue
        if len(items) > 1:
            n_multi += 1
        gj = mapping(u)
        gj = {"type": gj["type"], "coordinates": round_coords(gj["coordinates"])}
        # 6桁丸めで自己接触などの不正形状になることがある → 作り直して面だけ残す
        r = shape(gj)
        if not r.is_valid:
            r = make_valid(r)
            if r.geom_type == "GeometryCollection":
                polys = [g for g in r.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
                r = unary_union(polys) if polys else None
            if r is None or r.is_empty:
                n_empty += 1
                continue
            m = mapping(r)
            gj = {"type": m["type"], "coordinates": round_coords(m["coordinates"])}
        props = {"n": meta[key]["n"], "b": meta[key]["b"],
                 "s": sum(s for _, s, _ in items), "j": sum(j for _, _, j in items)}
        if len(items) > 1:
            props["u"] = len(items)
        feats.append({"type": "Feature", "geometry": gj, "properties": props})
    stats = {"records": n_rec, "water": n_water, "blocks": len(feats), "merged": n_multi, "empty": n_empty}
    return {"type": "FeatureCollection", "code": code, "src": "e-Stat 令和2年国勢調査 基本単位区境界(B002005212020)", "features": feats}, stats


def list_codes(args):
    if args.codes:
        return [c.zfill(5) for c in args.codes]
    idx = json.load(open(os.path.join(ROOT, "data", "setai_index.json"), encoding="utf-8"))
    codes = [w["code"] for c in idx["cities"] for w in c["wards"]]
    if args.pref:
        codes = [c for c in codes if c[:2] == args.pref.zfill(2)]
    return sorted(set(codes))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--codes", nargs="*")
    ap.add_argument("--pref")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--outdir", default=os.path.expanduser("~/projects/senkyo-maps-data/kb"))
    ap.add_argument("--cache", default=os.path.expanduser("~/work_kb/zip"))
    ap.add_argument("--skip-existing", action="store_true")
    ap.add_argument("--sleep", type=float, default=1.0, help="取得間隔(秒)")
    args = ap.parse_args()
    if not (args.codes or args.pref or args.all):
        ap.error("--codes / --pref / --all のいずれかを指定")
    codes = list_codes(args)
    os.makedirs(args.outdir, exist_ok=True)
    failed, done = [], []
    t0 = time.time()
    for i, code in enumerate(codes, 1):
        out = os.path.join(args.outdir, f"kb_{code}.geojson.gz")
        if args.skip_existing and os.path.exists(out) and os.path.getsize(out) > 100:
            done.append(code)
            continue
        zp = fetch_zip(code, args.cache)
        if not zp:
            print(f"[{i}/{len(codes)}] {code} ✗ 取得できず", flush=True)
            failed.append(code)
            continue
        try:
            fc, st = convert(code, zp)
        except Exception as e:  # noqa
            print(f"[{i}/{len(codes)}] {code} ✗ 変換失敗: {e}", flush=True)
            failed.append(code)
            continue
        if not fc["features"]:
            print(f"[{i}/{len(codes)}] {code} ✗ 街区0件", flush=True)
            failed.append(code)
            continue
        raw = json.dumps(fc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        with open(out, "wb") as f:
            f.write(gzip.compress(raw, mtime=0))
        done.append(code)
        print(f"[{i}/{len(codes)}] {code} ✓ 調査区{st['records']} → 街区{st['blocks']}(統合{st['merged']}, 空{st['empty']}, 水面{st['water']})"
              f" raw {len(raw)/1e6:.2f}MB gz {os.path.getsize(out)/1e3:.0f}KB  経過{(time.time()-t0)/60:.1f}分", flush=True)
        time.sleep(args.sleep)
    # 索引(既存ファイルも拾って全件を載せる)
    all_codes = sorted(f[3:8] for f in os.listdir(args.outdir) if f.startswith("kb_") and f.endswith(".geojson.gz"))
    idx = {"version": 1, "updated": datetime.date.today().isoformat(),
           "src": "e-Stat 令和2年国勢調査 基本単位区境界(B002005212020)・街区単位に統合", "codes": all_codes}
    with open(os.path.join(args.outdir, "kb_index.json"), "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False)
    print(f"\n完了 {len(done)}件 / 失敗 {len(failed)}件 / 索引 {len(all_codes)}件")
    if failed:
        print("失敗コード:", " ".join(failed))
        with open(os.path.join(args.cache, "failed.txt"), "w") as f:
            f.write("\n".join(failed))


if __name__ == "__main__":
    main()
