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
/* ===== ❓ よくある質問／👥 チームでの回し方(3マップ共通) =====
   ガイド(❓ボタン)の中に自動で差し込む。文面はここ1か所を直せば全マップに反映される。
   ・読み手が「必要な1問だけ読む」使い方なので、質問はアコーディオン(details)にして
     開いた直後は見出しだけ見える状態にする(NN/g: 段階的開示は2段まで・見出しで中身を予告する)
   ・「⬇️ アプリを保存」が無いページでは .faqDl を、「☁️ 同期」が無いページでは .teamSync を自動で外す */
const FAQ_HTML = `
<p class="faqLead">このアプリは<b>データを預かる場所を持たない地図</b>です。描いた内容は<b>あなたの端末の中だけ</b>に保存され、インターネット上には送られません。だから<b>他の人にも作成者にも見えません</b>。人に渡したいときだけ「💾 書出」でファイルにして渡します。</p>
<div class="faqTools"><button type="button" class="faqAll">すべて開く</button></div>

<details class="faqItem"><summary>ダウンロードせず、URLのまま使って大丈夫?</summary><div class="faqA"><b>大丈夫です。むしろそれが基本の使い方です。</b>URLを開くと、そのつど<b>まっさらなアプリ</b>が読み込まれ、あなたが描いた内容はその端末の中から復元されます。スマホなら共有ボタン →「ホーム画面に追加」で、アプリのように1タップで開けます。</div></details>

<details class="faqItem"><summary>描いた区域やルートは、他の人に見えますか?</summary><div class="faqA">見えません。同じURLを他の人が開いても、その人の画面は<b>白紙</b>です。<br>
<span class="faqNote">※例外は「その端末を他の人が使ったとき」。共用のパソコンやタブレットでは、使い終わりに「💾 書出」で保管してから「全消去(状態リセット)」しておくと安心です。</span></div></details>

<details class="faqItem"><summary>データはどこに保存されていますか?</summary><div class="faqA">端末の<b>ブラウザの中</b>です。写真のように「ファイル」として残るわけではありません。取り出したいときは「💾 書出」を押すとファイルになります。</div></details>

<details class="faqItem faqDl"><summary>「⬇️ アプリを保存」は何をするボタン?</summary><div class="faqA"><b>アプリ本体を1つのHTMLファイルにコピーする</b>ボタンです。押すたびに<b>まっさらな状態</b>のコピーが落ちてきます(描いたデータは入りません)。<b>URLを知らせずに人へ渡したいとき</b>のための機能です。<br>
<span class="faqNote">※チームで使うだけなら、全員が同じURLを開けば十分で、このボタンは使わなくて構いません。</span></div></details>

<details class="faqItem faqDl"><summary>保存したファイルをiPhone・iPadで開くと地図が真っ白です</summary><div class="faqA">iPhone・iPadの仕様です。ダウンロードしたHTMLは「表示するだけ」の扱いになり、地図を描くプログラムが動きません(PC・Androidなら開けます)。<b>iPhone・iPadでは、このページのURLをそのままお使いください。</b>共有ボタン →「ホーム画面に追加」をしておくと、アプリのように1タップで開けます。</div></details>

<details class="faqItem"><summary>電波のないところでも使えますか?</summary><div class="faqA">使えません。地図そのものを毎回インターネットから取り寄せているため、保存したファイル版でも通信が必要です。</div></details>

<details class="faqItem"><summary>GPX(歩いた記録)を取り込むと、どこに入りますか?</summary><div class="faqA">その端末の中に入ります(ネットには送られません)。<b>元のGPXファイルはそのまま残る</b>ので、万一マップ側が消えても取り込み直せます。</div></details>

<details class="faqItem"><summary>保存したデータが消えることはありますか?</summary><div class="faqA">あります。次の4つに注意してください。
<ol class="faqList">
<li>ブラウザの<b>履歴・Webサイトデータを削除</b>したとき</li>
<li><b>プライベートブラウズ</b>で使ったとき(閉じると消えます)</li>
<li><b>iPhone・iPadで7日間このサイトを開かなかったとき</b>(iOSが自動で消します。「ホーム画面に追加」から開けば対象外)</li>
<li>保存容量(目安5MB＝長いGPXルートで80本ほど)を超えたとき</li>
</ol>
<b>週に1回くらい「💾 書出」で書き出して保管</b>しておけば、どれが起きても元に戻せます。</div></details>

<details class="faqItem"><summary>書き出したファイル、ちゃんと中身が入っていますか?</summary><div class="faqA"><b>ファイルの大きさで分かります。「49バイト」なら中身は空</b>です(図形が1件も無い状態で書き出したファイル)。図形が1つでもあれば<b>数百バイト以上</b>になります。<br>
<span class="faqNote">※iPhone・iPadでは、書き出すとプレビュー画面が開きます。そのまま閉じると残らないことがあるので、<b>画面下の共有ボタン →「"ファイル"に保存」</b>で保管してください。保存したファイルは「📂 読込」で元に戻せます(別の端末への引っ越しもこれでできます)。</span></div></details>

<details class="faqItem"><summary>パソコンとスマホで同じデータを見たい</summary><div class="faqA">自動では揃いません。片方で「💾 書出」→ そのファイルをメールやクラウド経由でもう片方へ送り →「📂 読込」で取り込むと、同じ状態になります。</div></details>

<details class="faqItem"><summary>チームで共有するには?</summary><div class="faqA">全員が<b>同じURL</b>を開いて使い、担当者が「💾 書出」したファイルを配って、各自「📂 読込」で取り込みます。取り込みは<b>統合</b>なので、同じ図形が二重に増えることはありません。<br>
<span class="faqNote">※手順と注意点は、目次の「👥 チームでの回し方」にまとめてあります。</span></div></details>

<details class="faqItem"><summary>「保存できませんでした」と出ました</summary><div class="faqA">端末の保存容量がいっぱいです。まず「💾 書出」で書き出してから、不要な図形(とくに長いGPXルート)を削除してください。</div></details>

<details class="faqItem"><summary>同じ地図を2つのタブで開いてもいい?</summary><div class="faqA"><b>1つにしてください。</b>両方で編集すると、あとから保存した側で上書きされ、片方の変更が消えます(検知すると画面の上に警告が出ます)。</div></details>

<details class="faqItem"><summary>地図が見づらい。凡例やボタンを消せますか?</summary><div class="faqA"><b>消せます。</b>やり方は3つあります。
<ol class="faqList">
<li><b>地図の何もない所をタップ</b> — <b>上のボタン帯も含めて</b>まとめて消え、<b>地図が画面いっぱい</b>になります。<b>もう一度タップ</b>(または画面下の「⛶ ツールを表示」)で戻ります</li>
<li><b>左上の「⛶」ボタン</b> — 同じく全部隠します(図形や世帯数レイヤが重なっていて、タップすると説明が出てしまう場所ではこちら)</li>
<li><span class="faqNote">※上の紫のボタン帯・説明・注意書きも一緒に隠れます。戻すと元どおり出てきます。</span></li>
<li><b>凡例の「»」</b> — その凡例だけを<b>画面の右端へ畳みます</b>(細いタブだけが残ります。タブを押すと戻ります)</li>
</ol>
<span class="faqNote">※🏠世帯数の凡例は、<b>世帯数を表示していないときは出ません</b>。自治体を選んで地図に世帯数が出た時点で開いた状態で現れ、「»」で右端へ畳めます。</span></div></details>

<details class="faqItem"><summary>自分のデータが作成者や他のチームに送られることはありますか?</summary><div class="faqA">ありません。このアプリはデータを預かる仕組みを持っていません。通信するのは<b>地図の画像・地名の検索・世帯数などの公開データの取得</b>のためだけです。<br>
<span class="faqNote">※「☁️ 同期」を設定した場合だけ、チーム自身が用意した保存先(チームのGoogleスプレッドシート)にデータが送られます。設定しなければ通信しません。</span></div></details>
`;

