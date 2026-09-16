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
  /* 配布版HTMLを file:// で開いた場合など、保存が拒否される環境がある。
     ここで落とすとアプリ全体が止まるので、保存できなくても動作は続ける */
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("この環境ではブラウザに保存できませんでした:", key, e);
  }
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
/* ===== 表示状態を「そのタブが開いている間だけ」覚える =====
   ベースマップの選択・オーバーレイのON/OFF・地図の表示位置を sessionStorage に保存する。
   localStorage と違い **再読み込みでは残り、タブ/ブラウザを閉じると消える**ので、
   うっかりリロードして設定が全部外れる事故を防ぎつつ、端末には残さない。
   引数の baseLayers / overlays は {表示名: レイヤ} の辞書。 */
function rememberMapSession(map, key, cfg) {
  cfg = cfg || {};
  const SKEY = key + ".view";
  const bases = cfg.baseLayers || {}, overs = cfg.overlays || {};

  try {
    const s = JSON.parse(sessionStorage.getItem(SKEY) || "null");
    if (s) {
      if (s.base && bases[s.base]) {
        Object.values(bases).forEach(l => { if (map.hasLayer(l)) map.removeLayer(l); });
        map.addLayer(bases[s.base]);
      }
      if (Array.isArray(s.on)) {
        Object.keys(overs).forEach(n => {
          const want = s.on.indexOf(n) >= 0;
          if (want && !map.hasLayer(overs[n])) map.addLayer(overs[n]);
          if (!want && map.hasLayer(overs[n])) map.removeLayer(overs[n]);
        });
      }
      if (s.view && isFinite(s.view.lat) && isFinite(s.view.lng)) map.setView([s.view.lat, s.view.lng], s.view.z);
    }
  } catch (e) { /* 壊れていたら既定の表示のまま続行 */ }

  function save() {
    try {
      const c = map.getCenter();
      sessionStorage.setItem(SKEY, JSON.stringify({
        base: Object.keys(bases).find(n => map.hasLayer(bases[n])) || null,
        on: Object.keys(overs).filter(n => map.hasLayer(overs[n])),
        view: { lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6), z: map.getZoom() },
      }));
    } catch (e) { /* 保存不可でも動作は継続 */ }
  }
  map.on("baselayerchange overlayadd overlayremove moveend zoomend", save);
  save();
}

/* ===== 🏠 世帯数レイヤ(国勢調査2020 小地域・町丁目) =====
   ポスターマップ・ポスティングマップ共通。右上のレイヤボタンからON/OFFし、
   データは data/setai_<市区町村コード>.geojson を初回ONのときだけ取得する。
   収録自治体は data/setai_index.json から読み込む(下の fetchSetaiIndex)。 */
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
/* 収録自治体の一覧は data/setai_index.json から取得する(コードに埋め込まない)。
   配布版(dist)のHTMLも公開URLの同じJSONを見に行くため、あとから自治体を足しても
   **既に配ったHTMLがそのまま新しい一覧を拾える**(配り直し不要)。
   形式: {version, updated, cities:[{pref, city, wards:[{code, name}]}]}
   作り方は build/make_setai_index.py を参照(名称はe-Statの境界データが正)。 */
function fetchSetaiIndex() {
  return fetch("../data/setai_index.json")
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(j => Array.isArray(j.cities) ? j.cities : []);
}
/* 区が1つでも、市名と区名が違う(政令市の一部だけ収録)なら下層レイヤとして見せる。
   例: 大阪市 > 平野区。市名=区名の特別区や一般市(豊島区・金沢市)は1行のまま */
function setaiHasSub(c) { return c.wards.length > 1 || c.wards[0].name !== c.city; }
/* ズームに連動してラベル文字サイズを増減。
   引くほど小さく=ラベルが各町丁目の区画内に収まるように、寄るほど大きく読みやすく */
const SETAI_FONT_BY_ZOOM = { 13: 7, 14: 9, 15: 11.5, 16: 14, 17: 17, 18: 20 }; /* z12以下=5.5 / z18以上=20 */

/* 区画の枠線の太さ(ズーム別)。引くと細く、寄ると太く。
   同じ色の区画が隣り合っても境目が分かるよう、塗りより濃い線をはっきり出す。
   個々の図形に setStyle すると数千件で重いので、ペインへのCSS変数で一括指定する。 */
