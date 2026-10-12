#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""senkyo-maps ドリフト検査(G20の本体)

なぜあるか
----------
「同じ趣旨の記述が複数箇所にあるのに、片方だけ直っている」状態を検出する。
罰条そのもの(○条○項○号・刑量)は build/batsujo.yml ＋ precheck.py の G17 が
別途・より精密に突き合わせているので、ここでは罰条以外で実際にドリフトした
履歴のある論点(免責文・ライセンス表記・チーム同期の呼称・支援者ガイドと各タブ)
を扱う。

設計方針(偽陽性対策)
--------------------
完全一致を要求すると実用にならないので、タグ除去・ゼロ幅文字除去・空白の
正規化をしてから比較する。それでも機械的な数値・条番号の突合は本文の
書き方(1つの<li>に複数の論点が併記される等)によって偽陽性が多発することが
実測で分かったため、「かんたん版/くわしく」の比較は構造が明確に1対1対応する
`.ngItem` ブロックに絞っている(範囲を絞った理由はその関数のdocstringに記す)。

使い方
------
    python3 build/check_drift.py        # 単体実行
    python3 build/check_drift.py -v      # OKも表示

precheck.py の G20 はこの run_checks() を呼ぶ。
"""
from __future__ import annotations
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ZW = re.compile("[​‌‍﻿­]+")


def read(path: str) -> str:
    f = ROOT / path
    return f.read_text(encoding="utf-8") if f.exists() else ""


def strip_tags(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text)


def norm(text: str) -> str:
    """タグ除去・ゼロ幅除去・空白の揺れ(全角/半角・連続空白)を吸収する。"""
    text = strip_tags(text)
    text = ZW.sub("", text)
    text = text.replace("　", " ")
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


# ───────────────────── 1. 免責文(責任の範囲)の逐語一致 ─────────────────────
# 過去にゲート・footer・マップツールの免責バーで「責任の範囲」の文言が
# 一部だけ更新され、残りが旧文言のままになった実例がある。
# 法的にもっとも重要な「軽過失/故意重過失/特別損害/一部無効」の核心部分を
# 正規表現で切り出し、言及箇所すべてで逐語一致するかを見る。
DISCLAIMER_CORE = re.compile(
    r"ご利用に関連して生じた損害.{0,80}?について.{0,400}?その他の部分の効力は妨げられません。",
    re.S,
)
DISCLAIMER_FILES = ["assets/common.js", "arukikata/index.html"]


def check_disclaimer_core() -> list[str]:
    found: dict[str, list[str]] = {}
    for p in DISCLAIMER_FILES:
        plain = norm(read(p))
        for i, m in enumerate(DISCLAIMER_CORE.finditer(plain), 1):
            found.setdefault(m.group(0), []).append(f"{p}#{i}")
    if not found:
        return ["免責文(責任の範囲)の核心部分が1件も見つからない(正規表現が本文とずれている可能性)"]
    if len(found) == 1:
        return []
    detail = "\n      ".join(f"{'/'.join(locs)}: 「{text[:50]}…」" for text, locs in found.items())
    return [f"免責文(責任の範囲)が{len(found)}通りある(片方だけ更新された疑い)\n      {detail}"]


# ───────────────────── 2. ライセンス名・URLの表記 ─────────────────────
# 「PolyForm Noncommercial License 1.0.0」の版番号が別の版に変わっていないか、
# URL が末尾スラッシュ付き(404になる)になっていないかを見る。
LICENSE_FILES = ["index.html", "arukikata/index.html", "posting/index.html", "poster/index.html",
                  "gaisen/index.html", "dist/poster_map_standalone.html", "dist/posting_map_standalone.html",
                  "README.md", "templates/team-sync/README.md", "assets/common.js"]
BAD_LICENSE_VERSION = re.compile(r"PolyForm Noncommercial License(?!\s*1\.0\.0)[^\n<`]{0,20}")
LICENSE_URL_SLASH = re.compile(r"https://polyformproject\.org/licenses/noncommercial/1\.0\.0(/)")


def check_license_name_url() -> list[str]:
    bad = []
    for p in LICENSE_FILES:
        t = read(p)
        if p == "LICENSE":
            continue
        for m in BAD_LICENSE_VERSION.finditer(t):
            bad.append(f"{p}: ライセンス名の版が1.0.0以外に見える: 「{m.group(0)[:40]}」")
        for m in LICENSE_URL_SLASH.finditer(t):
            bad.append(f"{p}: ライセンスURLが末尾スラッシュ付き(404になる): 「{m.group(0)}」")
    return bad


# ───────────────────── 3. チーム同期機能の呼称 ─────────────────────
# 機能名「チーム同期」・ボタンの表示「☁️ 同期」が、独立に手書きされている
# 場所(common.js・posting/index.html・README・テンプレ手順書)で
# 言い換えられていないかを見る。
TEAM_SYNC_PRESENCE_FILES = ["posting/index.html", "README.md",
                             "templates/team-sync/README.md"]
# assets/common.js は対象外: FAQ本文では常に「☁️ 同期」の形で言及し、「チーム同期」という
# 複合語そのものは使っていない(それ自体は不整合ではない)。ボタン表示の一致は別途
# BUTTON_LABEL_RE で見る。
BUTTON_LABEL = "☁️ 同期"
BUTTON_LABEL_RE = re.compile(r'>\s*☁️\s*同期\s*<|[「『]\s*☁️\s*同期\s*[」』]')


def check_team_sync_naming() -> list[str]:
    bad = []
    for p in TEAM_SYNC_PRESENCE_FILES:
        t = read(p)
        if "チーム同期" not in t:
            bad.append(f"{p}: 「チーム同期」という呼称が見つからない(改名されたまま他が追従していない疑い)")
    labels = set()
    for p in ["posting/index.html", "dist/posting_map_standalone.html"]:
        for m in re.finditer(r'id="syncBtn"[^>]*>([^<]*)<', read(p)):
            labels.add(m.group(1).strip())
    for p in ["README.md", "templates/team-sync/README.md"]:
        for m in BUTTON_LABEL_RE.finditer(read(p)):
            labels.add(re.sub(r"[「『」』<>]", "", m.group(0)).strip().lstrip(">").rstrip("<"))
    labels = {l for l in labels if l}
    if labels and labels != {BUTTON_LABEL}:
        bad.append(f"ボタン表示が揃っていない(期待値「{BUTTON_LABEL}」): {sorted(labels)}")
    return bad


# ───────────── 4. 「かんたん版」と「くわしく」の同一論点(.ngItem) ─────────────
# 本来は detailOnly/simpleOnly の対になっている箇所すべてを比較したいが、
# この文書では1つの<li>に複数の論点が併記されることが多く、li単位・段落単位の
# 条文番号の集合比較は実測で偽陽性ばかりだった(例: 1つのliに連呼規制と
# 自動車の乗車人員規制が両方書かれていて、別の話題同士が「不一致」と誤検出される)。
# 構造が明確に1対1対応する `.ngItem`(共通のNG一覧。かんたん文 → detailOnly)に
# 検査範囲を絞る。ここなら「かんたん文にも条文番号があるのに、くわしくの番号と
# 重ならない」場合だけを拾えるので、誤検出なしに意味のある検査になる。
ART = re.compile(r"\d+条(?:の\d+)?(?:第\d+項)?(?:\d+項)?(?:\d+号)?(?:の\d+)?")
NGITEM_PAIR = re.compile(
    r'<span class="ngItem">(.*?)<span class="detailOnly">(.*?)</span></span>', re.S
)


def check_kantan_kuwashiku_ngitem() -> list[str]:
    """かんたん版が「罰則あり」と言った項目は、くわしく側に罰条が書いてあるか。

    ★2026-10-12 に2度作り直した経緯を残す(同じ罠に戻らないため)。
      1度目: .ngItem の条文番号を突き合わせる設計だったが、正規表現が本文と合わず
             **実比較が0組**で永久に何も検出しなかった(critical-reviewer M-4)。
      2度目: かんたん版の見出し語がくわしく側に出てくるかを見る設計にしたが、
             見出し語が長文で逐語一致せず**偽陽性が8件**出た。公開を止める検査で
             偽陽性を出すと検査自体が信用されなくなるので採らなかった。
      3度目(現行): 層のルール「かんたん版＝結論＋罰則の有無のみ／条文と刑量はくわしく」
             を不変条件として検査する。**かんたん版が「罰則あり」と書いた項目があるのに、
             同じカードのくわしく側に罰条(条番号＋刑量)が1つも無い**状態だけを落とす。
             これは必ず直すべき食い違いで、偽陽性が出にくい。
      ※かんたん版に罰則の記載が無い項目については何も要求しない。
        「チラシお断りのポストへ入れる(苦情・トラブルの最大の原因)」のように、
        罰則を主張していない書き分けは正しい設計なので検査対象にしない。
    """
    t = read("arukikata/index.html")
    cards = re.findall(r'<details class="helpCard".*?</details>', t, re.S)
    if not cards:
        return ["支援者ガイドのカードが1枚も見つからない(構造が変わった可能性)"]
    PENALTY = re.compile(r"(?:\d+年以下の拘禁刑|\d+万円以下の罰金|拘禁刑|科料|拘留)")
    ARTICLE = re.compile(r"\d+条")
    bad, checked = [], 0
    for ci, card in enumerate(cards, 1):
        ng = re.search(r'<ul class="hcList hcNG">(.*?)</ul>', card, re.S)
        det = re.search(r'<div class="hcDetail[^"]*">(.*?)</div>\s*</details>', card, re.S) \
            or re.search(r'<div class="hcDetail[^"]*">(.*?)$', card, re.S)
        if not ng or not det:
            continue
        claims = [norm(li) for li in re.findall(r"<li>(.*?)</li>", ng.group(1), re.S)
                  if "罰則" in norm(li)]
        if not claims:
            continue
        checked += 1
        d = norm(det.group(1))
        if not (PENALTY.search(d) and ARTICLE.search(d)):
            bad.append(f'カード{ci}: かんたん版が「罰則あり」と書いているのに'
                       f'くわしく側に罰条(条番号＋刑量)が無い — 例「{claims[0][:40]}」')
    if checked == 0:
        return ["かんたん版に「罰則あり」と書いた項目が1つも無い"
                "(層のルールが崩れた可能性。結論＋罰則の有無はかんたん版に置く約束)"]
    if bad:
        return [f"かんたん版の罰則の主張にくわしく側の裏づけが無いカードが{len(bad)}件"
                f"\n      " + "\n      ".join(bad)]
    return []

# ───────────── 5. 支援者ガイドと各タブの条文言及(整合性) ─────────────
# 過去に「支援者ガイドだけ直し忘れる」事故が2回(201条の15の件・住居侵入罪の
# 断定の件)起きている。支援者ガイド(id="sHelp")の中だけに出てくる条文番号は、
# 他タブとの整合を取り忘れている可能性があるので洗い出す。
# allowlist: 以下は実際に確認済みで、支援者ガイド固有の脚注的な言及であり、
# 他タブに対応箇所が無いことが「ドリフト」ではないと判断したもの。
#   - "102条"(国家公務員法。地位利用の服務規程の例として注記されているだけ)
#   - "187条2項"(187条1項の但し書の精算規定。187条1項自体は複数箇所にあるが
#     2項のピンポイント言及はガイドにしかなく、他タブと矛盾するわけではない)
GUIDE_CITATION_ALLOWLIST = {"102条", "187条2項"}


def check_guide_vs_tabs() -> list[str]:
    t = read("arukikata/index.html")
    m1 = re.search(r'<section id="sHelp"', t)
    if not m1:
        return ["id=\"sHelp\"(支援者ガイド)のセクションが見つからない(マークアップが変わった可能性)"]
    m2 = re.search(r'<section id="', t[m1.end():])
    if not m2:
        return ["支援者ガイドの終端(次のsection)が見つからない"]
    guide_html = t[m1.start(): m1.end() + m2.start()]
    rest_html = t[:m1.start()] + t[m1.end() + m2.start():]

    guide_tokens = set(ART.findall(strip_tags(guide_html)))
    rest_tokens = set(ART.findall(strip_tags(rest_html)))

    only_in_guide = sorted(
        tok for tok in guide_tokens
        if tok not in GUIDE_CITATION_ALLOWLIST
        and tok not in rest_tokens
        and not any(tok in r or r in tok for r in rest_tokens)
    )
    if only_in_guide:
        return [
            "支援者ガイドにしか出てこない条文番号がある"
            "(他タブとの整合を確認。意図的なら build/check_drift.py の allowlist に追記): "
            + ", ".join(only_in_guide)
        ]
    return []


CHECKS = [
    ("disclaimer_core", "免責文(責任の範囲)の逐語一致", check_disclaimer_core),
    ("license_name_url", "ライセンス名・URLの表記", check_license_name_url),
    ("team_sync_naming", "チーム同期機能の呼称", check_team_sync_naming),
    ("kantan_kuwashiku_ngitem", "かんたん版/くわしくの同一論点(ngItem)", check_kantan_kuwashiku_ngitem),
    ("guide_vs_tabs", "支援者ガイドと各タブの条文整合", check_guide_vs_tabs),
]


def run_checks(verbose: bool = False) -> list[str]:
    """全グループを実行し、問題点の文字列リストを返す(空リスト=問題なし)。"""
    problems: list[str] = []
    for cid, title, fn in CHECKS:
        issues = fn()
        if issues:
            problems.extend(f"[{cid}] {title}: {msg}" for msg in issues)
        elif verbose:
            print(f"  ✅ {cid}: {title}")
    return problems


def main() -> int:
    v = "-v" in sys.argv or "--verbose" in sys.argv
    problems = run_checks(verbose=v)
    if problems:
        print(f"senkyo-maps ドリフト検査(G20)  ({ROOT})\n")
        for p in problems:
            print(f"❌ {p}\n")
        print(f"NG {len(problems)}件")
        return 1
    print(f"✅ ドリフト検査(G20) 全{len(CHECKS)}項目OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
