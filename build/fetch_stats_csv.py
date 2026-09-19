#!/usr/bin/env python3
"""令和2年国勢調査 小地域集計 表2・表3 CSV(47都道府県)を一括取得.

build/setai_stats_index.json(make_stats_index.py の出力)を読み、
<outdir>/t2_<都道府県コード>.csv / t3_<都道府県コード>.csv として保存する。

取得後の自己検査:
- cp932 でデコードできること
- 2行目に期待する表名が含まれること(表2=外国人人口 / 表3=年齢（5歳階級）)
- データ行数が市区町村数以上あること

使い方: python3 build/fetch_stats_csv.py build/setai_stats_index.json ~/work_setai_all/stats
既取得で検査を通るファイルはスキップする(再実行安全)。
"""
import json
import os
import sys
import time
import urllib.request

URL = "https://www.e-stat.go.jp/stat-search/file-download?statInfId={}&fileKind=1"
UA = {"User-Agent": "Mozilla/5.0 (senkyo-maps data build; contact via GitHub)"}
EXPECT = {"t2": "外国人人口", "t3": "年齢（5歳階級）"}


def check(path, kind):
    try:
        with open(path, "rb") as f:
            raw = f.read()
        txt = raw.decode("cp932")
    except Exception:
        return False
    head = "\n".join(txt.splitlines()[:3])
    return EXPECT[kind] in head and len(txt.splitlines()) > 60


def main():
    idx_path, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    idx = json.load(open(idx_path, encoding="utf-8"))["prefs"]
    ok = skip = 0
    for pcode in sorted(idx):
        for kind in ("t2", "t3"):
            dest = os.path.join(outdir, f"{kind}_{pcode}.csv")
            if os.path.exists(dest) and check(dest, kind):
                skip += 1
                continue
            sid = idx[pcode][kind]
            req = urllib.request.Request(URL.format(sid), headers=UA)
            data = urllib.request.urlopen(req, timeout=120).read()
            with open(dest, "wb") as f:
                f.write(data)
            if not check(dest, kind):
                sys.exit(f"NG: {dest} (statInfId={sid}) が検査を通らない — 取得内容を確認せよ")
            ok += 1
            print(f"{dest} {len(data):,}B OK", flush=True)
            time.sleep(1)
    total = len(idx) * 2
    got = ok + skip
    if got != total:
        sys.exit(f"件数不一致: {got}/{total}")
    print(f"完了: 取得{ok}件 + 既存{skip}件 = {total}件 全検査OK")


if __name__ == "__main__":
    main()