/* ===== 👥 チームでの回し方(1枚) =====
   ファイル(💾書出→📂読込)でチームを回すときの手順と、実測で分かった注意点。
   「取り込み＝丸ごと上書き」ではなく「図形ごとに更新時刻の新しい方を採用」する仕組みを
   ひとことで説明しておかないと、管理者が『他人の分で自分の編集が消える』と誤解する。 */
const TEAM_HTML = `
<p class="faqLead">配る → 各自が編集 → 返す → 取り込む、の繰り返しです。取り込みは<b>丸ごと上書きではなく「図形ごとに新しい方を採用」</b>なので、<b>誰から取り込んでも先に取り込んだ人の分は消えません</b>。</p>

<ol class="teamSteps">
<li><b>管理者</b>：区域・地点を用意して<b>担当を割り当て</b> →「💾 書出」→ 全員に配る(LINE・メール可)</li>
<li><b>メンバー</b>：受け取ったファイルを「📂 読込」→ <b>自分の担当分だけ</b>編集</li>
<li><b>メンバー</b>：終わったら「💾 書出」→ 管理者へ返す</li>
<li><b>管理者</b>：返ってきたファイルを順に「📂 読込」(順番は問いません) → 統合後に<b>もう一度「💾 書出」して日付つきで保管</b>(例 master_0918)</li>
</ol>

<div class="faqTools"><button type="button" class="faqAll">すべて開く</button></div>

<details class="faqItem"><summary>Aさんの分を取り込んだ後にBさんの分を取り込むと、Aさんの分は消えませんか?</summary><div class="faqA"><b>消えません。</b>図形1つずつに更新時刻が入っていて、<b>新しい方だけ</b>が採用されます。Bさんが触っていない区域は古いままなので、Aさんの実施内容を上書きしません。管理者が手元で加えた変更も同じ理由で残ります。</div></details>

<details class="faqItem"><summary>気をつけるのは3つだけ</summary><div class="faqA">
<ol class="faqList">
<li><b>担当を重ねない</b> — 同じ区域を2人が編集すると、<b>あとから編集した人</b>の内容になります(先の人の分は消えます)</li>
<li><b>削除は管理者だけ</b> — メンバーが消してもファイルでは伝わらず、逆に<b>管理者が消した区域が、メンバーの古いファイルで復活</b>することがあります。やめる区域は<b>消さずにメモへ「中止」</b>と書くのが安全です</li>
<li><b>統合したら必ず書き出して保管</b> — データは各自の端末の中だけです。日付つきで残しておけば、誰の端末が消えても復旧できます</li>
</ol></div></details>

<details class="faqItem"><summary>新しいメンバーが増えたときは?</summary><div class="faqA">最新のマスターファイルを渡して「📂 読込」してもらうだけです。URLとファイルの2つを渡せば、その日から同じ状態で使えます。</div></details>

<details class="faqItem teamSync"><summary>もっと大人数・削除もそろえたい</summary><div class="faqA">「☁️ 同期」を使うと、ファイルのやり取りなしで全員が同じ状態になり、<b>削除も反映</b>されます。チーム自身がGoogleスプレッドシートを用意する方式です(設置10分・作成者はデータを預かりません)。担当が5人を超える、区割の変更が多い、といった規模はこちらが向きます。</div></details>
`;

