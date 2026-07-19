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

function build(src, out, extraHead) {
  let html = readFileSync(src, "utf8");
  html = html.replace(/<link rel="stylesheet" href="assets\/common\.css[^"]*">/,
    () => `<style>\n${css}\n</style>`);
  html = html.replace(/<script src="assets\/common\.js[^"]*"><\/script>/,
    () => `<script>\n${js}\n<\/script>${extraHead}`);
  html = html.replace(/src="assets\/(\w+_demo\.mp4[^"]*)"/g, (_, p) => `src="${BASE}assets/${p}"`);
  // 配布版内の相対リンクは公開サイトの絶対URLへ(file:// で開かれるため)
  html = html.replace(/href="dist\/([^"]+)"/g, (_, p) => `href="${BASE}dist/${p}"`);
  html = html.replace(/href="index\.html"/g, `href="${BASE}"`);
  // 配布版の注記: サンプルバーの後ろに追記
  html = html.replace("</header>",
    `</header>\n<div class="samplebar" style="background:#eef2ff; border-bottom-color:#6366f1; color:#3730a3;">📄 これは配布用ファイル版です。このHTMLファイルを渡せば誰でも使えます(動作にはインターネット接続が必要)。最新版: <a href="${BASE}">${BASE}</a></div>`);
  writeFileSync(out, html);
  console.log(`${out}: ${(html.length / 1024).toFixed(0)}KB`);
}

build("poster.html", "dist/poster_map_standalone.html",
  `\n<script>window.EMBEDDED_BOARDS = ${boards.trim()};<\/script>`);
build("posting.html", "dist/posting_map_standalone.html", "");
