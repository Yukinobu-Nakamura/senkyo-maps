/**
 * ポスティングマップ チーム同期バックエンド(Google Apps Script)
 * =============================================================
 * このスクリプトは「利用チーム自身のGoogleアカウント」に設置して使います。
 * データはあなたのチームのスプレッドシートにのみ保存され、
 * ツール作成者には一切送信されません(作成者はサーバを運営しません)。
 *
 * 設置手順は同じフォルダの README.md を参照。
 *
 * 仕様:
 *  - POST {token, features, deleted} → fid をキーに upsert(mtime の新しい方を採用)。
 *    deleted: [{fid, mtime}] は削除の伝播(トゥームストーン)。
 *    応答に全状態(features / deletedList)も載せるので、受信のためのGETは不要
 *  - GET  ?token=...            → 全図形(削除済みを除く)を GeoJSON FeatureCollection で返す
 *    ※旧版クライアントとの互換のために残しているだけ。合言葉がURLに載り、
 *      Google側の実行ログ・社内プロキシ・スクリーンショットに残るので新版は使わない
 *  - シート列: fid | mtime | owner | deleted | feature(JSON)
 *
 * ライセンス: PolyForm Noncommercial License 1.0.0
 * Required Notice: Copyright (c) 2026 Yukinobu Nakamura (https://github.com/Yukinobu-Nakamura/senkyo-maps)
 */

/* ▼▼ 設置時にここを必ず変更してください(推測されにくい長い文字列に) ▼▼
   変えないと下の setupError_() が全リクエストを弾くので、同期は動きません。
   (既定値はこの公開リポジトリに平文で書いてあります。変え忘れたまま公開すると、
    URLを知った人が誰でもチームの全データを読み書き・削除できてしまいます) */
const TOKEN = "CHANGE_ME_TO_LONG_RANDOM_STRING";
/* ▲▲ ここまで ▲▲ */

const SHEET_NAME = "sync";
const HEADER = ["fid", "mtime", "owner", "deleted", "feature"];
/* 変えたら上げる。クライアントが「倉庫が古い版か」を判定するのに使う */
const BACKEND_VERSION = "2026-10-06";
/* Googleスプレッドシートの1セル上限は50,000文字。超える値を setValues すると例外になり、
   GASがHTMLのエラーページを返すのでクライアント側は原因不明の失敗になる。
   余裕をみて 49,000 文字を超える図形は保存しない(点数の多いGPXルートが該当)。 */
const CELL_LIMIT = 49000;

/* 設置時に TOKEN を変え忘れたまま公開されるのを防ぐガード。
   既定値・空・短すぎる値のときは、正しい合言葉を送っても一切応答しない。 */
function setupError_() {
  if (TOKEN === "CHANGE_ME_TO_LONG_RANDOM_STRING" || !TOKEN || String(TOKEN).length < 20) {
    return "setup: Apps Script の TOKEN を20文字以上のランダム文字列に変更して、再デプロイ(デプロイを管理→編集→バージョン: 新バージョン→デプロイ)してください";
  }
  return null;
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADER);
  }
  return sh;
}

function readAll_() {
  const sh = getSheet_();
  const rows = sh.getDataRange().getValues();
  const map = {}; // fid -> {rowIndex, mtime, owner, deleted, feature}
  for (let i = 1; i < rows.length; i++) {
    const [fid, mtime, owner, deleted, feature] = rows[i];
    if (!fid) continue;
    map[String(fid)] = { rowIndex: i + 1, mtime: Number(mtime) || 0, owner: String(owner || ""), deleted: !!deleted, feature: String(feature || "") };
  }
  return map;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* シートの内容を「受信用の全状態」に組み立てる(doGet と doPost の応答で共用) */
function snapshot_(map) {
  const features = [];
  const tombs = [];
  Object.keys(map).forEach(fid => {
    const r = map[fid];
    if (r.deleted) { tombs.push({ fid: fid, mtime: r.mtime }); return; }
    if (!r.feature) return;
    try { features.push(JSON.parse(r.feature)); } catch (err) { /* 壊れた行はスキップ */ }
  });
  return { features: features, deleted: tombs };
}

function doGet(e) {
  const se = setupError_();
  if (se) return json_({ error: se });
  if (!e || !e.parameter || e.parameter.token !== TOKEN) return json_({ error: "unauthorized" });
  const snap = snapshot_(readAll_());
  return json_({ type: "FeatureCollection", ver: BACKEND_VERSION, serverNow: Date.now(),
                 features: snap.features, deleted: snap.deleted });
}

function doPost(e) {
  const se = setupError_();
  if (se) return json_({ error: se });
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ error: "bad json" }); }
  if (body.token !== TOKEN) return json_({ error: "unauthorized" });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_();
    const map = readAll_();
    const now = Date.now();
    let upserted = 0, deleted = 0, skippedBig = 0;

    (body.features || []).forEach(f => {
      const p = (f && f.properties) || {};
      const fid = String(p.fid || "");
      if (!fid) return;
      /* mtime は各メンバーの端末時計の値。進んでいる端末があると、その人の変更だけが
         永久に勝ち、他の人の後からの編集が黙って捨てられる。サーバの受信時刻より
         先の時刻は受信時刻に丸める(時計の進みの影響を打ち消す)。 */
      let mtime = Number(p.mtime) || 0;
      if (mtime > now) mtime = now;
      const cur = map[fid];
      const row = [fid, mtime, String(p.owner || ""), false, JSON.stringify(f)];
      /* 1セル上限を超える図形は保存しない。保存しようとすると setValues が例外を投げ、
         同期全体が「原因の分からない失敗」になるため、ここで1件だけ落とす。 */
      if (row[4].length > CELL_LIMIT) { skippedBig++; return; }
      if (!cur) {
        sh.appendRow(row);
        map[fid] = { rowIndex: sh.getLastRow(), mtime: mtime, owner: row[2], deleted: false, feature: row[4] };
        upserted++;
      } else if (mtime > cur.mtime) {
        sh.getRange(cur.rowIndex, 1, 1, HEADER.length).setValues([row]);
        cur.mtime = mtime; cur.deleted = false; cur.feature = row[4];
        upserted++;
      }
    });

    (body.deleted || []).forEach(d => {
      const fid = String((d && d.fid) || "");
      let mtime = Number(d && d.mtime) || 0;
      if (mtime > now) mtime = now;   /* 削除側も端末時計の進みを打ち消す */
      const cur = map[fid];
      if (cur && !cur.deleted && mtime >= cur.mtime) {
        sh.getRange(cur.rowIndex, 1, 1, HEADER.length).setValues([[fid, mtime, cur.owner, true, ""]]);
        cur.deleted = true; cur.mtime = mtime;
        deleted++;
      }
    });

    /* 送信の応答に受信用の全状態も載せる。これでクライアントはGETを使わずに済み、
       合言葉をURLのクエリに載せる必要がなくなる(serverNow は端末時計のずれの検知用)。 */
    const snap = snapshot_(map);
    return json_({ ok: true, ver: BACKEND_VERSION, serverNow: now,
                   upserted: upserted, deleted: deleted, skippedBig: skippedBig,
                   type: "FeatureCollection", features: snap.features, deletedList: snap.deleted });
  } finally {
    lock.releaseLock();
  }
}
