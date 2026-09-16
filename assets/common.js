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
  map.on("locationerror", () => alert("現在地を取得できませんでした​‌‌​​​‌​‌‌​‌(位置情報の許可を確認してください)"));
}

/* ---- 使い方ガイド(毎回初期表示、❓ボタンで開閉) ---- */
function addGuideControl(map, titleHtml, bodyHtml, storageKey) {
  const container = map.getContainer();

  const panel = document.createElement("div");
  panel.className = "guidePanel";
  panel.style.display = "none";
  panel.innerHTML = `<button class="guideClose" title="ガイドを閉じる" aria-label="ガイドを閉じる">✕</button><h2>${titleHtml}</h2>${bodyHtml}`;
  container.appendChild(panel);
  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);

  let btn;
  function setOpen(open) {
    panel.style.display = open ? "block" : "none";
    if (btn) btn.classList.toggle("on", open);
  }
  panel.querySelector(".guideClose").onclick = () => setOpen(false);

  /* デモ動画: 吹き出し(PC=クリック/スマホ=タップ)+クリックで全画面表示 */
  const isTouch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  panel.querySelectorAll(".gVideo").forEach((media) => {
    const wrap = document.createElement("div");
    wrap.className = "gVideoWrap";
    media.parentNode.insertBefore(wrap, media);
    wrap.appendChild(media);
    const hint = document.createElement("span");
    hint.className = "gVideoHint";
    hint.textContent = isTouch ? "👆 タップで拡大" : "🖱️ クリックで拡大";
    wrap.appendChild(hint);
    if (media.tagName === "VIDEO") {
      // 自動再生がブラウザ都合で止まった場合に再開する保険
      const ensurePlay = () => { if (!document.hidden && media.paused) media.play().catch(() => {}); };
      media.addEventListener("loadeddata", ensurePlay);
      media.addEventListener("pause", ensurePlay);
      document.addEventListener("visibilitychange", ensurePlay);
      ensurePlay();
    }
    media.addEventListener("click", () => {
      const lb = document.createElement("div");
      lb.className = "gLightbox";
      let big;
      if (media.tagName === "VIDEO") {
        big = document.createElement("video");
        big.src = media.currentSrc || media.src;
        big.autoplay = true;
        big.muted = true;
        big.loop = true;
        big.playsInline = true;
      } else {
        big = document.createElement("img");
        big.src = media.src;
        big.alt = media.alt || "操作デモ(拡大)";
      }
      const close = document.createElement("button");
      close.className = "gLbClose";
      close.title = "閉じる";
      close.setAttribute("aria-label", "閉じる");
      close.textContent = "✕";
      lb.append(big, close);
      lb.addEventListener("click", () => lb.remove());
      document.body.appendChild(lb);
    });
  });

  const ctl = L.control({ position: "topleft" });
  ctl.onAdd = () => {
    btn = L.DomUtil.create("button", "guideBtn");
    btn.textContent = "❓";
    btn.title = "使い方ガイドを表示/非表示";
    L.DomEvent.disableClickPropagation(btn);
    btn.onclick = () => setOpen(panel.style.display === "none");
    return btn;
  };
  ctl.addTo(map);

  /* ガイド内のタブ切替(.gTab で .gPane を切り替え。動画は表示中のペインだけ再生) */
  const gTabs = panel.querySelectorAll(".gTab");
  const gPanes = panel.querySelectorAll(".gPane");
  if (gTabs.length && gPanes.length) {
    const showPane = (id) => {
      gPanes.forEach((p) => {
        const on = p.id === id;
        p.style.display = on ? "block" : "none";
        p.querySelectorAll("video").forEach((v) => { if (on) v.play().catch(() => {}); else v.pause(); });
      });
      gTabs.forEach((t) => t.classList.toggle("active", t.dataset.pane === id));
    };
    gTabs.forEach((t) => {
      L.DomEvent.disableClickPropagation(t);
      t.addEventListener("click", () => showPane(t.dataset.pane));
    });
    showPane(gTabs[0].dataset.pane);
  }

  setOpen(true);
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

