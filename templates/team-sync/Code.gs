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
 *  - GET  ?token=...            → 全図形(削除済みを除く)を GeoJSON FeatureCollection で返す
 *  - POST {token, features, deleted} → fid をキーに upsert(mtime の新しい方を採用)。
 *    deleted: [{fid, mtime}] は削除の伝播(トゥームストーン)
 *  - シート列: fid | mtime | owner | deleted | feature(JSON)
 *
 * ライセンス: PolyForm Noncommercial License 1.0.0
 * Required Notice: Copyright (c) 2026 Yukinobu Nakamura
 */

/* ▼▼ 設置時にここを必ず変更してください(推測されにくい長い文字列に) ▼▼ */
const TOKEN = "CHANGE_ME_TO_LONG_RANDOM_STRING";
/* ▲▲ ここまで ▲▲ */

const SHEET_NAME = "sync";
const HEADER = ["fid", "mtime", "owner", "deleted", "feature"];

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

function doGet(e) {
  if (!e || !e.parameter || e.parameter.token !== TOKEN) return json_({ error: "unauthorized" });
  const map = readAll_();
  const features = [];
  const deleted = [];
  Object.keys(map).forEach(fid => {
    const r = map[fid];
    if (r.deleted) { deleted.push({ fid: fid, mtime: r.mtime }); return; }
    if (!r.feature) return;
    try { features.push(JSON.parse(r.feature)); } catch (err) { /* 壊れた行はスキップ */ }
  });
  return json_({ type: "FeatureCollection", features: features, deleted: deleted });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ error: "bad json" }); }
  if (body.token !== TOKEN) return json_({ error: "unauthorized" });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_();
    const map = readAll_();
    let upserted = 0, deleted = 0;

    (body.features || []).forEach(f => {
      const p = (f && f.properties) || {};
      const fid = String(p.fid || "");
      if (!fid) return;
      const mtime = Number(p.mtime) || 0;
      const cur = map[fid];
      const row = [fid, mtime, String(p.owner || ""), false, JSON.stringify(f)];
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
      const mtime = Number(d && d.mtime) || 0;
      const cur = map[fid];
      if (cur && !cur.deleted && mtime >= cur.mtime) {
        sh.getRange(cur.rowIndex, 1, 1, HEADER.length).setValues([[fid, mtime, cur.owner, true, ""]]);
        cur.deleted = true; cur.mtime = mtime;
        deleted++;
      }
    });

    return json_({ ok: true, upserted: upserted, deleted: deleted });
  } finally {
    lock.releaseLock();
  }
}