/* ガイドを「目次(見出しだけ) → 選んだ1項目」の2段に組み替える。
   ・タブ型ガイド(ポスティング)は、タブ列を目次に置き換える
   ・タブの無いガイド(ポスター・街宣)は、既存の本文をまとめて1項目にする
   ・共通ページ(👥チームでの回し方 / ❓よくある質問)をここで足す
   根拠: NN/g「段階的開示は2段まで。最初の画面は重要なものだけ、見出しで中身を予告する」 */
function buildGuideMenu(panel) {
  const h2 = panel.querySelector("h2");
  const tabsBar = panel.querySelector(".gTabs");
  let panes = [].slice.call(panel.querySelectorAll(".gPane"));

  if (tabsBar) {
    tabsBar.querySelectorAll(".gTab").forEach((t) => {
      const pane = panel.querySelector("#" + t.dataset.pane);
      if (!pane) return;
      pane.dataset.label = t.textContent.trim();
      if (t.dataset.desc) pane.dataset.desc = t.dataset.desc;
    });
    tabsBar.remove();
  } else {
    const wrap = document.createElement("div");
    wrap.className = "gPane";
    wrap.id = "gMain";
    wrap.dataset.label = "🖊️ 基本の使い方";
    wrap.dataset.desc = "読み込み・記録・書き出しの流れ";
    [].slice.call(panel.childNodes).forEach((n) => {
      if (n === h2) return;
      if (n.nodeType === 1 && n.classList.contains("guideClose")) return;
      wrap.appendChild(n);
    });
    panel.appendChild(wrap);
    panes = [wrap];
  }

  /* 共通ページを追加 */
  const addPane = (id, label, desc, html) => {
    const d = document.createElement("div");
    d.className = "gPane faqBody";
    d.id = id;
    d.dataset.label = label;
    d.dataset.desc = desc;
    d.innerHTML = html;
    panel.appendChild(d);
    panes.push(d);
  };
  addPane("gTeam", "👥 チームでの回し方", "配る→編集→返す→統合の手順と注意3つ", TEAM_HTML);
  addPane("gFaq", "❓ よくある質問", "保存・共有・iPhoneのこと(15問)", FAQ_HTML);

  /* そのページに無い機能の項目は出さない */
  if (!document.querySelector("a.dlbtn")) panel.querySelectorAll(".faqDl").forEach((el) => el.remove());
  if (!document.getElementById("syncBtn")) panel.querySelectorAll(".teamSync").forEach((el) => el.remove());

  /* 目次 */
  const menu = document.createElement("div");
  menu.className = "gMenu";
  panes.forEach((pane) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "gMenuItem";
    b.innerHTML = `<span class="gmTtl">${pane.dataset.label || "案内"}</span>`
      + (pane.dataset.desc ? `<span class="gmDesc">${pane.dataset.desc}</span>` : "")
      + `<span class="gmArrow">›</span>`;
    b.addEventListener("click", () => show(pane.id));
    menu.appendChild(b);
  });
  h2.insertAdjacentElement("afterend", menu);

  /* 一覧に戻る */
  const back = document.createElement("button");
  back.type = "button";
  back.className = "gBack";
  back.textContent = "‹ 目次にもどる";
  back.addEventListener("click", () => show(null));
  menu.insertAdjacentElement("afterend", back);

  /* ページ全体の注記(.gNote)は目次の末尾に、たたんだ状態で置く(目次を短く保つ) */
  const notes = [].slice.call(panel.querySelectorAll(".gNote"));
  if (notes.length) {
    const box = document.createElement("details");
    box.className = "gNoteBox";
    box.innerHTML = "<summary>💡 ちょっとしたコツ</summary>";
    notes.forEach((n) => box.appendChild(n));
    menu.appendChild(box);
  }

  /* 「すべて開く／すべて閉じる」(アコーディオンは1問ずつ開く前提だが、
     通しで読みたい人・ページ内検索したい人のために一括も用意する) */
  panel.querySelectorAll(".faqAll").forEach((btn) => {
    btn.addEventListener("click", () => {
      const items = [].slice.call(btn.closest(".gPane").querySelectorAll(".faqItem"));
      const openAll = items.some((d) => !d.open);
      items.forEach((d) => { d.open = openAll; });
      btn.textContent = openAll ? "すべて閉じる" : "すべて開く";
    });
  });

  function show(id) {
    panes.forEach((p) => {
      const on = p.id === id;
      p.style.display = on ? "block" : "none";
      p.querySelectorAll("video").forEach((v) => {
        if (on) { v.preload = "auto"; v.play().catch(() => {}); } else { v.pause(); }
      });
    });
    menu.style.display = id ? "none" : "block";
    back.style.display = id ? "block" : "none";
    panel.scrollTop = 0;
  }
  show(null);
  return show;
}

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
      /* 表示中のページの動画だけ再生する(目次表示のまま裏で再生すると通信量を無駄に使う) */
      media.preload = "none";
      const ensurePlay = () => { if (!document.hidden && media.paused && media.offsetParent !== null) media.play().catch(() => {}); };
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

  /* ガイドの中身を「目次 → 選んだ1項目」の2段にする(段階的開示)。
     開いた直後に説明を全部並べると読む前に諦められるため、まず見出しだけ見せる。 */
  buildGuideMenu(panel);

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
     ここで落とすとアプリ全体が止まるので、保存できなくても動作は続ける。
     ただし黙って握りつぶすと「保存されたつもりで消える」ので、画面に警告を出す
     (実測: 3000点のGPXルート83本=約5MBで QuotaExceededError。以降の変更は保存されない) */
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn("この環境ではブラウザに保存できませんでした:", key, e);
    const quota = /quota|exceed/i.test(e.name || "") || e.code === 22 || e.code === 1014;
    showAppNotice(quota
      ? "⚠️ <b>この端末に保存できませんでした(保存容量がいっぱいです)。</b>いまの変更は、次にひらいたときには消えています。「💾 GeoJSON書出」でファイルに書き出して保管し、不要な図形(とくに長いGPXルート)を削除してください。"
      : "⚠️ <b>この端末に保存できませんでした。</b>プライベートブラウズ等では保存できないことがあります。「💾 GeoJSON書出」でファイルに書き出して保管してください。",
      "err");
    return false;
  }
}