/* ---- CSV取り込みの共通処理 ----
   ヘッダー行の列名(別名可)から列位置を解決し、各データ行を {キー:値} の
   オブジェクト配列にして返す。poster/posting/gaisen で共用。
   spec  : { key: [別名, ...], ... }
   opts.require     : ["lat","long"] 等。無い列があれば {error} を返す
   opts.requireMsg  : require 不足時の alert 文言
   opts.nameFallback: true かつ spec に name があり列が無いとき、
                      既知列・数値列を除く最初のテキスト列を name に採用
   戻り値: { head, ix, records } または { error } */
function findCol(header, keys) {
  return header.findIndex((h) => keys.includes((h || "").trim()));
}
function importCsv(text, spec, opts) {
  opts = opts || {};
  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "CSVにデータ行がありません" };
  const head = rows[0], ix = {};
  for (const k in spec) ix[k] = findCol(head, spec[k]);
  for (const k of (opts.require || [])) {
    if (ix[k] < 0) return { error: opts.requireMsg || ("必要な列が見つかりません: " + k) };
  }
  if (opts.nameFallback && ("name" in spec) && ix.name < 0) {
    const known = Object.keys(ix).filter((k) => k !== "name").map((k) => ix[k]);
    const sample = rows[1] || [];
    for (let i = 0; i < head.length; i++) {
      if (known.indexOf(i) >= 0) continue;
      const v = (sample[i] || "").trim();
      if (v && !isFinite(Number(v.replace(/,/g, "")))) { ix.name = i; break; }
    }
  }
  const records = rows.slice(1).map((r, i) => {
    const o = { _row: i };
    for (const k in spec) o[k] = ix[k] >= 0 ? (r[ix[k]] != null ? r[ix[k]] : "") : "";
    return o;
  });
  return { head, ix, records };
}

/* ---- GPX → GeoJSON ----
   トラック(<trk>/<trkseg>/<trkpt>)とルート(<rte>/<rtept>)を LineString に変換。
   1ファイルに複数の trk/rte を含む「結合GPX」もそれぞれ別ルートとして取り込む。
   名前空間つきGPXでも動くよう getElementsByTagName(局所名一致)で走査する。 */
function gpxToGeoJSON(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("XMLとして解析できませんでした");
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "gpx") throw new Error("GPXファイルではありません");
  const features = [];
  const coordsFrom = (parent, tag) =>
    Array.from(parent.getElementsByTagName(tag))
      .map((p) => [parseFloat(p.getAttribute("lon")), parseFloat(p.getAttribute("lat"))])
      .filter((c) => isFinite(c[0]) && isFinite(c[1]));
  const directName = (el, fallback) => {
    for (const ch of Array.from(el.children)) {
      if (ch.nodeName.toLowerCase() === "name" && ch.textContent.trim()) return ch.textContent.trim();
    }
    return fallback;
  };
  const push = (coords, name) => {
    if (coords.length < 2) return;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: { name: name, memo: name },
    });
  };
  const trks = doc.getElementsByTagName("trk");
  for (let ti = 0; ti < trks.length; ti++) {
    const tname = directName(trks[ti], `トラック${ti + 1}`);
    const segs = trks[ti].getElementsByTagName("trkseg");
    for (let si = 0; si < segs.length; si++) {
      push(coordsFrom(segs[si], "trkpt"), segs.length > 1 ? `${tname} (${si + 1})` : tname);
    }
  }
  const rtes = doc.getElementsByTagName("rte");
  for (let ri = 0; ri < rtes.length; ri++) {
    push(coordsFrom(rtes[ri], "rtept"), directName(rtes[ri], `ルート${ri + 1}`));
  }
  return { type: "FeatureCollection", features };
}

/* ---- 免責バー(全マップ共通・毎回表示・✕で閉じる) ----
   常に表示し、ユーザー自身の操作で閉じる方式(「見ていない」を防ぐため保存しない)。 */
