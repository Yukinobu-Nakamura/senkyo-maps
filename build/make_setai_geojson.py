#!/usr/bin/env python3
"""国勢調査2020 小地域(町丁目)境界シェープファイル → 世帯数レイヤ用GeoJSON変換.

入力: e-Stat 統計GIS の境界データ(世界測地系緯度経度・JGD2011, shape形式)
  https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=<市区町村コード>&coordSys=1&format=shape&downloadType=5&datum=2011
  を解凍した r2ka<code>.shp 一式。

出力: data/setai_<code>.geojson
  properties: name(町丁目名) / setai(世帯数) / jinko(人口) / key(KEY_CODE)
  ※HCODE==8101(町丁目)のみ。座標は小数5桁(約1m)へ丸めて軽量化。

使い方: python3 build/make_setai_geojson.py <r2kaXXXXX.shpのパス> <出力geojsonパス>
依存: pyshp (pip install pyshp)
"""
import json
import sys

import shapefile


def convert(src: str, dst: str) -> None:
    sf = shapefile.Reader(src, encoding="cp932")
    fields = [f[0] for f in sf.fields[1:]]
    feats = []
    for sr in sf.shapeRecords():
        rec = dict(zip(fields, list(sr.record)))
        if rec.get("HCODE") != 8101:  # 町丁目のみ(水面調査区などを除外)
            continue
        geom = sr.shape.__geo_interface__
        geom = round_geom(geom, 5)
        feats.append({
            "type": "Feature",
            "properties": {
                "name": rec.get("S_NAME") or "",
                "setai": int(rec.get("SETAI") or 0),
                "jinko": int(rec.get("JINKO") or 0),
                "key": rec.get("KEY_CODE") or "",
            },
            "geometry": geom,
        })
    gj = {"type": "FeatureCollection", "features": feats}
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(gj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{dst}: {len(feats)} features")


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
