// assets/common.css・common.js の内容ハッシュから版数(?v=)を決め、参照している
// 全HTMLの ?v= を一括更新する。
//
// なぜ要るか
// ----------
// 今まで ?v=38 のような連番を手で書き換えていた。数え間違い・更新漏れ(G3が
// 検出する「3ページで?v=が不一致」)の原因になっていたので、中身(css+js)から
// 一意に決まる値に機械化する。
//
// 版数の決め方
// ------------
// sha256(common.css の内容 + common.js の内容) の先頭8文字(16進)。
// 中身が1バイトも変わらなければ毎回同じ値になるので、無駄なキャッシュ破棄(=
// 中身が同じなのにブラウザに再ダウンロードさせる)が起きない。
//
// 使い方: node build/stamp_assets.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ROOT = new URL("..", import.meta.url).pathname;

// 版数を参照している全HTML。index.html・arukikata/index.html は現時点では
// assets/common.css・common.js を読み込んでいない(自己完結ページ)ため ?v= が
// 無いが、将来読み込むようになっても追従できるよう対象に含めておく。
const TARGET_FILES = [
  "index.html",
  "arukikata/index.html",
  "posting/index.html",
  "poster/index.html",
  "gaisen/index.html",
  "dist/poster_map_standalone.html",
  "dist/posting_map_standalone.html",
];

function computeVersion() {
  const css = readFileSync(ROOT + "assets/common.css");
  const js = readFileSync(ROOT + "assets/common.js");
  const hash = createHash("sha256");
  hash.update(css);
  hash.update(js);
  return hash.digest("hex").slice(0, 8);
}

// 相対パスの深さ(../assets/ か assets/ か)を問わず、common.css?v=.. /
// common.js?v=.. を拾う。
const VERSION_RE = /((?:\.\.\/)?assets\/common\.(?:css|js))\?v=[0-9a-zA-Z]+/g;

function stampFile(relPath, version) {
  const path = ROOT + relPath;
  let before;
  try {
    before = readFileSync(path, "utf8");
  } catch (e) {
    return { relPath, status: "missing", hits: 0 };
  }
  let hits = 0;
  const after = before.replace(VERSION_RE, (_, prefix) => {
    hits += 1;
    return `${prefix}?v=${version}`;
  });
  if (hits === 0) {
    return { relPath, status: "no-ref", hits: 0 };
  }
  if (after === before) {
    return { relPath, status: "unchanged", hits };
  }
  writeFileSync(path, after);
  return { relPath, status: "updated", hits };
}

function main() {
  const version = computeVersion();
  console.log(`版数(内容ハッシュ先頭8桁): ${version}\n`);
  let updated = 0;
  for (const relPath of TARGET_FILES) {
    const r = stampFile(relPath, version);
    const label = {
      missing: "⏭  ファイルが無い",
      "no-ref": "⏭  ?v= の参照なし(対象外のページ)",
      unchanged: `✅ 変更なし(既に v=${version}・${r.hits}箇所)`,
      updated: `✏️  更新(${r.hits}箇所を v=${version} に)`,
    }[r.status];
    console.log(`${relPath}: ${label}`);
    if (r.status === "updated") updated += 1;
  }
  console.log(`\n${updated}件のファイルを更新しました。`);
  return 0;
}

process.exit(main());