/* ---- ファイル入出力 ---- */
/* iOS Safari 対策で2点:
   (1) アンカーを DOM に入れてから click する
   (2) Blob URL の破棄(revokeObjectURL)を遅らせる
   click 直後に同期で破棄すると、ダウンロード開始が非同期なブラウザ(iOS Safari 等)では
   書き出しがキャンセルされ「保存したのにファイルが無い」状態になる。 */
function downloadFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 60000);
}

/* ---- 画面上の通知バー(保存失敗・別タブ警告など) ----
   alert と違い操作を止めないが、見落とさないよう画面最上部に固定で出す。 */
function showAppNotice(html, level, actions) {
  let bar = document.getElementById("appNotice");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "appNotice";
    document.body.appendChild(bar);
  }
  if (bar.dataset.msg === html && bar.style.display === "flex") return bar; /* 同じ内容を重ねない */
  bar.dataset.msg = html;
  bar.className = "appNotice" + (level === "warn" ? " warn" : "");
  bar.innerHTML = `<span class="anTxt">${html}</span>`;
  (actions || []).forEach((a) => {
    const b = document.createElement("button");
    b.className = "anBtn";
    b.type = "button";
    b.textContent = a.label;
    b.onclick = a.onClick;
    bar.appendChild(b);
  });
  const close = document.createElement("button");
  close.className = "anClose";
  close.type = "button";
  close.setAttribute("aria-label", "閉じる");
  close.textContent = "✕";
  close.onclick = () => { bar.style.display = "none"; bar.dataset.msg = ""; };
  bar.appendChild(close);
  bar.style.display = "flex";
  return bar;
}