(function () {
  function addNoticeBar() {
    const header = document.querySelector("header.appbar");
    if (!header) return;
    const bar = document.createElement("div");
    bar.className = "noticebar";
    bar.innerHTML =
      '<span>⚠️ <b>ご利用にあたって:</b>本ツールは有志が無償で提供するものです。現状のまま提供し、不具合の修補や動作・内容の保証は行いません。本ツールにはアクセス制限機能はなく、URLを知っている方は誰でも閲覧できます。ページURL・配布ファイル・入力データの共有範囲の管理は、ご利用チームの責任で行ってください(第三者の個人情報を入力される場合の取扱いを含みます)。ご利用に関連して生じた損害について、作成者の故意または重大な過失による場合を除き、作成者は責任を負いません。​‌‌​​​‌​‌‌​‌' +
      '<br><span class="noticeLic">🟢 非商用の目的であれば誰でも無償で複製・利用できます(再配布時はライセンス全文またはURLと著作権表示の添付が必要)。<b>営利目的での利用・販売・複製・再配布は許可していません</b>。違反を確認した場合は、本ライセンスの定めに従い通知のうえ、是正されないときは<b>法的措置を含め厳正に対処します</b>。正式な利用条件はライセンス(<a href="https://polyformproject.org/licenses/noncommercial/1.0.0/" target="_blank" rel="noopener noreferrer">PolyForm Noncommercial 1.0.0</a>)に従います / Required Notice: Copyright (c) 2026 Yukinobu Nakamura</span></span>' +
      '<button class="noticeClose" title="閉じる" aria-label="免責表示を閉じる">✕</button>';
    header.insertAdjacentElement("afterend", bar);
    bar.querySelector(".noticeClose").onclick = () => bar.remove();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addNoticeBar);
  else addNoticeBar();
})();

/* ---- 国土地理院API(無料・キー不要): 地名の逆引き・住所検索 ----
   試験公開APIのため将来仕様変更の可能性あり。失敗時は静かに諦める設計にすること。 */
function gsiPlaceName(lat, lng) {
  return fetch(`https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lng}`)
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(j => {
      const nm = j && j.results && j.results.lv01Nm;
      return (nm && nm !== "－") ? nm : "";
    });
}

/* 地名検索コントロール(🔍で開閉)。全国の地名・住所から地図ジャンプ。 */
function addPlaceSearchControl(map) {
  const ctl = L.control({ position: "topleft" });
  let hitMarker = null;
  ctl.onAdd = () => {
    const div = L.DomUtil.create("div", "placeSearch");
    div.innerHTML =
      '<button class="psBtn" type="button" title="地名検索(全国)">🔍</button>' +
      '<span class="psBody" style="display:none">' +
      '<input class="psIn" type="text" placeholder="地名・住所(例: 池袋二丁目)">' +
      '<button class="psGo" type="button">検索</button><div class="psList"></div></span>';
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    const btn = div.querySelector(".psBtn"), body = div.querySelector(".psBody");
    const input = div.querySelector(".psIn"), list = div.querySelector(".psList");
    btn.onclick = () => {
      const open = body.style.display === "none";
      body.style.display = open ? "inline-flex" : "none";
      if (open) input.focus();
    };
    async function run() {
      const q = input.value.trim();
      if (!q) return;
      list.textContent = "検索中…";
      try {
        const r = await fetch("https://msearch.gsi.go.jp/address-search/AddressSearch?q=" + encodeURIComponent(q));
        const arr = await r.json();
        if (!Array.isArray(arr) || !arr.length) { list.textContent = "見つかりませんでした"; return; }
        list.innerHTML = "";
        arr.slice(0, 8).forEach(a => {
          const co = a.geometry && a.geometry.coordinates;
          if (!co) return;
          const item = document.createElement("div");
          item.className = "psItem";
          item.textContent = (a.properties && a.properties.title) || q;
          item.onclick = () => {
            if (hitMarker) map.removeLayer(hitMarker);
            hitMarker = L.circleMarker([co[1], co[0]], { radius: 10, color: "#dc2626", weight: 3, fillOpacity: 0 }).addTo(map);
            map.setView([co[1], co[0]], Math.max(map.getZoom(), 15));
            list.innerHTML = "";
          };
          list.appendChild(item);
        });
      } catch (err) {
        list.textContent = "検索に失敗しました(接続を確認してください)";
      }
    }
    div.querySelector(".psGo").onclick = run;
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    return div;
  };
  ctl.addTo(map);
}
/* ===== 🏠 世帯数レイヤ(国勢調査2020 小地域・町丁目) =====
   ポスターマップ・ポスティングマップ共通。右上のレイヤボタンからON/OFFし、
   データは data/setai_<市区町村コード>.geojson を初回ONのときだけ取得する。
   収録自治体を増やすときは SETAI_SOURCES に1行足し、対応する geojson を
   build/make_setai_geojson.py で作って data/ に置く(コード・名称はe-Statの境界データが正)。 */
