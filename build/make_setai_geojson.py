#!/usr/bin/env python3
"""国勢調査2020 小地域(町丁目)境界シェープファイル → 世帯数レイヤ用GeoJSON変換.

入力: e-Stat 統計GIS の境界データ(世界測地系緯度経度・JGD2011, shape形式)
  https://www.e-stat.go.jp/gis/statmap-search/data?dlserveyId=A002005212020&code=<市区町村コード>&coordSys=1&format=shape&downloadType=5&datum=2011
  を解凍した r2ka<code>.shp 一式。

出力: data/setai_<code>.geojson
  properties: name(町丁目名) / setai(世帯数) / jinko(人口) / key(代表KEY_CODE) / units(合算した集計単位数)
  ※HCODE==8101(町丁目)のみ。座標は小数5桁(約1m)へ丸めて軽量化。
  ※1つの町丁目名=1フィーチャ。理由は下記「同じ町名が複数に分かれる件」。

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

■ 同じ町名が複数の町丁・字等番号に分かれる件(重要)
  KIHON1(4桁)=町字コード、KIHON2(2桁)=丁目・字などの番号。
  丁目のある町は KIHON1 が同じで KIHON2=01,02… と振られ、名称も
  「下和泉一丁目/二丁目…」と変わるので区別がつく。
  一方、丁目を持たない大きな町は、国勢調査の集計単位として
  KIHON2=00,01,02… に分割されるが、**名称はどれも同じまま**になる。
  (例: 泉区 岡津町=KIHON1 3500 の KIHON2 00(3,965世帯)と01(461世帯)、
       戸塚区 戸塚町=4分割、泉区 和泉町=5分割)

  この分割は住居表示に対応せず、現地に境界の手がかりが無い(住所はどちらも
  「岡津町○○番地」)。ポスティング・ポスター配置の用途では**町名単位**が
  実務の単位なので、同一市区町村内で**同じ S_NAME を1フィーチャへ統合**する。

■ 統合キーの決め方(2段構え)
  第1段: **S_AREA(町丁・字等番号 = KIHON1+KIHON2)を主キー**にして束ねる。
         S_AREA は集計単位そのものの公式IDで必ず入っているため、これを土台にする。
         ここで KIGO_E の複数境界(E1,E2…)が1単位にまとまる。
  第2段: **S_NAME が一致する単位が2つ以上あるときだけ、町名を統合キーに切り替える**。
         同名が1つしかない単位は S_AREA のままなので、丁目(名称が違う)は束ならない。
         名称が空の単位は統合しない(空文字どうしが全部1つに融合する事故を防ぐ)。

  町名を主キーにする実装でも現在の22自治体では同じ結果になるが(全件で
  S_NAME は非空・S_AREA と S_NAME は1対1)、将来 S_NAME が空の自治体を
  追加したときに全町丁目が1フィーチャへ融合する事故が起きうる。
  S_AREA を土台に置けばその形の壊れ方はしない。

  同名なのに KIHON1(町字コード)が違う単位を束ねたときは警告を出す
  (現状の該当は大田区 令和島の0811/0812のみ。地理的に一続きで両方0世帯、
   統合して差し支えないことを確認済み)。別の町が同名で並んでいる自治体が
  来たらここで気づけるようにしてある。
  - 世帯数・人口は合算(岡津町なら 3,965+461=4,426世帯)
  - ラベルは**最も世帯数の多い区分の本体ポリゴン**に載せる
  - properties.units に合算した集計単位数が入る(1なら未統合)
  丁目は名称が異なるため統合されない(下和泉一丁目と二丁目は別のまま)。

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
from collections import Counter, OrderedDict

import shapefile


def convert(src: str, dst: str) -> None:
    sf = shapefile.Reader(src, encoding="cp932")
    fields = [f[0] for f in sf.fields[1:]]

    # --- 第1段: S_AREA(町丁・字等番号)を主キーにする ---------------------
    # S_AREA は集計単位そのものの公式ID。まずこれで束ね、KIGO_E の複数境界を吸収する。
    # (町名を主キーにすると、将来 S_NAME が空の自治体が来たとき全部1つに融合してしまう)
    units = OrderedDict()  # S_AREA -> unit
    for sr in sf.shapeRecords():
        rec = dict(zip(fields, list(sr.record)))
        if rec.get("HCODE") != 8101:  # 町丁目のみ(水面調査区などを除外)
            continue
        area_id = rec.get("S_AREA") or rec.get("KEY_CODE") or ""
        u = units.setdefault(area_id, {
            "key": rec.get("KEY_CODE") or "",
            "name": rec.get("S_NAME") or "",
            "parts": [],
        })
        u["parts"].append({
            "setai": int(rec.get("SETAI") or 0),
            "jinko": int(rec.get("JINKO") or 0),
            "area": float(rec.get("AREA") or 0),
            "geom": round_geom(sr.shape.__geo_interface__, 5),
        })

    n_multi_boundary = 0
    for u in units.values():
        if len(u["parts"]) > 1:
            n_multi_boundary += 1
        # 値を持つ境界(KIGO_E=E1)を先頭へ。同点なら面積が大きい方
        u["parts"].sort(key=lambda p: (p["setai"] > 0 or p["jinko"] > 0, p["area"]), reverse=True)
        u["setai"] = sum(p["setai"] for p in u["parts"])  # E1以外は0なのでE1の値になる
        u["jinko"] = sum(p["jinko"] for p in u["parts"])

    # --- 第2段: S_NAME が一致する単位だけを、町名をキーに束ね直す -----------
    # 丁目は名称が違うので束ならない。名称が空の単位は安全のため束ねない。
    name_count = Counter((u["name"] or "").strip() for u in units.values())
    groups, warns = OrderedDict(), []
    for area_id, u in units.items():
        nm = (u["name"] or "").strip()
        # 同名が2つ以上あるときだけ町名キーへ切り替える。それ以外は S_AREA のまま
        gkey = ("name", nm) if nm and name_count[nm] > 1 else ("area", area_id)
        groups.setdefault(gkey, []).append(u)

    feats, merged_names = [], []
    for gkey, us in groups.items():
        # 世帯数の多い単位を先に = ラベルがその単位の本体ポリゴンに載る
        us.sort(key=lambda u: (u["setai"], u["jinko"], max(p["area"] for p in u["parts"])), reverse=True)
        if len(us) > 1:
            merged_names.append((us[0]["name"], len(us), sum(u["setai"] for u in us)))
            k1s = {u["key"][5:9] for u in us}
            if len(k1s) > 1:
                warns.append(f"{us[0]['name']}: 町字コードが複数 {sorted(k1s)} — "
                             f"同名でも別の町の可能性があるので地図で位置を確認すること")
        feats.append({
            "type": "Feature",
            "properties": {
                "name": us[0]["name"],
                "setai": sum(u["setai"] for u in us),
                "jinko": sum(u["jinko"] for u in us),
                "key": us[0]["key"],
                "units": len(us),
            },
            "geometry": merge_geoms([p["geom"] for u in us for p in u["parts"]]),
        })

    gj = {"type": "FeatureCollection", "features": feats}
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(gj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{dst}: {len(feats)} features / S_AREA単位 {len(units)} "
          f"(うち複数境界(KIGO_E)を束ねた単位 {n_multi_boundary}) "
          f"/ 同名で統合した町名 {len(merged_names)}")
    for nm, cnt, s in merged_names:
        print(f"    統合: {nm} = {cnt}区分 → {s:,}世帯")
    for w in warns:
        print(f"    ⚠️ {w}")


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
