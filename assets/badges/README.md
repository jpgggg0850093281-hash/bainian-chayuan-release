# 百年茶緣｜徽章素材庫

每章使用獨立資料夾。完成的徽章包含以下檔案：

```text
chNN-name/
  frames/000.png
  frames/060.png
  frames/120.png
  frames/180.png
  frames/240.png
  frames/300.png
  sprite.png
  front.png
  preview.mp4
```

## 分鏡與像素規格

- 每 60° 一格，依序為 0°、60°、120°、180°、240°、300°。沿垂直軸左右旋轉。240° 是 120° 的左右鏡像。300° 沿用 60° 的鏡像輪廓，正面文字及圖案須恢復正確方向。
- 0° 和 180° 顯示完整正面及背面，60° 和 300° 顯示變窄的正面及側邊厚度，120° 和 240° 顯示變窄的背面及側邊厚度。不前後傾斜或斜轉。
- 以第一章原圖約 372 × 367 像素的正面徽章為基準，單格為 **444 × 444 像素**，六格橫排為 **2664 × 444 像素**，底部基準線為距上緣 410 像素。每格只留徽章，Alpha 只允許 0 或 255。背景、外框、光暈、速度線和陰影由展示程式處理。
- 採像素風、深色描邊、兩到三階明暗，對齊像素格。以第一章紀念幣與第三章火候筆記為視覺參考。角度用獨立分鏡繪製，顯示一律採最近鄰，避免壓扁或平滑縮放來模擬旋轉。

### 既有圖集與六格素材

遊戲原本使用的 [茶寮新手四格圖集](../tea-coin-frames.png) 保留原位。素材庫六格版以原正面與背面去背，另補 60° 與 120°；90° 舊圖僅作邊框厚度參考。第三章沿用確認過的六方向火候筆記。兩章可在 [六格分鏡總覽](frames-overview.png) 對照。

## 領取動畫與影片

- 領取時兩圈約 1.8 秒，使用 ease-out 減速後停在 0°，最後輕輕回彈。遊戲在偏好減少動態效果的系統上只淡入正面。
- 單件預覽用 H.264 MP4，固定 30 fps、`yuv420p`，以 `-movflags +faststart` 將索引放到檔案前端。背景為 `#12271e`，徽章置中，兩圈後正面保留約 1 秒。影片尺寸為 444 × 444 像素。
- 第 2、4、5、6、7 章索引狀態為 `todo`，資料夾已預留。第一章與第三章標為 `ready`。

## 新增與更新

1. 把六張單格圖放進該章的 `frames/` 並用角度命名。
2. 從儲存庫根目錄執行 `npm ci`，再執行 `npm run badge:build -- <章節資料夾名>`。工具產生 `sprite.png`、`front.png`，並將 `badges.json` 同步成 `badges.js`。系統 PATH 有 FFmpeg 時也會產生 `preview.mp4`。缺少 FFmpeg 時會顯示提示並保留現有影片。
3. 更新 `badges.json` 的獲得說明等資料，素材及影片齊全後把該章標成 `ready`。
4. 再執行一次該章建置，然後執行 `npm run badge:check`。檢查會比對雙索引、單格尺寸和透明度、生成圖集及正面的像素，並確認影片存在。

以 `file://` 開啟時，可用一般 `<script src="assets/badges/badges.js"></script>` 取用 `window.BAINIAN_BADGES`。索引路徑以遊戲根目錄為基準。讀取方可依 `status` 判斷是否顯示徽章，並從 `angles` 定位 0° 的格號。

## 共用領取視窗

可直接開啟 [七章測試頁](../../preview/badges/award.html)。章節頁從適當的相對路徑載入下列資源：

```html
<link rel="stylesheet" href="assets/badges/badge-award.css">
<script src="assets/badges/badges.js" defer></script>
<script src="assets/badges/badge-award.js" defer></script>
```

章節完成時呼叫：

```js
window.showBadgeAward(2, { onClose: () => console.log("已關閉領取視窗") });
```

連續呼叫會依序開啟，`todo` 章節顯示「尚未完成」。播放中點視窗可略過至正面，待「收下」按鈕顯示後才可關閉。領取視窗動畫依序是視窗淡入、兩圈飛入、原地一圈、回彈及正面展示。飛入加原地旋轉約 1.5 秒。已開啟減少動態效果時，徽章直接淡入正面。