const SETAI_STROKE_BY_ZOOM = { 13: 1.1, 14: 1.4, 15: 1.8, 16: 2.2, 17: 2.6, 18: 3 }; /* z12以下=0.9 / z18以上=3 */

/* map に世帯数レイヤ一式と、その選択パネル(自治体 > 区の2階層)を追加する。
   opts.extra: {layer, label} 取込CSV等、パネル最下段に並べる追加レイヤ(任意)
   opts.sessionKey: 選択状態を sessionStorage に覚えるときのキー接頭辞
   戻り値.refreshLegend: 追加レイヤ側から凡例を出し直したいときに呼ぶ */
function addSetaiLayers(map, opts) {
  opts = opts || {};
  const SKEY = (opts.sessionKey || "senkyoMaps") + ".setaiOn";

  /* 手描き図形より下のペインに描くため、描画・クリック操作の邪魔をしない */
  map.createPane("setaiPane");
  map.getPane("setaiPane").style.zIndex = 350; /* overlayPane(400)より下 */
  const renderer = L.svg({ pane: "setaiPane", padding: 1 }); /* クリップ防止(map本体と同じ理由) */

  let cities = [];    /* data/setai_index.json の cities。取得できるまで空 */
  let indexState = "loading";  /* loading | ready | error */
  const wards = {};   /* 市区町村コード -> {grp, loaded, cityIdx, city, name} */
  /* desired = ONにしたい区コードの集合。チェックボックスはこれを映し、
     地図への追加は読込完了後に追いつく(読込中もチェックは入ったまま) */
  const desired = new Set();

  function fill(ent, gj) {
    L.geoJSON(gj, {
      pane: "setaiPane",
      renderer,
      style: f => ({
        color: "#0f172a", weight: 2, opacity: 0.85,          /* 区画の境界をはっきり見せる */
        fillColor: setaiColor(f.properties.setai), fillOpacity: 0.45,
      }),
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

  /* desired の中身を地図に反映する。未読込のものは取得してから載せる */
  let pending = 0;
  function apply() {
    Object.keys(wards).forEach(code => {
      const ent = wards[code];
      if (desired.has(code)) {
        if (ent.loaded) { if (!map.hasLayer(ent.grp)) map.addLayer(ent.grp); return; }
        if (ent.fetching) return;
        ent.fetching = true;
        pending++; renderPanel();
        fetch("../data/setai_" + code + ".geojson")
          .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
          .then(gj => { fill(ent, gj); ent.loaded = true; if (desired.has(code)) map.addLayer(ent.grp); })
          .catch(err => {
            desired.delete(code);   /* 取れなかった区はチェックを戻す */
            alert(`世帯数データを読み込めませんでした(${ent.name})。インターネット接続を確認してください: ${err.message}`);
          })
          .then(() => { ent.fetching = false; pending--; save(); renderPanel(); refreshLegend(); });
      } else if (map.hasLayer(ent.grp)) {
        map.removeLayer(ent.grp);
      }
    });
    save(); refreshLegend();
  }

  /* 選択状態は sessionStorage = 再読み込みでは残り、タブ/ブラウザを閉じると消える */
  function save() {
    try { sessionStorage.setItem(SKEY, JSON.stringify([...desired])); } catch (e) { /* 保存不可でも動作は継続 */ }
  }
  function restore() {
    try {
      const v = JSON.parse(sessionStorage.getItem(SKEY) || "[]");
      if (Array.isArray(v)) v.forEach(c => { if (wards[c]) desired.add(c); });
    } catch (e) { /* 壊れていたら無視 */ }
  }

  /* ===== 選択パネル(自治体 > 区) ===== */
  const expanded = new Set();
  let panelBody = null, panelWrap = null;

  function cityState(ci) {
    const ws = cities[ci].wards;
    const on = ws.filter(w => desired.has(w.code)).length;
    return on === 0 ? "off" : (on === ws.length ? "on" : "part");
  }

  function renderPanel() {
    if (!panelBody) return;
    const rows = cities.map((c, ci) => {
      const st = cityState(ci);
      /* 区が1つでも市名と区名が違えば(政令市の一部だけ収録)下層レイヤにする。
         大阪市>平野区 が該当。市名=区名の特別区・一般市は1行のまま */
      const sub2 = setaiHasSub(c);
      const open = expanded.has(ci);
      const sub = !sub2 || !open ? "" :
        `<div class="stWards">
           <div class="stWardBtns">
             <button type="button" data-all="${ci}">全選択</button>
             <button type="button" data-none="${ci}">全クリア</button>
           </div>
           ${c.wards.map(w => `<label class="stWard"><input type="checkbox" data-ward="${w.code}"${desired.has(w.code) ? " checked" : ""}>${w.name}${wards[w.code] && wards[w.code].fetching ? ' <span class="stLoad">読込中</span>' : ""}</label>`).join("")}
         </div>`;
      return `<div class="stCity">
        <div class="stCityRow">
          <label class="stCityLbl"><input type="checkbox" data-city="${ci}"${st === "on" ? " checked" : ""}><b>${c.city}</b><span class="stPref">${c.pref}</span></label>
          ${sub2 ? `<button type="button" class="stExp" data-exp="${ci}" aria-label="区の一覧">${open ? "▾" : "▸"}<span class="stCnt">${c.wards.length}区</span></button>` : ""}
        </div>${sub}</div>`;
    }).join("");
    const extra = opts.extra
      ? `<div class="stExtra"><label class="stWard"><input type="checkbox" data-extra="1"${map.hasLayer(opts.extra.layer) ? " checked" : ""}>${opts.extra.label}</label></div>`
      : "";
    const head = indexState === "loading" ? `<div class="stLoadBar">収録自治体の一覧を読み込み中…</div>`
      : indexState === "error" ? `<div class="stLoadBar">一覧を読み込めませんでした。インターネット接続を確認して開き直してください。</div>`
      : `<div class="stNote">選択内容は<b>再読み込みでは残り</b>、タブを閉じると消えます</div>`;
    panelBody.innerHTML = head + rows + extra +
      (pending ? `<div class="stLoadBar">世帯数データを読み込み中… 残り${pending}件</div>` : "") +
      `<div class="stReq"><a href="#" data-req="1">➕ 自治体の追加をリクエスト</a></div>`;
    /* 一部だけONの自治体は中間状態(■)にする */
    cities.forEach((c, ci) => {
      const el = panelBody.querySelector(`input[data-city="${ci}"]`);
      if (el) el.indeterminate = cityState(ci) === "part";
    });
  }

  const ctl = L.control({ position: "topright" });
  ctl.onAdd = () => {
    panelWrap = L.DomUtil.create("div", "setaiCtl leaflet-bar");
    panelWrap.innerHTML =
      `<button type="button" class="stToggle" title="世帯数レイヤを選ぶ">🏠</button>
       <div class="stPanel" hidden><div class="stHead">🏠 世帯数(2020国勢調査)<button type="button" class="stClose" aria-label="閉じる">✕</button></div><div class="stBody"></div></div>`;
    L.DomEvent.disableClickPropagation(panelWrap);
    L.DomEvent.disableScrollPropagation(panelWrap);
    panelBody = panelWrap.querySelector(".stBody");
    const panel = panelWrap.querySelector(".stPanel");
    const toggle = panelWrap.querySelector(".stToggle");
    /* パネルを開いている間だけ右上のコントロール帯を前面に出す。
       Leaflet の右上(topright)と右下(bottomright)は同じ z-index の兄弟で、
       重なるとDOM順で後ろの右下(凡例)が上に乗り、パネルのボタンが押せなくなるため。
       子要素の z-index では親の重なり順を超えられないので、親側を持ち上げる。 */
    function setOpen(open) {
      panel.hidden = !open;
      toggle.classList.toggle("on", open);
      const bar = panelWrap.parentElement;
      if (bar) bar.style.zIndex = open ? "1200" : "";
    }
    toggle.onclick = () => setOpen(panel.hidden);
    panelWrap.querySelector(".stClose").onclick = () => setOpen(false);

    panelBody.addEventListener("change", (ev) => {
      const t = ev.target;
      if (t.dataset.city != null) {
        const ws = cities[+t.dataset.city].wards;
        ws.forEach(w => t.checked ? desired.add(w.code) : desired.delete(w.code));
        if (t.checked && ws.length > 1) expanded.add(+t.dataset.city);
      } else if (t.dataset.ward) {
        t.checked ? desired.add(t.dataset.ward) : desired.delete(t.dataset.ward);
      } else if (t.dataset.extra && opts.extra) {
        t.checked ? map.addLayer(opts.extra.layer) : map.removeLayer(opts.extra.layer);
      }
      apply(); renderPanel();
    });
    panelBody.addEventListener("click", (ev) => {
      const t = ev.target.closest("button, a");
      if (!t) return;
      if (t.dataset.exp != null) {
        const ci = +t.dataset.exp;
        expanded.has(ci) ? expanded.delete(ci) : expanded.add(ci);
        renderPanel();
      } else if (t.dataset.all != null) {
        cities[+t.dataset.all].wards.forEach(w => desired.add(w.code));
        apply(); renderPanel();
      } else if (t.dataset.none != null) {
        cities[+t.dataset.none].wards.forEach(w => desired.delete(w.code));
        apply(); renderPanel();
      } else if (t.dataset.req) {
        ev.preventDefault(); openReqModal();
      }
    });
    renderPanel();
    return panelWrap;
  };
  ctl.addTo(map);

  /* ===== 凡例 ===== */
  let legendCtl = null;
  function refreshLegend() {
    const active = desired.size > 0 || (opts.extra && map.hasLayer(opts.extra.layer));
    if (active && !legendCtl) {
      legendCtl = L.control({ position: "bottomright" });
      legendCtl.onAdd = () => {
        const div = L.DomUtil.create("div", "legend");
        div.innerHTML = `<div style="font-weight:700;margin-bottom:2px">🏠 世帯数(2020国勢調査)</div>` +
          SETAI_BINS.map(b => `<i class="sq" style="background:${b.color}"></i>${b.label}`).join("<br>") +
          `<div style="font-size:9.5px;color:#888;margin-top:3px;max-width:150px">${SETAI_CREDIT}</div>` +
          `<div style="margin-top:3px"><a href="#" id="setaiReqLink" style="font-size:10.5px">➕ 自治体の追加をリクエスト</a></div>`;
        return div;
      };
      legendCtl.addTo(map);
      const rl = document.getElementById("setaiReqLink");
      if (rl) rl.onclick = (ev) => { ev.preventDefault(); openReqModal(); };
    } else if (!active && legendCtl) {
      map.removeControl(legendCtl);
      legendCtl = null;
    }
  }

  /* ラベル文字サイズと枠線の太さをズームに連動させる */
  function zoomRefresh() {
    const z = Math.min(map.getZoom(), 18);
    const cs = map.getContainer().style;
    cs.setProperty("--setaiFs", (SETAI_FONT_BY_ZOOM[z] || 5.5) + "px");
    cs.setProperty("--setaiSw", (SETAI_STROKE_BY_ZOOM[z] || 0.9) + "px");
  }
  map.on("zoomend", zoomRefresh);
  zoomRefresh();

  /* 取込CSV等の追加レイヤが外から付け外しされてもパネルと凡例を合わせる */
  if (opts.extra) {
    map.on("layeradd layerremove", (e) => {
      if (e.layer === opts.extra.layer) { renderPanel(); refreshLegend(); }
    });
  }

  /* 閉じる前の忠告。選択が何も無いときは邪魔しない。
     ブラウザ仕様により文言は指定できず、再読み込みでも同じ確認が出る */
  window.addEventListener("beforeunload", (ev) => {
    if (!desired.size && !(opts.extra && map.hasLayer(opts.extra.layer))) return;
    ev.preventDefault();
    ev.returnValue = "";
  });

  /* 収録一覧を取ってからレイヤを組み立てる。
     ここで一覧を外部JSONにしているので、自治体を追加しても配布済みHTMLが追従できる。
     一覧に無くなったコードがセッションに残っていても、wards に無ければ黙って捨てる
     (収録の入れ替えがあっても復元でエラーにならない) */
  fetchSetaiIndex()
    .then(list => {
      cities = list;
      indexState = "ready";
      cities.forEach((c, ci) => c.wards.forEach(w => {
        wards[w.code] = { grp: L.layerGroup(), loaded: false, cityIdx: ci, city: c.city, name: w.name };
      }));
      restore();
      if (desired.size) {
        /* 復元した自治体は区の一覧を開いておく(どれが入っているか見えるように) */
        desired.forEach(c => { if (setaiHasSub(cities[wards[c].cityIdx])) expanded.add(wards[c].cityIdx); });
        apply();
      }
    })
    .catch(() => { indexState = "error"; })
    .then(() => renderPanel());

  return { refreshLegend, layers: wards, desired };
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