const SETAI_BINS = [
  { min: 5000, color: "#08519c", label: "5,000世帯〜" },
  { min: 4000, color: "#3182bd", label: "4,000〜" },
  { min: 3000, color: "#6baed6", label: "3,000〜" },
  { min: 2000, color: "#9ecae1", label: "2,000〜" },
  { min: 1000, color: "#c6dbef", label: "1,000〜" },
  { min: 0,    color: "#eff3ff", label: "〜999世帯" },
];
function setaiColor(n){ for (const b of SETAI_BINS){ if (n >= b.min) return b.color; } return SETAI_BINS[SETAI_BINS.length - 1].color; }
const SETAI_CREDIT = "出典: 政府統計の総合窓口(e-Stat) 国勢調査(2020年)小地域境界データを加工して作成";
const SETAI_SOURCES = [
  { code: "13116", label: "🏠 世帯数: 豊島区" },
  { code: "13115", label: "🏠 世帯数: 杉並区" },
  { code: "13111", label: "🏠 世帯数: 大田区" },
  { code: "27126", label: "🏠 世帯数: 大阪市平野区" },
  /* 横浜市(18区) */
  { code: "14101", label: "🏠 世帯数: 横浜市鶴見区" },
  { code: "14102", label: "🏠 世帯数: 横浜市神奈川区" },
  { code: "14103", label: "🏠 世帯数: 横浜市西区" },
  { code: "14104", label: "🏠 世帯数: 横浜市中区" },
  { code: "14105", label: "🏠 世帯数: 横浜市南区" },
  { code: "14106", label: "🏠 世帯数: 横浜市保土ケ谷区" },
  { code: "14107", label: "🏠 世帯数: 横浜市磯子区" },
  { code: "14108", label: "🏠 世帯数: 横浜市金沢区" },
  { code: "14109", label: "🏠 世帯数: 横浜市港北区" },
  { code: "14110", label: "🏠 世帯数: 横浜市戸塚区" },
  { code: "14111", label: "🏠 世帯数: 横浜市港南区" },
  { code: "14112", label: "🏠 世帯数: 横浜市旭区" },
  { code: "14113", label: "🏠 世帯数: 横浜市緑区" },
  { code: "14114", label: "🏠 世帯数: 横浜市瀬谷区" },
  { code: "14115", label: "🏠 世帯数: 横浜市栄区" },
  { code: "14116", label: "🏠 世帯数: 横浜市泉区" },
  { code: "14117", label: "🏠 世帯数: 横浜市青葉区" },
  { code: "14118", label: "🏠 世帯数: 横浜市都筑区" },
];
/* ズームに連動してラベル文字サイズを増減。
   引くほど小さく=ラベルが各町丁目の区画内に収まるように、寄るほど大きく読みやすく */
const SETAI_FONT_BY_ZOOM = { 13: 7, 14: 9, 15: 11.5, 16: 14, 17: 17, 18: 20 }; /* z12以下=5.5 / z18以上=20 */

