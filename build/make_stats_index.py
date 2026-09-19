#!/usr/bin/env python3
"""令和2年国勢調査 小地域集計(ファイル版)の statInfId 台帳を作る.

e-Stat の datalist ページ(HTML)から、47都道府県 × 表2・表3 の statInfId を抽出し
build/setai_stats_index.json に保存する。

- 表2: 男女別人口，外国人人口及び世帯数－町丁・字等
- 表3: 男女，年齢（5歳階級）別人口，平均年齢及び総年齢－町丁・字等

CSV本体の取得URL: https://www.e-stat.go.jp/stat-search/file-download?statInfId=<ID>&fileKind=1

使い方: python3 build/make_stats_index.py [out.json]
(e-Stat へ47回アクセスする。礼儀として1秒間隔)
"""
import json
import re
import sys
import time
import urllib.request

BASE = "https://www.e-stat.go.jp"
# 小地域集計(令和2年) 都道府県一覧ページ
LIST_URL = (BASE + "/stat-search/files?page=1&toukei=00200521"
            "&tstat=000001136464&cycle=0&tclass1=000001136472")
UA = {"User-Agent": "Mozilla/5.0 (senkyo-maps data build; contact via GitHub)"}
WANT_TABLES = ("2", "3")  # 表番号


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=60).read().decode("utf-8", errors="replace")


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "build/setai_stats_index.json"

    html = fetch(LIST_URL)
    # data-value2="<tclass2>"> の直後に「01：北海道」形式の表示名が来る
    prefs = re.findall(r'data-value2="(\d{12})">\s*(\d{2})：([^\s<]+)', html)
    # (tclass2, 都道府県コード, 名称) の重複を除いて 47 件に
    seen = {}
    for tclass2, pcode, pname in prefs:
        seen.setdefault(pcode, (tclass2, pname))
    if len(seen) != 47:
        sys.exit(f"都道府県の抽出が47件でない: {len(seen)}件 — ページ構造が変わった可能性")

    index = {}
    for pcode in sorted(seen):
        tclass2, pname = seen[pcode]
        url = (BASE + "/stat-search/files?page=1&cycle=0&toukei=00200521"
               f"&tstat=000001136464&tclass1=000001136472&tclass2={tclass2}&layout=datalist")
        page = fetch(url)
        # <article> ごとに 表番号 と stat_infid のペアを拾う
        tables = {}
        for art in page.split('<article class="stat-dataset_list-item">')[1:]:
            mno = re.search(r'表番号&nbsp;</span><span>(\d+(?:-\d+)?)</span>', art)
            mid = re.search(r'stat_infid=(\d{12})', art)
            if mno and mid and mno.group(1) in WANT_TABLES:
                tables.setdefault(mno.group(1), mid.group(1))
        missing = [t for t in WANT_TABLES if t not in tables]
        if missing:
            sys.exit(f"{pcode} {pname}: 表{missing} が見つからない — 抽出ロジック要確認")
        index[pcode] = {"name": pname, "tclass2": tclass2,
                        "t2": tables["2"], "t3": tables["3"]}
        print(f"{pcode} {pname}: 表2={tables['2']} 表3={tables['3']}", flush=True)
        time.sleep(1)

    n = sum(len([e["t2"], e["t3"]]) for e in index.values())
    if n != 94:
        sys.exit(f"statInfId が94件でない: {n}件")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"survey": "令和2年国勢調査 小地域集計",
                   "tables": {"t2": "第2表 男女別人口，外国人人口及び世帯数－町丁・字等",
                              "t3": "第3表 男女，年齢（5歳階級）別人口，平均年齢及び総年齢－町丁・字等"},
                   "download": BASE + "/stat-search/file-download?statInfId=<ID>&fileKind=1",
                   "fetched": time.strftime("%Y-%m-%d"),
                   "prefs": index}, f, ensure_ascii=False, indent=1)
    print(f"OK: {out_path} に47都道府県×2表={n}件を保存")


if __name__ == "__main__":
    main()