/* ---- 地図に重ねた箱(凡例など)を画面の端へ畳めるようにする ----
   「»」を押すと画面の右端(左側の箱なら左端)へスライドして外へ逃げ、
   縦書きの細いタブだけが残る。タブを押すと戻る。
   YouTubeのミニプレーヤーを画面の枠外へどかす操作のイメージ
   (メンバー要望 2026-09-18「世帯数のウィンドウが大きめ」「右端に折りたためるように」)。
   開閉はタブを開いている間だけ覚える(sessionStorage)。
     div    : L.DomUtil.create("div","legend") 等で作った箱
     mini   : 畳んだときにタブへ縦書きで出す短いラベル(例 "🏠 世帯数")
     key    : 開閉状態を覚えるキー(null なら覚えない=毎回開いた状態から)
     render : 中身を書き込む関数 render(bodyEl)。開くたびに呼ばれる */
/* 凡例の1行を作る。色チップとラベルを flex で横並びに固定し、
   箱が狭いときに「チップだけ残ってラベルが次の行へ落ちる」折り返しを防ぐ。
   (インライン要素＋<br> で組むと、行の残り幅が足りない時にチップとラベルの間で改行される) */
function legendRow(swatchHtml, label) {
  return `<div class="lgRow">${swatchHtml}<span class="lgLabel">${label}</span></div>`;
}

function addBoxCollapse(div, mini, key, render) {
  const SKEY = key ? "senkyoMaps." + key + ".open" : null;
  let open = true;
  try { if (SKEY && sessionStorage.getItem(SKEY) === "0") open = false; } catch (e) { /* 読めなければ既定=開く */ }
  /* どちらの端へ逃がすかは、Leaflet のどの隅に置かれたかで決める。
     onAdd の時点ではまだ隅に入っていない(parentElement が null)ので、
     入った直後にもう一度見て左右を確定する。 */
  let side = "right";
  function applySide() {
    const par = div.parentElement;
    if (par) side = /leaflet-left/.test(par.className) ? "left" : "right";
    div.classList.toggle("boxLeft", side === "left");
  }
  function draw() {
    div.classList.toggle("boxMini", !open);
    if (open) {
      const arrow = side === "left" ? "«" : "»";
      const where = side === "left" ? "左端" : "右端";
      div.innerHTML = `<button type="button" class="boxToggle" title="${where}に畳む" aria-label="${where}に畳む">${arrow}</button><div class="boxBody"></div>`;
      render(div.querySelector(".boxBody"));
    } else {
      div.innerHTML = '<button type="button" class="boxToggle boxOpenBtn" title="開く"></button>';
      div.querySelector(".boxToggle").textContent = mini;
    }
    div.querySelector(".boxToggle").onclick = (ev) => {
      ev.preventDefault();
      /* ここで innerHTML を作り直すとこのボタンがDOMから外れ、Leaflet の
         「コントロール上のクリックは地図に伝えない」判定(親を辿る)が効かなくなる。
         結果、凡例を畳んだだけで地図タップ扱いになり道具が全部隠れてしまうので、
         自分で伝播を止める(実測で再現・2026-09-18) */
      ev.stopPropagation();
      setOpen(!open);
    };
  }
  function setOpen(v) {
    if (open === v) return;
    open = v;
    try { if (SKEY) sessionStorage.setItem(SKEY, open ? "1" : "0"); } catch (e) { /* 保存不可でも動作は継続 */ }
    applySide();
    draw();
  }
  /* 箱の上のクリック・ドラッグを地図に伝えない(地図タップでの一括非表示や
     地図の移動が、凡例を触っただけで起きてしまうのを防ぐ) */
  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);
  draw();
  /* 隅に入った直後に左右を確定して描き直す(初回だけ) */
  setTimeout(() => { applySide(); draw(); }, 0);
  return { redraw: draw, isOpen: () => open, setOpen };
}

