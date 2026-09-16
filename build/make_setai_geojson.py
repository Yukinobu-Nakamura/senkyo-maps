#!/usr/bin/env python3
"""国勢調査2020 小地域(町丁目)境界シェープファイル → 世帯数レイヤ用GeoJSON変換.

入力: e-Stat 統計GIS の境界データ(世界測地系緯度経度・JGD2011, shape形式)
  https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=<市区町村コード>&coordSys=1&format=shape&downloadType=5&datum=2011
  を解凍した r2ka<code>.shp 一式。

出力: data/setai_<code>.geojson
  properties: name(町丁目名) / setai(世帯数) / jinko(人口) / key(KEY_CODE)
  ※HCODE==8101(町丁目)のみ。座標は小数5桁(約1m)へ丸めて軽量化。

■ 同一 KEY_CODE が複数レコードに分かれる件(重要)
  飛び地などで1つの町丁目が複数ポリゴンに分かれる場合、e-Stat の境界データは
  ポリゴンごとに1レコードを持つが、**世帯数・人口はそのうち1レコードだけが保持し、
  残りは 0 が入る**(集計の二重計上を避けるため)。
  そのまま1ポリゴン=1フィーチャで出すと、人が住んでいる町丁目の飛び地部分が
  「0世帯」として最淡色＋0ラベルで描画され、地図の読み手を誤らせる。
  (例: 横浜市泉区 岡津町 は7ポリゴンに分かれ、うち5つが0表示になっていた)

  そこで KEY_CODE 単位で1フィーチャへまとめる(dissolve)。
  - 世帯数・人口は KEY_CODE 内の合計(保持者は1つなのでその値になる)
  - 形状は MultiPolygon。**世帯数を持つポリゴンを先頭**に置く
    (Leaflet の Polygon.getCenter() は MultiPolygon の先頭ポリゴンで決まるため、
     ラベルが人の住む本体側に載る。全部0なら面積最大を先頭にする)
  - なお AREA_MAX_F='M'(面積最大)は世帯数の保持者とは一致しないことがある
    (横浜市18区で29分割中3件が不一致)。**Mを保持者の判定に使ってはいけない**

使い方: python3 build/make_setai_geojson.py <r2kaXXXXX.shpのパス> <出力geojsonパス>
依存: pyshp (pip install pyshp)
"""
import json
import sys
from collections import OrderedDict

import shapefile


def convert(src: str, dst: str) -> None:
    sf = shapefile.Reader(src, encoding="cp932")
    fields = [f[0] for f in sf.fields[1:]]

    groups = OrderedDict()  # KEY_CODE -> list of parts
    for sr in sf.shapeRecords():
        rec = dict(zip(fields, list(sr.record)))
        if rec.get("HCODE") != 8101:  # 町丁目のみ(水面調査区などを除外)
            continue
        key = rec.get("KEY_CODE") or ""
        groups.setdefault(key, []).append({
            "name": rec.get("S_NAME") or "",
            "setai": int(rec.get("SETAI") or 0),
            "jinko": int(rec.get("JINKO") or 0),
            "area": float(rec.get("AREA") or 0),
            "geom": round_geom(sr.shape.__geo_interface__, 5),
        })

    feats, n_dissolved = [], 0
    for key, parts in groups.items():
        if len(parts) > 1:
            n_dissolved += 1
            # 世帯数を持つポリゴンを先頭へ(同点なら面積が大きい方を優先)
            parts.sort(key=lambda p: (p["setai"] > 0 or p["jinko"] > 0, p["area"]), reverse=True)
        feats.append({
            "type": "Feature",
            "properties": {
                "name": parts[0]["name"],
                "setai": sum(p["setai"] for p in parts),
                "jinko": sum(p["jinko"] for p in parts),
                "key": key,
            },
            "geometry": merge_geoms([p["geom"] for p in parts]),
        })

    gj = {"type": "FeatureCollection", "features": feats}
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(gj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{dst}: {len(feats)} features (うち複数ポリゴンを統合した町丁目 {n_dissolved})")


def merge_geoms(geoms):
    """複数ジオメトリを1つへ。単独ならそのまま、複数なら MultiPolygon に束ねる。"""
    if len(geoms) == 1:
        return geoms[0]
    polys = []
    for g in geoms:
        if g["type"] == "Polygon":
            polys.append(g["coordinates"])
        elif g["type"] == "MultiPolygon":
            polys.extend(g["coordinates"])
        else:
            raise ValueError(f"想定外のジオメトリ型: {g['type']}")
    return {"type": "MultiPolygon", "coordinates": polys}


def round_geom(geom, nd):
    def r(coords):
        if isinstance(coords[0], (int, float)):
            return [round(coords[0], nd), round(coords[1], nd)]
        return [r(c) for c in coords]
    return {"type": geom["type"], "coordinates": r(geom["coordinates"])}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    convert(sys.argv[1], sys.argv[2])