/* map に世帯数レイヤ一式を追加する。
   opts.isExtraActive: 凡例を出すべき追加レイヤ(取込CSV等)がONかを返す関数(任意)
   戻り値.refreshLegend: 追加レイヤ側から凡例を出し直したいときに呼ぶ */
function addSetaiLayers(map, layersCtl, opts) {
  opts = opts || {};
  /* 手描き図形より下のペインに描くため、描画・クリック操作の邪魔をしない */
  map.createPane("setaiPane");
  map.getPane("setaiPane").style.zIndex = 350; /* overlayPane(400)より下 */
  const setaiRenderer = L.svg({ pane: "setaiPane", padding: 1 }); /* クリップ防止(map本体と同じ理由) */
  const setaiLayers = {};
  SETAI_SOURCES.forEach(s => {
    const grp = L.layerGroup();
    setaiLayers[s.label] = { grp, code: s.code, loaded: false };
    layersCtl.addOverlay(grp, s.label);
  });

  function setaiFill(ent, gj){
    L.geoJSON(gj, {
      pane: "setaiPane",
      renderer: setaiRenderer,
      style: f => ({ color: "#64748b", weight: 1, opacity: 0.55, fillColor: setaiColor(f.properties.setai), fillOpacity: 0.45 }),
      onEachFeature: (f, ly) => {
        const p = f.properties;
        ly.bindTooltip(`<span class="setaiNm">${p.name}</span><br>${p.setai.toLocaleString()}<span class="setaiUnit">世帯</span>`, { permanent: true, direction: "center", className: "setaiLabel" });
        /* units>1 = 同じ町名が国勢調査の集計単位で分かれていたものを合算した町丁目
           (丁目に当たらない区分で、住所には現れない。例: 泉区 岡津町=2区分) */
        const note = p.units > 1
          ? `<br><span style="font-size:10.5px;color:#888">※国勢調査の集計単位${p.units}区分を合算(同一町名)</span>` : "";
        ly.bindPopup(`<b>${p.name}</b><br>世帯数: <b>${p.setai.toLocaleString()}世帯</b><br>人口: ${p.jinko.toLocaleString()}人${note}<br><span style="font-size:10.5px;color:#888">${SETAI_CREDIT}</span>`);
      },
    }).eachLayer(l => ent.grp.addLayer(l));
  }

  let setaiLegendCtl = null;
  function refreshLegend(){
    const active = Object.values(setaiLayers).some(ent => map.hasLayer(ent.grp)) ||
      !!(opts.isExtraActive && opts.isExtraActive());
    if (active && !setaiLegendCtl){
      setaiLegendCtl = L.control({ position: "bottomright" });
      setaiLegendCtl.onAdd = () => {
        const div = L.DomUtil.create("div", "legend");
        div.innerHTML = `<div style="font-weight:700;margin-bottom:2px">🏠 世帯数(2020国勢調査)</div>` +
          SETAI_BINS.map(b => `<i class="sq" style="background:${b.color}"></i>${b.label}`).join("<br>") +
          `<div style="font-size:9.5px;color:#888;margin-top:3px;max-width:150px">${SETAI_CREDIT}</div>` +
          `<div style="margin-top:3px"><a href="#" id="setaiReqLink" style="font-size:10.5px">➕ 自治体の追加をリクエスト</a></div>`;
        return div;
      };
      setaiLegendCtl.addTo(map);
      const rl = document.getElementById("setaiReqLink");
      if (rl) rl.onclick = (ev) => { ev.preventDefault(); openReqModal(); };
    } else if (!active && setaiLegendCtl){
      map.removeControl(setaiLegendCtl);
      setaiLegendCtl = null;
    }
  }

  function setaiFontRefresh(){
    const z = Math.min(map.getZoom(), 18);
    map.getContainer().style.setProperty("--setaiFs", (SETAI_FONT_BY_ZOOM[z] || 5.5) + "px");
  }
  map.on("zoomend", setaiFontRefresh);
  setaiFontRefresh();

  map.on("overlayadd", (e) => {
    const ent = setaiLayers[e.name];
    refreshLegend();
    if (!ent || ent.loaded) return;
    ent.loaded = true;
    fetch("../data/setai_" + ent.code + ".geojson")
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(gj => setaiFill(ent, gj))
      .catch(err => {
        ent.loaded = false;
        alert("世帯数データを読み込めませんでした(インターネット接続を確認してください): " + err.message);
      });
  });
  map.on("overlayremove", () => refreshLegend());

  return { refreshLegend, layers: setaiLayers };
}

