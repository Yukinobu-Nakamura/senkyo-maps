/* 共通ユーティリティ(ポスターマップ/ポスティングマップ) */
"use strict";

/* ---- ベース地図 ---- */
function createBaseLayers() {
  const gsiPale = L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
  });
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
  const gsiPhoto = L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
  });
  return { "地理院地図(淡色)": gsiPale, "OpenStreetMap": osm, "航空写真(地理院)": gsiPhoto };
}

/* ---- 現在地ボタン ---- */
function addLocateControl(map) {
  const ctl = L.control({ position: "topleft" });
  ctl.onAdd = () => {
    const btn = L.DomUtil.create("button", "locateBtn");
    btn.textContent = "📍";
    btn.title = "現在地を表示";
    L.DomEvent.disableClickPropagation(btn);
    btn.onclick = () => map.locate({ setView: true, maxZoom: 16 });
    return btn;
  };
  ctl.addTo(map);
  let locMarker = null;
  map.on("locationfound", (e) => {
    if (locMarker) map.removeLayer(locMarker);
    locMarker = L.circleMarker(e.latlng, { radius: 7, color: "#fff", weight: 2, fillColor: "#1a73e8", fillOpacity: 1 }).addTo(map);
  });
  map.on("locationerror", () => alert("現在地を取得できませんでした(位置情報の許可を確認してください)"));
}

/* ---- localStorage ---- */
function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---- ファイル入出力 ---- */
function downloadFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
function onFileSelected(inputEl, handler) {
  inputEl.addEventListener("change", () => {
    const f = inputEl.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      handler(reader.result, f.name);
      inputEl.value = ""; // 同じファイルの再選択を許可
    };
    reader.readAsText(f, "utf-8");
  });
}

/* ---- CSV (RFC4180の範囲で簡易対応) ---- */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { inQ = false; }
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}
function toCsv(rows) {
  const esc = (v) => {
    const s = String(v == null ? "" : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}
function todayStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}
