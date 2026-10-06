#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""senkyo-maps 公開前チェック

なぜ作ったか
------------
法務レビューを3回かけても毎回新しい指摘が出続けた。原因はレビューの精度ではなく
**適用プロセス**にあった(17名体制の総点検で確定)。

  - 同一論点が平均3.4箇所に散っているのに、修正が1箇所ずつ当てられていた
  - 構造(表示の仕組み)を直す前に文言を当て、既定で見えない面に加筆していた
  - 機械チェックが1本も無かった

このスクリプトは「**同じ論点が複数箇所にあること**」そのものを検査対象にする。
1箇所だけ直った状態を EXIT=1 で落とす。

使い方
------
    python3 build/precheck.py            # 全チェック
    python3 build/precheck.py -v         # 詳細(OKの検査も表示)
    python3 build/precheck.py --only G1  # 特定の検査だけ

終了コード: 0=問題なし / 1=NGあり
"""
from __future__ import annotations
import re, sys, os, json, subprocess, tempfile, shutil, filecmp
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V = "-v" in sys.argv or "--verbose" in sys.argv
ONLY = None
for i, a in enumerate(sys.argv):
    if a == "--only" and i + 1 < len(sys.argv):
        ONLY = sys.argv[i + 1].upper()

NG: list[tuple[str, str]] = []   # (検査ID, メッセージ)
OK: list[str] = []
SKIP: list[str] = []

PAGES = ["posting/index.html", "poster/index.html", "gaisen/index.html"]
SRC_HTML = ["index.html", "arukikata/index.html"] + PAGES
DIST = ["dist/poster_map_standalone.html", "dist/posting_map_standalone.html"]
ALL_HTML = SRC_HTML + DIST
ASSETS = ["assets/common.js", "assets/common.css"]


def read(p: str) -> str:
    f = ROOT / p
    return f.read_text(encoding="utf-8") if f.exists() else ""


def lines(p: str) -> list[str]:
    return read(p).split("\n")


def ng(cid: str, msg: str):
    NG.append((cid, msg))


def ok(cid: str, msg: str):
    OK.append(f"{cid}: {msg}")


def run(cid: str, title: str, fn):
    if ONLY and not cid.startswith(ONLY):
        SKIP.append(cid)
        return
    try:
        fn(cid)
    except Exception as e:  # 検査自体の失敗もNG扱い(黙って通さない)
        ng(cid, f"{title} の検査自体が失敗: {type(e).__name__}: {e}")


# ───────────────────────────── G-1 日付の単一情報源 ─────────────────────────────
DATE_PATS = [
    (r"最終更新日\((20\d\d年\d{1,2}月\d{1,2}日)\)時点", "①免責の基準日"),
    (r"内容は(20\d\d年\d{1,2}月\d{1,2}日)時点の法令", "②冒頭の時点表示"),
    (r"(20\d\d年\d{1,2}月)時点の e-Gov", "③フッタの参照時点"),
    (r"最終更新日:\s*(20\d\d-\d{2}-\d{2})", "④フッタの最終更新日"),
    (r'GATE_VER\s*=\s*"(20\d\d-\d{2}-\d{2})"', "⑤同意ゲートの版"),
]


def norm_date(s: str) -> str:
    m = re.match(r"(20\d\d)年(\d{1,2})月(?:(\d{1,2})日)?", s)
    if m:
        y, mo, d = m.group(1), int(m.group(2)), m.group(3)
        return f"{y}-{mo:02d}" + (f"-{int(d):02d}" if d else "")
    return s


def g1(cid):
    found = {}
    # assets も見る: 免責バー(common.js)が基準日を持つため、ここが取り残されると
    # 「HTMLだけ直してマップ側は旧日付」という片側だけの修正を見逃す
    for p in SRC_HTML + ASSETS:
        t = read(p)
        for pat, label in DATE_PATS:
            for m in re.finditer(pat, t):
                found.setdefault(norm_date(m.group(1)), []).append(f"{p} {label} 「{m.group(1)}」")
    if not found:
        ng(cid, "日付の表示が1つも見つからない(正規表現が本文とずれている可能性)")
        return
    # 年月だけのもの(③)は、年月日のものと前方一致すれば同一とみなす
    full = {k for k in found if len(k) == 10}
    loose = {k for k in found if len(k) == 7}
    bad = {k for k in loose if not any(f.startswith(k) for f in full)}
    if len(full) > 1 or bad:
        detail = "\n      ".join(f"{k} ← {' / '.join(vs)}" for k, vs in sorted(found.items()))
        ng(cid, f"日付が{len(found)}通りある(免責の基準日が確定しない)\n      {detail}")
    else:
        ok(cid, f"日付は1つに揃っている({sorted(found)[-1]}・{sum(len(v) for v in found.values())}箇所)")


# ───────────────────────── G-2 Required Notice の逐語一致 ─────────────────────────
NOTICE_FULL = "Required Notice: Copyright (c) 2026 Yukinobu Nakamura (https://github.com/Yukinobu-Nakamura/senkyo-maps)"


def g2(cid):
    targets = SRC_HTML + ASSETS + ["LICENSE", "README.md",
                                   "templates/team-sync/Code.gs", "templates/team-sync/README.md"]
    bad = []
    total = 0
    for p in targets:
        t = read(p)
        if p == "LICENSE":
            # PolyForm の原文(Notices 条項の説明文と「Yoyodyne」の例示)は上流のライセンス本文で
            # 1字も変えられない。検査するのは自作部分(PolyForm 本文より前)だけにする。
            # ここを広げると、原文の例示を直さないかぎり永久にNGが出続け、検査が信用されなくなる。
            head = t.split("# PolyForm Noncommercial License 1.0.0")[0]
            t = head if head != t else t
        for m in re.finditer(r"Required Notice:[^\n<`]*", t):
            total += 1
            s = m.group(0).strip().rstrip("`").strip()
            if s != NOTICE_FULL:
                bad.append(f"{p}: 「{s[:90]}」")
    if total == 0:
        ng(cid, "Required Notice が1件も見つからない")
    elif bad:
        ng(cid, f"LICENSE 1行目と逐語一致しないものが{len(bad)}件\n      " + "\n      ".join(bad))
    else:
        ok(cid, f"全{total}箇所が逐語一致")


# ───────────────────────── G-3 cache bust の整合 ─────────────────────────
def g3(cid):
    vs = {}
    for p in PAGES:
        for m in re.finditer(r"assets/common\.(?:css|js)\?v=(\d+)", read(p)):
            vs.setdefault(m.group(1), []).append(p)
    if not vs:
        ng(cid, "?v= が見つからない")
    elif len(vs) > 1:
        ng(cid, "?v= が不一致: " + " / ".join(f"v={k}:{sorted(set(v))}" for k, v in vs.items()))
    else:
        ok(cid, f"3ページとも ?v={list(vs)[0]}")


# ───────────────────────── G-4 dist が原本と同期しているか ─────────────────────────
def g4(cid):
    if not (ROOT / "build/make_dist.mjs").exists():
        ng(cid, "build/make_dist.mjs が無い")
        return
    tmp = Path(tempfile.mkdtemp(prefix="precheck_dist_"))
    try:
        for d in DIST:
            shutil.copy2(ROOT / d, tmp / Path(d).name)
        r = subprocess.run(["node", "build/make_dist.mjs"], cwd=ROOT,
                           capture_output=True, text=True, timeout=180)
        if r.returncode != 0:
            ng(cid, f"make_dist.mjs が失敗(exit={r.returncode}): {(r.stderr or r.stdout)[-300:]}")
            return
        diff = [d for d in DIST if not filecmp.cmp(ROOT / d, tmp / Path(d).name, shallow=False)]
        if diff:
            ng(cid, "dist が原本から再生成した内容と違う(再生成してコミットすること): " + ", ".join(diff))
        else:
            ok(cid, "dist は原本と同期している")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ───────────────────────── G-5 件数のハードコード禁止 ─────────────────────────
def g5(cid):
    bad = []
    for p in ASSETS + ALL_HTML:
        for i, l in enumerate(lines(p), 1):
            for m in re.finditer(r"よくある質問[^<\n]{0,12}?\((\d+)問\)|\((\d+)問\)", l):
                bad.append(f"{p}:{i} 「{m.group(0)}」")
    if bad:
        ng(cid, "FAQの件数が固定で書かれている(問数を変えるとずれる・動的化すること)\n      " + "\n      ".join(bad[:8]))
    else:
        ok(cid, "件数のハードコードなし")


# ───────────────────────── G-6 ゼロ幅文字 ─────────────────────────
ZW = re.compile("[​‌‍⁠­]+")


def g6(cid):
    allow = ROOT / "build/zwsp_allowlist.txt"
    allowed = set()
    if allow.exists():
        allowed = {l.strip() for l in allow.read_text(encoding="utf-8").split("\n") if l.strip() and not l.startswith("#")}
    bad = []
    for p in SRC_HTML + ASSETS + DIST:
        for i, l in enumerate(lines(p), 1):
            for m in ZW.finditer(l):
                key = f"{p}:{i}"
                if key not in allowed and p not in allowed:
                    bad.append(f"{key} (ゼロ幅{len(m.group(0))}字)")
    if bad:
        ng(cid, "許可リストに無いゼロ幅文字がある(build/zwsp_allowlist.txt に file:line か file を追記して許可)\n      "
                + "\n      ".join(bad[:10]))
    else:
        ok(cid, "ゼロ幅文字は許可リストの範囲内")


# ───────────────────────── G-7 条文リンクにアンカーがあるか ─────────────────────────
def g7(cid):
    bad = []
    n = 0
    for p in SRC_HTML:
        for i, l in enumerate(lines(p), 1):
            for m in re.finditer(r'href="(https://laws\.e-gov\.go\.jp/law/[^"]*)"', l):
                n += 1
                if "#" not in m.group(1):
                    bad.append(f"{p}:{i} {m.group(1)}")
    if bad:
        ng(cid, f"条文リンク{len(bad)}本にアンカー(#Mp-…)が無く、法令の先頭にしか飛ばない\n      "
                + "\n      ".join(bad[:10]))
    else:
        ok(cid, f"条文リンク{n}本すべてにアンカーあり")


# ───────────────── G-8 かんたん版から参照先に到達できるか ─────────────────
REF = re.compile(r"下の[「『][^」』\n]{0,24}[」』]|下の注記|上の表|下の表")


def g8(cid):
    p = "arukikata/index.html"
    ls = lines(p)
    bad = []
    for i, l in enumerate(ls, 1):
        if "detailOnly" in l:
            continue
        m = REF.search(l)
        if not m:
            continue
        # 参照先らしき語が detailOnly の行にしか無いか
        key = re.sub(r"^.*?[「『]|[」』].*$", "", m.group(0)) or "注記"
        hits = [(j, x) for j, x in enumerate(ls, 1) if key and key in x and j != i]
        if hits and all("detailOnly" in x for _, x in hits):
            bad.append(f"{p}:{i} 「{m.group(0)}」→ 参照先が『くわしく』側にしか無い")
    if bad:
        ng(cid, "かんたん版から参照先に到達できない\n      " + "\n      ".join(bad[:10]))
    else:
        ok(cid, "かんたん版からの参照は到達可能")


# ───────────────────────── G-9 全消去で消し漏れが無いか ─────────────────────────
def g9(cid):
    p = "posting/index.html"
    t = read(p)
    defined = set(re.findall(r'const (KEY_[A-Z_]+)\s*=', t))
    m = re.search(r'getElementById\("resetBtn"\)\.onclick\s*=\s*\(\)\s*=>\s*\{(.*?)\n\};', t, re.S)
    if not m:
        ng(cid, f"{p} の全消去ハンドラが見つからない(検査の前提が崩れている)")
        return
    body = m.group(1)
    cleared = set(re.findall(r"(KEY_[A-Z_]+)", body))
    miss = sorted(defined - cleared)
    if miss:
        ng(cid, f"全消去で消していないキー: {', '.join(miss)}(共用端末に実名・同期トークンが残る)")
    else:
        ok(cid, f"定義済み{len(defined)}キーをすべて消去")


# ───────────────────── G-12 「○つ」と実際の項目数の一致 ─────────────────────
def g12(cid):
    bad = []
    for p in SRC_HTML:
        t = read(p)
        for m in re.finditer(r"共通のNG[（(](\d+)つ[）)]", t):
            said = int(m.group(1))
            seg = t[m.end():m.end() + 4000]
            real = len(re.findall(r'class="ngItem"', seg))
            if real and real != said:
                bad.append(f"{p}: 「{said}つ」と書いてあるが項目は{real}個")
    if bad:
        ng(cid, "見出しの数と項目数が合っていない\n      " + "\n      ".join(bad))
    else:
        ok(cid, "数の表記と項目数は一致")


# ───────────────── G-15 本文の誘導名が実際のボタン名と一致するか ─────────────────
def g15(cid):
    p = "arukikata/index.html"
    t = read(p)
    labels = set()
    for m in re.finditer(r'class="(?:cdBtn|htBtn)[^"]*"[^>]*>([^<]+)<', t):
        labels.add(m.group(1).strip())
    if not labels:
        SKIP.append(cid)
        return
    bad = []
    for i, l in enumerate(lines(p), 1):
        for m in re.finditer(r"[「『]([📖🟢][^」』<\n]{1,24})[」』]", l):
            name = m.group(1).strip()
            if not any(name in lb or lb in name for lb in labels):
                bad.append(f"{p}:{i} 本文「{name}」 ≠ 実ボタン {sorted(labels)}")
    if bad:
        ng(cid, "本文の誘導名が画面のボタン名と違う(押すべきボタンが見つからない)\n      " + "\n      ".join(bad[:8]))
    else:
        ok(cid, f"誘導名はボタン名と一致({len(labels)}種)")


# ───────────── G-16 モード切替の対象配列に全パネルが入っているか ─────────────
def g16(cid):
    p = "arukikata/index.html"
    t = read(p)
    m = re.search(r"ids\s*=\s*\[([^\]]*)\]", t)
    if not m:
        SKIP.append(cid)
        return
    ids = set(re.findall(r'"([^"]+)"', m.group(1)))
    bad = []
    for pm in re.finditer(r'<(?:div|section)[^>]*id="([A-Za-z0-9_]+)"[^>]*class="[^"]*panel[^"]*"', t):
        pid = pm.group(1)
        seg = t[pm.end():pm.end() + 60000]
        end = seg.find('class="panel')
        seg = seg[:end] if end > 0 else seg
        if ("detailOnly" in seg or "simpleOnly" in seg) and pid not in ids:
            bad.append(f"#{pid} に detailOnly/simpleOnly があるが ids に入っていない")
    if bad:
        ng(cid, "切替の対象外の領域に『かんたん/くわしく』の出し分けがある(どのモードでも出ない/消えない)\n      "
                + "\n      ".join(bad))
    else:
        ok(cid, f"出し分けのある領域はすべて ids({len(ids)}件)に入っている")


# ───────────────────── G-18 既知の誤りの再発検知 ─────────────────────
KNOWN = [
    (r"21条の2第2項", "規正法21条の2は第1項のみ。第2項は存在しない"),
    (r"201条の15.{0,80}243条1項3号|243条1項3号.{0,80}201条の15", "201条の15違反の罰条は252条の3第1項(100万円)"),
    (r"撤去規定ものぼりには存在せず", "147条・243条1項4号と逆向き"),
    (r"明確に違法とまではされていません", "答弁書の読み違い"),
    (r"選挙広報", "正しくは『選挙公報』"),
    (r"3つとも共通", "項目数と不整合になりやすい表現"),
    (r"候補者個人.{0,40}5,000万円|5,000万円.{0,40}候補者個人", "22条1項の5,000万円は政治団体→政治団体の上限"),
]


def g18(cid):
    bad = []
    for p in SRC_HTML + ASSETS:
        for i, l in enumerate(lines(p), 1):
            for pat, why in KNOWN:
                if re.search(pat, l):
                    bad.append(f"{p}:{i} 「{pat}」— {why}")
    if bad:
        ng(cid, f"過去に是正した誤りが再発している({len(bad)}件)\n      " + "\n      ".join(bad[:10]))
    else:
        ok(cid, f"既知の誤り{len(KNOWN)}パターンの再発なし")


# ───────────────────── G-19 無条件の⭕(条件・罰則の併記漏れ) ─────────────────────
def g19(cid):
    """『⭕』が付いた項目(li/td)に、条件・例外・罰則の手がかりが何も無いものを拾う。
    見出し(h3/h4/b単独)とCSSは対象外。"""
    p = "arukikata/index.html"
    bad = []
    in_style = False
    for i, l in enumerate(lines(p), 1):
        if "<style" in l:
            in_style = True
        if "</style>" in l:
            in_style = False
            continue
        if in_style or "⭕" not in l:
            continue
        if not re.search(r"<(?:li|td)\b", l):      # 項目セル以外(見出し等)は対象外
            continue
        if re.search(r"平時|条件|期間中|ただし|限り|除き|罰則|禁止|選管|確認|注意|おそれ|違反|条\)|条・|条の", l):
            continue
        txt = re.sub(r"<[^>]+>", "", l).strip()
        if len(txt) > 12:
            bad.append(f"{p}:{i} {txt[:70]}")
    if bad:
        ng(cid, f"条件・例外の併記が無い『⭕』が{len(bad)}件(無条件に可と読める)\n      " + "\n      ".join(bad[:10]))
    else:
        ok(cid, "『⭕』はすべて条件つきで書かれている")


# ───────────────── G-21 ワークスペース側の控えとの一致 ─────────────────
def g21(cid):
    mirror = Path.home() / "projects/nakamura-ws/20_Seimu/senkyo_arukikata/公開前保管/arukikata_公開前保管_C1.html"
    if not mirror.exists():
        ok(cid, "ワークスペース側の旧版控えは存在しない(一本化済み)")
        return
    a = (ROOT / "arukikata/index.html").read_text(encoding="utf-8")
    b = mirror.read_text(encoding="utf-8")
    if a == b:
        ok(cid, "控えは公開版と一致")
    else:
        ng(cid, f"ワークスペース側に公開版と異なる旧版HTMLが残っている(古い誤りがメンバーへ渡る)\n      {mirror}")


CHECKS = [
    ("G1", "日付の単一情報源", g1),
    ("G2", "Required Notice の逐語一致", g2),
    ("G3", "cache bust の整合", g3),
    ("G4", "dist と原本の同期", g4),
    ("G5", "件数のハードコード", g5),
    ("G6", "ゼロ幅文字", g6),
    ("G7", "条文リンクのアンカー", g7),
    ("G8", "かんたん版からの到達性", g8),
    ("G9", "全消去の消し漏れ", g9),
    ("G12", "数の表記と項目数", g12),
    ("G15", "誘導名とボタン名", g15),
    ("G16", "モード切替の到達性", g16),
    ("G18", "既知の誤りの再発", g18),
    ("G19", "無条件の⭕", g19),
    ("G21", "ワークスペース控えとの一致", g21),
]


def main():
    print(f"senkyo-maps 公開前チェック  ({ROOT})\n")
    for cid, title, fn in CHECKS:
        run(cid, title, fn)
    if V:
        for l in OK:
            print(f"  ✅ {l}")
        if SKIP:
            print(f"  ⏭  スキップ: {', '.join(SKIP)}")
        print()
    if NG:
        for cid, msg in NG:
            title = next((t for c, t, _ in CHECKS if c == cid), cid)
            print(f"❌ [{cid}] {title}\n      {msg}\n")
        print(f"NG {len(NG)}件 / OK {len(OK)}件 — 直してから公開してください")
        return 1
    print(f"✅ 全{len(OK)}項目OK" + (f" (スキップ {len(SKIP)})" if SKIP else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
