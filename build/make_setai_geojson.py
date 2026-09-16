#!/usr/bin/env python3
"""国勢調査2020 小地域(町丁目)境界シェープファイル → 世帯数レイヤ用GeoJSON変換.

入力: e-Stat 統計GIS の境界データ(世界測地系緯度経度・JGD2011, shape形式)
  https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=<市区町村コード>&coordSys=1&format=shape&downloadType=5&datum=2011
  を解凍した r2ka<code>.shp 一式。

出力: data/setai_<code>.geojson
  properties: name(町丁目名) / setai(世帯数) / jinko(人口) / key(KEY_CODE)
  ※HCODE==8101(町丁目)のみ。座標は小数5桁(約1m)へ丸めて軽量化。

■ 同一 KEY_CODE が複数レコードに分かれる件(重要)
  出典: e-Stat「令和2年国勢調査 町丁・字等境界データ データベース定義書」
        https://www.e-stat.go.jp/help/data-definition-information/downloaddata/A002005212020.pdf

  1つの町丁・字等番号に対して境界が複数存在することがあり、その場合 KIGO_E に
  E1, E2, E3… が付く(定義書 注2「特殊記号E(町丁・字等重複フラグ)」)。
  付与順は**足し上げた基本単位区の人口が多い順**。そして定義書 注25・注26 は
  JINKO/SETAI について「KIGO_Eが『En』(n≧2)の場合は0(ゼロ)」と明記する。
  つまり**人口・世帯数は E1 が代表して持ち、E2 以降は必ず 0**(二重計上の回避)。
  KBSUM(基本単位区数)も同じく E1 が代表して持つ(注7)。

  そのまま1レコード=1フィーチャで出すと、E2以降の区画が「0世帯」として
  最淡色＋0ラベルで描画され、地図の読み手を誤らせる。

  そこで KEY_CODE(=町丁・字等番号)単位で1フィーチャへまとめる(dissolve)。
  - 世帯数・人口は KEY_CODE 内の合計(E1以外は0なので E1 の値そのものになる)
  - 形状は MultiPolygon。**値を持つ境界(E1)を先頭**に置く
    (Leaflet の Polygon.getCenter() は MultiPolygon の先頭ポリゴンで決まるため、
     ラベルが人の住む本体側に載る。全部0なら面積最大を先頭にする)
  - ⚠️ AREA_MAX_F='M' を値の保持者の判定に使ってはいけない。定義書 注4 の M は
    「一番広い面積を持つ境界」であり、E1 の基準(人口が多い順)とは別物。
    横浜市18区では29ケース中3件で M と E1 が一致しない(上飯田町・和泉町・上永谷町)

  ■ これは「飛び地」ではない(用語の注意)
  e-Stat には飛び地・抜け地の専用フラグ KIGO_D('D'=抜け地 / 'D1'=抜け地(飛び地))が
  別にあり(注5)、複数境界の大半はこれに該当しない。横浜市18区1,778件のうち
  KIGO_D が付くのは青葉区寺家町の1件('D')のみ。
  例えば横浜市泉区 岡津町は、町名としては連続した1つの区域(全7境界を合体すると
  単一ポリゴンになる)。町丁・字等番号が 350000(3,965世帯)と 350001(461世帯)の
  2つに分かれ、その2つが互いにかみ合っているために、各番号の境界が
  それぞれ3つ・4つの塊に分割されている、という構造。
  横浜市18区の29ケースの内訳は、同名の別番号とかみ合って分割=17件、
  1つの番号の territory 自体が離れている=12件(上永谷町・寺家町など)。

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
