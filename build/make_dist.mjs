// 配布用の単一ファイルHTML(dist/*.html)を生成する。
// - assets/common.css・common.js をインライン化
// - ポスターマップはサンプルデータを同梱(file:// では fetch が使えないため)
// - デモ動画は公開URLの絶対参照に置換(動画・地図タイル・Leaflet CDN は要ネット接続)
// 使い方: node build/make_dist.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const BASE = "https://yukinobu-nakamura.github.io/senkyo-maps/";
const css = readFileSync("assets/common.css", "utf8");
const js = readFileSync("assets/common.js", "utf8");
const boards = readFileSync("data/boards.sample.json", "utf8");

mkdirSync("dist", { recursive: true });

// 置換が1件も当たらなかったら異常(ページ側のパス変更に追従できていない)として落とす。
// 例: common.css のインライン化に失敗したまま配布版を出すと、無スタイルのHTMLを配ることになる。
function must(html, re, repl, label) {
  if (!re.test(html)) throw new Error(`make_dist: 置換対象が見つかりません [${label}] — ${re}`);
  return html.replace(re, repl);
}

function build(src, out, extraHead) {
  let html = readFileSync(src, "utf8");
  // 各ページは <page>/index.html 配置のため、共通アセットは "../assets/" 参照
  html = must(html, /<link rel="stylesheet" href="\.\.\/assets\/common\.css[^"]*">/,
    () => `<style>\n${css}\n</style>`, "common.css");
  html = must(html, /<script src="\.\.\/assets\/common\.js[^"]*"><\/script>/,
    () => `<script>\n${js}\n<\/script>${extraHead}`, "common.js");
  html = must(html, /src="\.\.\/assets\/(\w+_demo\.mp4[^"]*)"/g,
    (_, p) => `src="${BASE}assets/${p}"`, "demo動画");
  // データ(世帯数レイヤ・サンプル掲示場等)は公開URLから取得(file:// では相対fetchが使えないため)
  html = must(html, /fetch\("\.\.\/data\//g, `fetch("${BASE}data/`, "data取得");
  // 配布版内の相対リンクは公開サイトの絶対URLへ(file:// で開かれるため)
  // ※全体リリース(2026-09-12)以降は原本URLを表示する方針
  html = must(html, /href="\.\.\/dist\/([^"]+)"/g,
    (_, p) => `href="${BASE}dist/${p}"`, "dist配布版リンク");
  html = must(html, /href="\.\.\/"/g, `href="${BASE}"`, "トップへ戻るリンク");
  // 配布版の注記: サンプルバーの後ろに追記(原本URLを明示)
  html = html.replace("</header>",
    `</header>\n<div class="samplebar" style="background:#eef2ff; border-bottom-color:#6366f1; color:#3730a3;">📄 これは配布用ファイル版です。このHTMLファイルを渡せば誰でも使えます(動作にはインターネット接続が必要)。原本・最新版: <a href="${BASE}">${BASE}</a></div>`);
  writeFileSync(out, html);
  console.log(`${out}: ${(html.length / 1024).toFixed(0)}KB`);
}

build("poster/index.html", "dist/poster_map_standalone.html",
  `\n<script>window.EMBEDDED_BOARDS = ${boards.trim()};<\/script>`);
build("posting/index.html", "dist/posting_map_standalone.html", "");
