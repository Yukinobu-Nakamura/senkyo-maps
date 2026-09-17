#!/usr/bin/env python3
"""収録自治体の一覧(data/setai_index.json)を作る.

アプリ(assets/common.js)はこのJSONを取得して世帯数レイヤの選択パネルを組み立てる。
**一覧をコードに埋め込まずJSONにしておく理由**:
配布版(dist/*.html)はデータを公開URL(GitHub Pages)から取りに行くため、
このJSONを更新すれば **既に配った HTML もそのまま新しい自治体を拾える**
(HTMLを配り直さなくてよい = 引き継ぎ・同期がそのまま成立する)。
逆に一覧をHTMLへ埋め込むと、配布済みのものが永久に古い一覧のままになる。

名前は必ず data/ の geojson と対になる shapefile の PREF_NAME / CITY_NAME から取る
(記憶や手書きのコード表を作らない)。政令市は CITY_NAME が「横浜市鶴見区」のように
市名＋区名で入っているので、市と区に割って階層にする。

出力形式:
  {
    "version": 1,
    "updated": "2026-09-17",            ← 引数で渡す。省略時は空
    "cities": [
      {"pref":"神奈川県","city":"横浜市","wards":[{"code":"14101","name":"鶴見区"}, ...]},
      {"pref":"東京都","city":"豊島区","wards":[{"code":"13116","name":"豊島区"}]},
      ...
    ]
  }
※ wards が1件でも、市名と区名が違う(=政令市の一部だけ収録)ときは
  アプリ側で下層レイヤとして表示する。大阪市平野区が該当。

使い方:
  python3 build/make_setai_index.py <shpディレクトリ> <出力json> [更新日]
    shpディレクトリ内の r2ka<code>.shp を走査する。
    data/setai_<code>.geojson が無いコードは一覧に載せない(選んでも404になるため)。
依存: pyshp
"""
import json
import re
import sys
from pathlib import Path

import shapefile

# 政令指定都市: CITY_NAME が「○○市△△区」の形。特別区(豊島区)や一般市(金沢市)は該当しない
SEIREI_RE = re.compile(r"^(.+?市)(.+区)$")


def split_city_ward(city_name: str):
    m = SEIREI_RE.match(city_name)
    return (m.group(1), m.group(2)) if m else (city_name, city_name)


def build(shpdir: str, out: str, updated: str = "") -> None:
    """shpdir 以下の *.shp を再帰的に走査して一覧を作る。

    ファイル名ではなくレコードの PREF/CITY から市区町村コードを取るので、
    1市区町村ずつの r2kaXXXXX.shp でも、都道府県一括の r2kaXX.shp でも同じに扱える。
    """
    datadir = Path(out).parent
    cities, names, skipped = {}, {}, []
    for shp in sorted(Path(shpdir).rglob("*.shp")):
        sf = shapefile.Reader(str(shp), encoding="cp932")
        fields = [f[0] for f in sf.fields[1:]]
        for r in sf.records():
            d = dict(zip(fields, list(r)))
            if d.get("HCODE") != 8101:
                continue
            code = (d.get("PREF") or "") + (d.get("CITY") or "")
            if code and code not in names:
                names[code] = (d.get("PREF_NAME") or "", d.get("CITY_NAME") or "")

    for code, (pref, city_name) in sorted(names.items()):
        # data/ に geojson が無いコードは載せない(選んでも404になるため)
        if not city_name or not (datadir / f"setai_{code}.geojson").exists():
            skipped.append(code)
            continue
        city, ward = split_city_ward(city_name)
        e = cities.setdefault((pref, city), {"pref": pref, "city": city, "wards": []})
        e["wards"].append({"code": code, "name": ward})

    # 並び順は市区町村コード順(=都道府県順)。区も同じくコード順で安定させる
    out_cities = sorted(cities.values(), key=lambda c: min(w["code"] for w in c["wards"]))
    for c in out_cities:
        c["wards"].sort(key=lambda w: w["code"])

    idx = {"version": 1, "updated": updated, "cities": out_cities}
    with open(out, "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False, separators=(",", ":"))

    n_ward = sum(len(c["wards"]) for c in out_cities)
    print(f"{out}: {len(out_cities)} 自治体 / {n_ward} 市区町村コード")
    for c in out_cities:
        sub = f" ({len(c['wards'])}区)" if len(c["wards"]) > 1 else (
            f" ({c['wards'][0]['name']})" if c["wards"][0]["name"] != c["city"] else "")
        print(f"    {c['pref']} {c['city']}{sub}")
    if skipped:
        print(f"    ※geojson未生成のため除外: {len(skipped)}件 {skipped[:10]}")


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    build(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) == 4 else "")
