#!/usr/bin/env python3
"""国土地理院「住居表示住所」(電子国土基本図(地名情報)) → 番地(街区符号)・号(住居番号)ラベル用の軽量データ生成.

用途: 地図を z17 以上に拡大したとき、街区符号(○番)と住居番号(○号)を地図上に表示する(Googleマップの番地・号表示に相当)。
入力: https://saigai.gsi.go.jp/jusho/download/data/<市区町村コード5桁>.zip
      (都道府県別の一覧 https://saigai.gsi.go.jp/jusho/download/pref/<2桁>.html に、提供のある市区町村の zip へのリンクがある)
      zip 内の CSV 列: 市区町村コード, 町丁目名, 街区符号, 住居番号, URL, (空), 経度, 緯度, 元図の縮尺(25000/2500)
      住居表示を実施している地域の住居番号の位置(建物の前面)。住居表示未実施の地番地域は含まれない。
出力: <outdir>/jusho_<code>.json.gz
      {"v":1, "code":"13116", "t":["池袋一丁目",...], "p":[[lng, lat, 町丁目idx, 街区符号, 住居番号], ...]}
      lng/lat は小数6桁(約10cm)。街区符号・住居番号は文字列のまま(「1-2」のような枝番・「イ」等の表記があり得るため)
      + <outdir>/jusho_index.json {version, updated, codes:[...]}
出典表示: 「国土地理院 住居表示住所」。国土地理院コンテンツ利用規約(出典の明記で利用可)に従う。

使い方: python3 build/make_jusho.py --codes 13116 | --pref 13 | --all  [--outdir ~/projects/senkyo-maps-data/jusho] [--cache ~/work_jusho] [--skip-existing]
"""
import argparse, csv, gzip, io, json, os, re, sys, time, zipfile, urllib.request, datetime

BASE = "https://saigai.gsi.go.jp/jusho/download/"
UA = "Mozilla/5.0 (senkyo-maps build; contact via GitHub Yukinobu-Nakamura/senkyo-maps)"


def get(url, timeout=120):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def list_codes(pref=None):
    prefs = [pref.zfill(2)] if pref else [f"{i:02d}" for i in range(1, 48)]
    codes = []
    for p in prefs:
        try:
            html = get(BASE + f"pref/{p}.html").decode("utf-8", "ignore")
        except Exception as e:  # noqa
            print(f"  ! 都道府県 {p} の一覧が取れません: {e}", file=sys.stderr)
            continue
        codes += re.findall(r"data/(\d{5})\.zip", html)
        time.sleep(0.5)
    return sorted(set(codes))


def fetch_zip(code, cache_dir):
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, f"{code}.zip")
    if os.path.exists(path) and zipfile.is_zipfile(path):
        return path
    for i in range(3):
        try:
            data = get(BASE + f"data/{code}.zip")
            if data[:2] == b"PK":
                with open(path, "wb") as f:
                    f.write(data)
                return path
            return None
        except Exception as e:  # noqa
            print(f"  ! {code} 取得失敗({e}) 再試行", file=sys.stderr)
            time.sleep(10 * (i + 1))
    return None


def convert(code, zip_path):
    with zipfile.ZipFile(zip_path) as z:
        name = next((n for n in z.namelist() if n.lower().endswith(".csv")), None)
        if not name:
            raise RuntimeError("CSV が無い")
        raw = z.read(name)
    try:
        txt = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        txt = raw.decode("cp932")
    towns, tidx, pts = [], {}, []
    for row in csv.reader(io.StringIO(txt)):
        if len(row) < 8 or not row[0].isdigit():
            continue
        town, blk, go, lng, lat = row[1].strip(), row[2].strip(), row[3].strip(), row[6], row[7]
        try:
            lng, lat = round(float(lng), 6), round(float(lat), 6)
        except ValueError:
            continue
        if town not in tidx:
            tidx[town] = len(towns); towns.append(town)
        pts.append([lng, lat, tidx[town], blk, go])
    return {"v": 1, "code": code, "src": "国土地理院 住居表示住所", "t": towns, "p": pts}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--codes", nargs="*")
    ap.add_argument("--pref")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--outdir", default=os.path.expanduser("~/projects/senkyo-maps-data/jusho"))
    ap.add_argument("--cache", default=os.path.expanduser("~/work_jusho"))
    ap.add_argument("--skip-existing", action="store_true")
    ap.add_argument("--sleep", type=float, default=1.0)
    args = ap.parse_args()
    if args.codes:
        codes = [c.zfill(5) for c in args.codes]
    elif args.pref or args.all:
        codes = list_codes(args.pref)
        print(f"提供あり {len(codes)} 市区町村")
    else:
        ap.error("--codes / --pref / --all")
    os.makedirs(args.outdir, exist_ok=True)
    done, failed = [], []
    t0 = time.time()
    for i, code in enumerate(codes, 1):
        out = os.path.join(args.outdir, f"jusho_{code}.json.gz")
        if args.skip_existing and os.path.exists(out) and os.path.getsize(out) > 100:
            done.append(code); continue
        zp = fetch_zip(code, args.cache)
        if not zp:
            print(f"[{i}/{len(codes)}] {code} ✗ 取得できず", flush=True); failed.append(code); continue
        try:
            d = convert(code, zp)
        except Exception as e:  # noqa
            print(f"[{i}/{len(codes)}] {code} ✗ 変換失敗: {e}", flush=True); failed.append(code); continue
        if not d["p"]:
            print(f"[{i}/{len(codes)}] {code} ✗ 0件", flush=True); failed.append(code); continue
        raw = json.dumps(d, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        with open(out, "wb") as f:
            f.write(gzip.compress(raw, mtime=0))
        done.append(code)
        print(f"[{i}/{len(codes)}] {code} ✓ 町丁目{len(d['t'])} 点{len(d['p'])} raw {len(raw)/1e6:.2f}MB gz {os.path.getsize(out)/1e3:.0f}KB 経過{(time.time()-t0)/60:.1f}分", flush=True)
        time.sleep(args.sleep)
    all_codes = sorted(f[6:11] for f in os.listdir(args.outdir) if f.startswith("jusho_") and f.endswith(".json.gz"))
    with open(os.path.join(args.outdir, "jusho_index.json"), "w", encoding="utf-8") as f:
        json.dump({"version": 1, "updated": datetime.date.today().isoformat(), "src": "国土地理院 住居表示住所(電子国土基本図(地名情報))", "codes": all_codes}, f, ensure_ascii=False)
    print(f"\n完了 {len(done)} / 失敗 {len(failed)} / 索引 {len(all_codes)}")
    if failed:
        print("失敗:", " ".join(failed))
        with open(os.path.join(args.cache, "failed.txt"), "w") as f:
            f.write("\n".join(failed))


if __name__ == "__main__":
    main()