/* ---- 地図の何もない所をタップして、重ねている道具を一括で隠す/戻す ----
   ボタン・凡例・パネルをまとめて消し、地図だけの表示にする(メンバー要望 2026-09-18)。
   次のタップは「道具の開け閉め」ではないので対象外にする:
     ・図形やピンの上のタップ(ポップアップが開く)
     ・コントロール類の上のタップ
     ・ポップアップを閉じたタップ(閉じるだけ。続けて道具まで消さない)
     ・作図/編集中(geoman)や地点追加モード中(タップが作業そのものの操作)
   地図の出典表示(クレジット)は隠さない(表示義務があるため)。
     opts.busy: () => true の間はタップでの切替をしない(街宣マップの追加モード等) */
function addUiHideControl(map, opts) {
  opts = opts || {};
  const container = map.getContainer();
  let hidden = false, lastPopupClose = 0, hintShown = false;

  /* 戻すための小さなボタン(隠している間だけ画面下に出す) */
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "uiShowChip";
  chip.textContent = "⛶ ツールを表示";
  chip.title = "隠したボタン・凡例を表示する(地図の何もない所をタップしても戻ります)";
  chip.style.display = "none";
  container.appendChild(chip);
  L.DomEvent.disableClickPropagation(chip);
  chip.onclick = () => setHidden(false);

  function setHidden(v) {
    if (hidden === v) return;
    hidden = v;
    container.classList.toggle("uiHidden", v);
    /* 地図の外にある上部のボタン帯・説明バーも一緒に隠す(中村さん指示 2026-09-18)。
       ここを隠すと地図の高さが変わるので invalidateSize で作り直す。
       免責バー(.noticebar)は法務レビュー済みの表示のため、ここでは隠さない
       (元から✕で閉じられる)。 */
    document.body.classList.toggle("uiHidden", v);
    map.invalidateSize({ animate: false });
    chip.style.display = v ? "block" : "none";
    if (v && !hintShown) {
      hintShown = true;
      showMapToast(container, "ツールを隠しました。地図の何もない所をもう一度タップすると戻ります");
    }
  }

  /* 作図・編集・削除モード中か(leaflet-geoman。入っていないページでは常に false) */
  function busy() {
    if (opts.busy && opts.busy()) return true;
    const pm = map.pm;
    if (!pm) return false;
    return ["globalDrawModeEnabled", "globalEditModeEnabled", "globalDragModeEnabled",
      "globalRemovalModeEnabled", "globalCutModeEnabled", "globalRotateModeEnabled"]
      .some(n => typeof pm[n] === "function" && pm[n]());
  }

  map.on("popupclose", () => { lastPopupClose = Date.now(); });
  map.on("click", (ev) => {
    if (ev.propagatedFrom) return;            /* 図形・ピンの上 */
    const t = ev.originalEvent && ev.originalEvent.target;
    /* 押した要素が既にDOMから外れている = パネル側がクリックを受けて中身を作り直した
       (世帯数パネルの都道府県を開く、凡例を畳む等)。地図のタップではないので対象外 */
    if (t && t.isConnected === false) return;
    if (t && t.closest && t.closest(".leaflet-control-container, .guidePanel, .listPanel, .uiShowChip, .mapToast")) return;
    if (busy()) return;
    if (Date.now() - lastPopupClose < 400) return; /* 直前のタップでポップアップを閉じた */
    setHidden(!hidden);
  });

  /* タップで隠せない場面(世帯数レイヤの上など、どこを押しても図形に当たるとき)の
     ための明示ボタン。押すと隠れ、戻すのは下の「⛶ ツールを表示」から */
  const ctl = L.control({ position: "topleft" });
  ctl.onAdd = () => {
    const btn = L.DomUtil.create("button", "uiHideBtn");
    btn.textContent = "⛶";
    btn.title = "ツール(ボタン・凡例)を隠して地図を広く使う";
    L.DomEvent.disableClickPropagation(btn);
    btn.onclick = () => setHidden(true);
    return btn;
  };
  ctl.addTo(map);

  return { setHidden, isHidden: () => hidden };
}

/* 地図の上に数秒だけ出る小さな案内(操作を止めない) */
function showMapToast(container, text, ms) {
  const t = document.createElement("div");
  t.className = "mapToast";
  t.textContent = text;
  container.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, ms || 3000);
}