/* ===== 🏠 自治体追加リクエスト(世帯数レイヤ) =====
   受け口はGitHub Issue(定型文プリセット)。アカウントの無い人向けにテンプレコピーも用意。
   将来フォームに切り替える場合は REQ_FORM_URL にURLを入れるだけ(空なら非表示)。 */
const REQ_FORM_URL = ""; /* 例: Googleフォーム URL。設定すると「フォームで送る」ボタンが出る */
const REQ_TEMPLATE = [
  "【世帯数レイヤ 自治体追加リクエスト】",
  "・都道府県: ",
  "・対象自治体(市区町村名。政令市は「〇〇市△△区」まで): ",
  "・選挙区が区割になっている場合の区割(対象の市区町村をすべて): ",
  "・用途/急ぎ度(任意): ",
].join("\n");
function openReqModal() {
  let m = document.getElementById("reqModal");
  if (!m) {
    m = document.createElement("div");
    m.id = "reqModal";
    m.className = "reqOverlay";
    const ghUrl = "https://github.com/Yukinobu-Nakamura/senkyo-maps/issues/new?title=" +
      encodeURIComponent("【世帯数レイヤ】自治体追加リクエスト") + "&body=" + encodeURIComponent(REQ_TEMPLATE);
    m.innerHTML = `<div class="reqBox">
      <button class="reqClose" aria-label="閉じる">✕</button>
      <h3>🏠 世帯数レイヤ 自治体追加リクエスト</h3>
      <p>次の2点を<b>正確に</b>ご記載ください。</p>
      <ol>
        <li><b>都道府県</b></li>
        <li><b>対象自治体</b>(市区町村名。政令市は「〇〇市△△区」まで)<br>
        <span class="reqCaution">⚠️ 選挙区が<b>区割</b>になっている場合(衆議院小選挙区・都道府県議会の選挙区など)は、<b>選挙管理委員会の公表資料や選挙ドットコム等のサイトで区割を確認し、対象の市区町村をすべて正確に</b>書いてください。記載が不正確だと反映できない場合があります。</span></li>
      </ol>
      <p class="reqCaution">※反映は手作業のため、<b>タイムリーな反映や必ず反映することはお約束できません</b>。あらかじめご了承ください。</p>
      <div class="reqBtns">
        ${REQ_FORM_URL ? `<a class="reqBtn main" href="${REQ_FORM_URL}" target="_blank" rel="noopener noreferrer">📝 フォームで送る</a>` : ""}
        <a class="reqBtn ${REQ_FORM_URL ? "" : "main"}" href="${ghUrl}" target="_blank" rel="noopener noreferrer">🐙 GitHubで送る(無料アカウントが必要)</a>
        <button class="reqBtn" id="reqCopy">📋 記載テンプレートをコピー</button>
      </div>
      <p style="font-size:11px;color:#6b7280;margin-top:6px">GitHubアカウントが無い場合は、テンプレートをコピーして、本ツールを紹介してくれた方経由でお送りください。</p>
    </div>`;
    document.body.appendChild(m);
    m.onclick = (ev) => { if (ev.target === m) m.style.display = "none"; };
    m.querySelector(".reqClose").onclick = () => { m.style.display = "none"; };
    m.querySelector("#reqCopy").onclick = () => {
      navigator.clipboard.writeText(REQ_TEMPLATE).then(
        () => alert("テンプレートをコピーしました。"),
        () => prompt("以下をコピーしてください", REQ_TEMPLATE));
    };
  }
  m.style.display = "flex";
}
/* origin-id: SENKYO-MAPS-ORIGIN-2609-XK47 */
