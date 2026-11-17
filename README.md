# 百年茶緣 


## 字型與授權

介面使用 [俐方體 11 號 Cubic 11](https://github.com/ACh-K/Cubic-11)，包含繁體中文及日文假名。隨專案附上 [SIL Open Font License 1.1 與上游授權文件](assets/Cubic-11-OFL.txt)，可用於比賽和公開展示。

## 變更紀錄

### 2026-11-17 15:07（UTC+8）｜新增兩週 MVP 開發規劃

- 將原始 Markdown 規劃放到 [docs/PLAN.md](docs/PLAN.md)，供七章協作查閱。
- 驗證：規劃檔與來源 SHA-256 一致。回復方式：回復本文件提交。

### 2026-11-17 14:37（UTC+8）｜第一章視覺修正

- 分支與版本：fix/style-pass，第一章視覺修正版。
- 改動：採茶袖臂重採樣、空杯內壁改用深色實色、水壺倒水位置往右下移、像素字型與啟動畫面、啟動時預先載入場景和道具。
- 原因：對齊採茶背景的像素密度、區分空杯和茶湯、改善阿嬤臉前方的遮擋、減少互動面板初次載入留白。
- 測試：JavaScript 語法、差異格式與素材規格檢查。瀏覽器畫面、主角尺寸與三個場景各五次切換待實機驗收。
- 回復方式：回復本分支的視覺修正提交。

### 2026-11-17 15:51（UTC+8）｜更新第一章視覺修正分支

- 整合最新 main，保留兩週 MVP 規劃和視覺修正紀錄。
- 維持泡茶階段與主角尺寸。瀏覽器未產出驗收截圖，主角比例、倒水遮擋及場景切換仍待確認。
- 回復方式：回復本分支合併的 PR。

## Windows 與 Mac 開發

1. 安裝 Node.js（建議使用仍受支援的 LTS 版本，最低需 Node.js 18）。
2. 在專案根目錄執行 `npm install` 安裝美術工具依賴。
3. 用瀏覽器直接開啟根目錄的 `index.html` 進入遊戲。
4. 新圖放入 `assets/raw/` 並在 `assets/sizes.json` 登記尺寸。執行 `npm run art:pixelize` 產出圖片，再執行 `npm run art:check`。
5. `archive/pixel-art.ps1` 保留作為舊版基準，平常開發使用 Node.js 指令。舊工具的色票重新取樣模式仍保留在該腳本。本工具使用既有的固定 48 色色票。

### 2026-11-17 19:08（UTC+8）｜跨平台美術工具

- 分支：chore/cross-platform-tools。以 Node.js 與純 JavaScript 的 pngjs 執行美術轉換與檢查，保留舊 PowerShell 腳本。
- 加入 LF 與二進位規則，以及 macOS 和 npm 忽略項目。換行獨立成提交。
- Windows：npm install、art:pixelize、art:check 均通過。六張圖共 748,800 個 RGBA 像素與舊版一致，檔名大小寫檢查未發現不一致。
- 遊戲原始碼及已發布的圖片沒有內容變更。Mac 和瀏覽器實機未測。
- 回復方式：回復本 PR 中的工具與換行提交。

### 2026-11-17 19:40（UTC+8）｜建立第 2～7 章獨立資料夾

- 新增 `chapters/chapter-02/` 至 `chapters/chapter-07/`。每章可直接開啟自己的 `index.html` 測試完成按鈕。
- 組員各自在自己的章節資料夾與分支開發。新增素材放在各章的 `assets/`，完成後開 PR 互相試玩。
- 最後整合時，會在主畫面加上各章入口，並用 localStorage 的 `bainian-chapter-0X` 判斷紀念幣。本次只建立章節骨架。
- 回復方式：回復本 PR。