/* ---- 同じマップを別タブで開いたときの上書き事故を防ぐ ----
   保存は「そのタブが持っている全データで丸ごと上書き」なので、2つのタブで編集すると
   あとから保存した側で上書きされ、先に保存した側の変更が消える(実測で再現)。
   storage イベントは「他のタブが書き換えたとき」だけ飛ぶので、それを検知して警告する。 */
function watchOtherTabs(keys) {
  const watch = [].concat(keys || []);
  window.addEventListener("storage", (ev) => {
    if (!ev.key || watch.indexOf(ev.key) < 0) return;
    showAppNotice(
      "⚠️ <b>このマップを別のタブ(または別ウィンドウ)でも開いています。</b>両方で編集すると、あとから保存した側で上書きされ、片方の変更が消えます。<b>タブは1つにしてください。</b>",
      "warn",
      [{ label: "🔄 最新の内容に更新", onClick: () => location.reload() }]);
  });
}

/* ---- iPhone/iPad で「⬇️ アプリを保存」を押したときの案内 ----
   iOS は保存したHTMLを開いてもファイル内のプログラム(JavaScript)を動かさないため、
   地図が表示されない。落としてから気づくと原因が分からないので、押した時点で説明する。 */
function isIOS() {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
function guardStandaloneDownload() {
  document.querySelectorAll("a.dlbtn").forEach((a) => {
    a.addEventListener("click", (ev) => {
      if (!isIOS()) return;
      const ok = confirm(
        "iPhone・iPadでは、保存したファイルを開いても地図が表示されません。\n" +
        "(iOSの仕様で、ファイル内のプログラムが動かないためです)\n\n" +
        "このページのURLをそのままお使いください。\n共有ボタン →「ホーム画面に追加」でアプリのように開けます。\n\n" +
        "※PC・Androidでは保存したファイルを開けます。人に渡す目的ならこのまま保存できます。\n\n" +
        "それでも保存しますか?");
      if (!ok) ev.preventDefault();
    });
  });
}
document.addEventListener("DOMContentLoaded", guardStandaloneDownload);
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

  /* ===== 選択パネル(都道府県 > 自治体 > 区の3階層 + 絞り込み) =====
     全国の市区を収録すると自治体が800件を超えるので、都道府県でたたんで出す。
     都道府県そのものにはチェックを付けない(一県まるごとONは数十MBの読込になり
     事故のもとなので、意図して自治体を選ばせる)。 */
  const expanded = new Set();      /* 区の一覧を開いている自治体の添字 */
  const openPrefs = new Set();     /* 開いている都道府県名 */
  let query = "";                  /* 絞り込み文字列 */
  let panelBody = null, panelWrap = null, prefOrder = [], byPref = {};

  function indexCities() {
    prefOrder = []; byPref = {};
    cities.forEach((c, ci) => {
      if (!byPref[c.pref]) { byPref[c.pref] = []; prefOrder.push(c.pref); }
      byPref[c.pref].push(ci);
    });
  }

  function cityState(ci) {
    const ws = cities[ci].wards;
    const on = ws.filter(w => desired.has(w.code)).length;
    return on === 0 ? "off" : (on === ws.length ? "on" : "part");
  }
  function cityHasSelection(ci) { return cityState(ci) !== "off"; }

  function cityRow(ci) {
    const c = cities[ci];
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
        <label class="stCityLbl"><input type="checkbox" data-city="${ci}"${st === "on" ? " checked" : ""}><b>${c.city}</b>${query ? `<span class="stPref">${c.pref}</span>` : ""}</label>
        ${sub2 ? `<button type="button" class="stExp" data-exp="${ci}" aria-label="区の一覧">${open ? "▾" : "▸"}<span class="stCnt">${c.wards.length > 1 ? c.wards.length + "区" : c.wards[0].name}</span></button>` : ""}
      </div>${sub}</div>`;
  }

  function renderPanel() {
    if (!panelBody) return;
    let rows;
    if (query) {
      /* 絞り込み中は都道府県のたたみを無視して該当自治体だけ並べる
         (都道府県名・自治体名・区名のどれに当たっても拾う) */
      const hit = cities.map((c, ci) => ci).filter(ci => {
        const c = cities[ci];
        return (c.city + c.pref + c.wards.map(w => w.name).join("")).indexOf(query) >= 0;
      });
      rows = hit.length
        ? `<div class="stNote">「${query}」に一致: ${hit.length}件</div>` + hit.map(cityRow).join("")
        : `<div class="stNote">「${query}」に一致する自治体はありません。未収録なら下のリンクからリクエストできます</div>`;
    } else {
      rows = prefOrder.map(pf => {
        const cis = byPref[pf];
        const open = openPrefs.has(pf);
        const nSel = cis.filter(cityHasSelection).length;
        return `<div class="stPrefBlock">
          <button type="button" class="stPrefRow" data-pref="${pf}">
            <span class="stPrefArrow">${open ? "▾" : "▸"}</span><b>${pf}</b>
            <span class="stCnt">${cis.length}</span>
            ${nSel ? `<span class="stSel">${nSel}件選択中</span>` : ""}
          </button>
          ${open ? `<div class="stPrefCities">${cis.map(cityRow).join("")}</div>` : ""}
        </div>`;
      }).join("");
    }
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
    /* leaflet-bar は付けない。付けると Leaflet 既定の
       `.leaflet-bar a { width:26px; height:26px; display:block }` がパネル内のリンク
       (自治体の追加リクエスト)にも効いて、文字が26px幅に縦折り返しされてしまう。
       見た目は .setaiCtl / .stToggle 側で作っているので不要。 */
    panelWrap = L.DomUtil.create("div", "setaiCtl");
    panelWrap.innerHTML =
      `<button type="button" class="stToggle" title="世帯数レイヤを選ぶ">🏠</button>
       <div class="stPanel" hidden>
         <div class="stHead">🏠 世帯数(2020国勢調査)<button type="button" class="stClose" aria-label="閉じる">✕</button></div>
         <div class="stSearch"><input type="search" class="stQ" placeholder="🔍 自治体名で絞り込み(例: 横浜)" autocomplete="off"></div>
         <div class="stBody"></div>
       </div>`;
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

    /* 絞り込み欄は stBody の外に置く。stBody は innerHTML で作り直すため、
       中に入れると入力のたびにフォーカスとカーソル位置が飛ぶ */
    const q = panelWrap.querySelector(".stQ");
    q.addEventListener("input", () => { query = q.value.trim(); renderPanel(); });

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
      if (t.dataset.pref != null) {
        const pf = t.dataset.pref;
        openPrefs.has(pf) ? openPrefs.delete(pf) : openPrefs.add(pf);
        renderPanel();
      } else if (t.dataset.exp != null) {
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

  /* ===== 凡例 =====
     世帯数を表示していないときは凡例そのものを出さない。
     自治体を選んで世帯数が地図に出た時点で、開いた状態で現れる(色の意味が分かるように)。
     そのあとは「»」で右端へ畳める。畳んだ状態は覚えない(= キーを渡さない)。
     世帯数を全部OFFにすると凡例ごと消え、次に選び直したときにまた開いて出る。
     (メンバー要望 2026-09-18) */
  let legendCtl = null, legendBox = null;
  function refreshLegend() {
    const active = desired.size > 0 || (opts.extra && map.hasLayer(opts.extra.layer));
    if (active && !legendCtl) {
      legendCtl = L.control({ position: "bottomright" });
      legendCtl.onAdd = () => {
        const div = L.DomUtil.create("div", "legend");
        legendBox = addBoxCollapse(div, "🏠 世帯数", null, (body) => {
          body.innerHTML = `<div style="font-weight:700;margin-bottom:2px">🏠 世帯数(2020国勢調査)</div>` +
            SETAI_BINS.map(b => legendRow(`<i class="sq" style="background:${b.color}"></i>`, b.label)).join("") +
            `<div style="font-size:9.5px;color:#888;margin-top:3px;max-width:150px">${SETAI_CREDIT}</div>` +
            `<div style="margin-top:3px"><a href="#" class="setaiReqLink" style="font-size:10.5px">➕ 自治体の追加をリクエスト</a></div>`;
          const rl = body.querySelector(".setaiReqLink");
          if (rl) rl.onclick = (ev) => { ev.preventDefault(); openReqModal(); };
        });
        return div;
      };
      legendCtl.addTo(map);
      if (legendBox) legendBox.setOpen(true); /* 出るときは必ず開いた状態で */
    } else if (!active && legendCtl) {
      map.removeControl(legendCtl);
      legendCtl = null;
      legendBox = null;
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
      indexCities();
      restore();
      if (desired.size) {
        /* 復元した選択は、その都道府県と自治体を開いた状態にする(どれが入っているか見えるように) */
        desired.forEach(code => {
          const ci = wards[code].cityIdx;
          openPrefs.add(cities[ci].pref);
          if (setaiHasSub(cities[ci])) expanded.add(ci);
        });
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
