#!/usr/bin/env python3
"""市区町村(と政令市)の外周ポリゴン生成 — 🔍地名検索で「豊島区」「横浜市」と探したとき、その範囲全体を枠で囲む用.

入力: data/setai_<code>.geojson(町丁目=国勢調査2020小地域。970市区)と data/setai_index.json
出力: <outdir>/muni_<code>.geojson.gz        市区ごとの外周(町丁目の unary_union)
      <outdir>/city_<最小区コード>.geojson.gz 政令市など「市 > 区」構成の市全体(区外周の union)
      <outdir>/muni_index.json               {version, updated, codes:[...], cities:[{file, name, pref, wards}]}
  properties: n=名称 / c=コード / s=世帯数合計 / j=人口合計 / u=統合した町丁目数

■ 町丁目の和集合なので、小地域に含まれない水面調査区(HCODE 8154=海・湖)は外周に含まれない。
  Google マップの行政界(海面まで含むことがある)より陸側で閉じる。ポスティング用途ではむしろ分かりやすい。
■ 町丁目の座標は小数5桁(約1m)で揃っているので、隣接境界は同じ頂点を共有し union は隙間なく閉じる。
  念のため make_valid を通し、面以外(線・点)は捨てる。
■ 名称は setai_index.json の区名/市名(=e-Stat 境界データの CITY_NAME)。クライアントは候補名の末尾一致で使う。

使い方: ~/.venvs/geo/bin/python build/make_muni_outline.py [--outdir ~/projects/senkyo-maps-data/muni] [--codes 13116 ...]
"""
import argparse, gzip, json, os, sys, datetime
from collections import defaultdict

try:
    from shapely.geometry import shape, mapping
    from shapely.ops import unary_union
    from shapely.validation import make_valid
except ImportError:
    sys.exit("shapely が要ります: ~/.venvs/geo/bin/python で実行してください")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def round_coords(obj, nd=5):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], float):
            return [round(obj[0], nd), round(obj[1], nd)]
        return [round_coords(o, nd) for o in obj]
    return obj


def polygonal(g):
    """面だけ残す。空なら None"""
    if g is None or g.is_empty:
        return None
    if not g.is_valid:
        g = make_valid(g)
    if g.geom_type == "GeometryCollection":
        polys = [x for x in g.geoms if x.geom_type in ("Polygon", "MultiPolygon")]
        g = unary_union(polys) if polys else None
    if g is None or g.is_empty:
        return None
    return g


def write_gz(path, feature):
    raw = json.dumps(feature, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with open(path, "wb") as f:
        f.write(gzip.compress(raw, mtime=0))
    return len(raw), os.path.getsize(path)


def feature_of(g, props):
    m = mapping(g)
    return {"type": "Feature", "geometry": {"type": m["type"], "coordinates": round_coords(m["coordinates"])}, "properties": props}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--outdir", default=os.path.expanduser("~/projects/senkyo-maps-data/muni"))
    ap.add_argument("--codes", nargs="*")
    args = ap.parse_args()
    os.makedirs(args.outdir, exist_ok=True)
    idx = json.load(open(os.path.join(ROOT, "data", "setai_index.json"), encoding="utf-8"))
    want = set(c.zfill(5) for c in args.codes) if args.codes else None

    done, failed, cities_out = [], [], []
    for city in idx["cities"]:
        ward_geoms = {}
        for w in city["wards"]:
            code = w["code"]
            if want and code not in want:
                continue
            src = os.path.join(ROOT, "data", f"setai_{code}.geojson")
            try:
                gj = json.load(open(src, encoding="utf-8"))
                geoms, s, j, n = [], 0, 0, 0
                for f in gj.get("features", []):
                    g = shape(f["geometry"])
                    if not g.is_valid:
                        g = make_valid(g)
                    geoms.append(g)
                    p = f.get("properties") or {}
                    s += int(p.get("setai") or 0)
                    j += int(p.get("jinko") or 0)
                    n += 1
                u = polygonal(unary_union(geoms))
                if u is None:
                    raise RuntimeError("union が空")
                # 丸めで崩れていないか再確認
                feat = feature_of(u, {"n": w["name"], "c": code, "s": s, "j": j, "u": n})
                r = polygonal(shape(feat["geometry"]))
                if r is None:
                    raise RuntimeError("丸め後に空")
                if not shape(feat["geometry"]).is_valid:
                    feat = feature_of(r, feat["properties"])
                raw, gz = write_gz(os.path.join(args.outdir, f"muni_{code}.geojson.gz"), feat)
                ward_geoms[code] = (r, s, j, n)
                done.append(code)
                print(f"{code} {city['city']}{'' if w['name'] == city['city'] else ' ' + w['name']}: 町丁目{n} → {feat['geometry']['type']} raw {raw/1e3:.0f}KB gz {gz/1e3:.0f}KB", flush=True)
            except Exception as e:  # noqa
                print(f"{code} ✗ {e}", flush=True)
                failed.append(code)
        # 市 > 区 の市全体(政令市・一部収録の市も区外周の union)
        has_sub = len(city["wards"]) > 1 or (city["wards"] and city["wards"][0]["name"] != city["city"])
        if has_sub and ward_geoms and (not want or len(ward_geoms) == len(city["wards"])):
            codes = sorted(ward_geoms)
            u = polygonal(unary_union([ward_geoms[c][0] for c in codes]))
            if u is not None:
                fname = f"city_{codes[0]}.geojson.gz"
                feat = feature_of(u, {"n": city["city"], "c": codes[0], "s": sum(ward_geoms[c][1] for c in codes),
                                      "j": sum(ward_geoms[c][2] for c in codes), "u": sum(ward_geoms[c][3] for c in codes)})
                raw, gz = write_gz(os.path.join(args.outdir, fname), feat)
                cities_out.append({"file": fname, "name": city["city"], "pref": city["pref"], "wards": codes})
                print(f"  └ {city['city']} 全体({len(codes)}区): gz {gz/1e3:.0f}KB", flush=True)

    all_codes = sorted(f[5:10] for f in os.listdir(args.outdir) if f.startswith("muni_") and f.endswith(".geojson.gz"))
    if not want:
        out_idx = {"version": 1, "updated": datetime.date.today().isoformat(),
                   "src": "e-Stat 令和2年国勢調査 小地域境界(A002005212020)の町丁目を市区ごとに統合", "codes": all_codes, "cities": cities_out}
        with open(os.path.join(args.outdir, "muni_index.json"), "w", encoding="utf-8") as f:
            json.dump(out_idx, f, ensure_ascii=False)
    print(f"\n完了 {len(done)} / 失敗 {len(failed)} / 市全体 {len(cities_out)} / 索引 {len(all_codes)}")
    if failed:
        print("失敗:", " ".join(failed))


if __name__ == "__main__":
    main()
