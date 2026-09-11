# senkyo-maps — 選挙・政治活動マップツール

ポスター貼付けとポスティングの進捗を管理する、**ブラウザだけで動く**静的マップツールです。
GitHub Pages でホスティングしており、URL を開くだけで誰でも使えます。

- **公開URL**: https://yukinobu-nakamura.github.io/senkyo-maps/
- ポスターマップ: https://yukinobu-nakamura.github.io/senkyo-maps/poster.html
- ポスティングマップ: https://yukinobu-nakamura.github.io/senkyo-maps/posting.html

## 構成

| ページ | 用途 |
|---|---|
| `index.html` | トップ(メニュー) |
| `poster.html` | 選挙運動用ポスター掲示場の貼付け進捗管理(未/予約/完了/要確認/異常の色分けピン+完了率表示) |
| `posting.html` | 政治活動用ビラのポスティング区域・ルート管理(ポリゴン/線を描画、予定/配布中/済で色分け) |
| `assets/` | 共通CSS/JS |
| `data/boards.sample.json` | サンプル掲示場データ(**豊島区周辺のダミー座標**。実在の掲示場ではありません) |

## 設計方針(チームみらい poster-map との違い)

[team-mirai-volunteer/poster-map](https://github.com/team-mirai-volunteer/poster-map)(GPL-3.0)
— 2024年都知事選の安野たかひろ陣営が運用したシステム — の**仕組みを参考にした独自実装**です。
コードは流用せず書き下ろしています(GPL の継承を避けるため)。

| 観点 | チームみらい版 | 本実装 |
|---|---|---|
| スタック | Next.js + Prisma + Supabase + Netlify/Vercel | 素の HTML/JS + Leaflet のみ(ビルド不要) |
| 状態の共有 | サーバ(DB)で全員リアルタイム共有 | 端末内 localStorage + CSV/GeoJSON ファイルの受け渡し |
| データ整備 | normalizer / pdf-converter / map2csv 等の専用ツール群 | 選管公表資料を CSV 化して画面から読込 |
| ポスティング描画 | Leaflet-Geoman + Supabase 保存 | Leaflet-Geoman + localStorage 保存 |

小規模陣営が「立ち上げ5分・運用コストゼロ」で使えることを優先し、サーバを持たない設計にしています。
数十人規模でリアルタイム共有が必要になったら、チームみらい版(GPL-3.0)の導入を検討してください。

## ポスターマップの使い方

1. 選挙管理委員会が公表する「ポスター掲示場一覧」を CSV にする
   - 必須列: `lat`(緯度)・`long`(経度)。任意列: `id`, `name`(名称), `address`(住所), `status`, `note`
   - 列名は日本語(`緯度`/`経度`/`名称`/`住所`/`備考` 等)でも自動認識
   - 住所しかない場合は、国土地理院 API 等でジオコーディングして緯度経度列を作る
2. 画面右上「📂 CSV読込」で読み込む
3. ピンをタップ → ステータス(未/予約/完了/要確認/異常)とメモを保存
4. 「💾 CSV書出」でステータス込みの CSV を保存 → 他メンバーへ共有(相手は読込)

## ポスティングマップの使い方

1. 左のツールでポリゴン(配布区域)・線(配布ルート)を描く
2. 図形をタップ → 状態(予定/配布中/済)・**色(自動=状態色+8色)・濃さ(標準/薄め/最薄)**・担当・メモを保存
3. 「💾 GeoJSON書出」でファイル共有(相手は「📂 読込(GeoJSON/GPX)」で追加読込)。色・濃さもGeoJSONにそのまま乗る
4. **GPX取込**: スマホの記録アプリ等で取った歩行ルート(GPX)を「📂 読込」で配布ルート(線)として取り込める。複数の trk/rte をまとめた**結合GPX**も各ルートとして取り込む(実装: `assets/common.js` の `gpxToGeoJSON()`)。取込ルートは既定で「薄め」表示(図形タップで変更可)
5. **🏠 世帯数レイヤ**: 右上のレイヤボタンから、国勢調査2020・町丁目ごとの世帯数コロプレス+数値ラベルを重ねられる(クリックで町丁目名・世帯数・人口)
   - データ: `data/setai_<市区町村コード>.geojson`(現在: 豊島区13116・杉並区13115)
   - 追加方法: e-Stat 統計GISの境界データ(世界測地系緯度経度・shape形式)をDLし `python3 build/make_setai_geojson.py <r2kaXXXXX.shp> data/setai_<code>.geojson` → `posting.html` の `SETAI_SOURCES` に1行追加
   - クレジット: 政府統計の総合窓口(e-Stat) 国勢調査(2020年)小地域境界データを加工して作成(画面の凡例・ポップアップに表示)

## 注意事項

- データは**端末ごと**(ブラウザの localStorage)に保存されます。ブラウザのデータ消去で消えるため、こまめに書出でバックアップしてください
- 同梱のサンプル掲示場データはダミーです。実在の掲示場所とは無関係です
- 公職選挙法上、選挙運動用ポスターの掲出は掲示場・期間等のルールがあります。運用は各自治体の選管の案内に従ってください

## 残タスク(TODO)

- [ ] **使い方ガイドのデモ動画(GPX/GeoJSONタブ)** — 現在 `posting.html` のガイドは3タブ(🖊️手描き登録=既存動画あり / 📮GPX読込 / 📂GeoJSON共有)。後者2つは手順のみで「🎬準備中」表示。実機で画面録画し `assets/posting_gpx_demo.mp4`・`assets/posting_geojson_demo.mp4` を追加 → 該当 `.gPane` に `<video class="gVideo" src="assets/xxx_demo.mp4" autoplay muted loop playsinline ...>` を入れる。`node build/make_dist.mjs` で配布版(`dist/`)にも自動反映(`*_demo.mp4` は絶対URL化される)。

## ライセンス

MIT License(`LICENSE` 参照)。地図タイルは国土地理院・OpenStreetMap の利用規約に従います。
チームみらい版 [team-mirai-volunteer/poster-map](https://github.com/team-mirai-volunteer/poster-map)(GPL-3.0)の仕組みを参考にした独自実装(コード非流用)。
