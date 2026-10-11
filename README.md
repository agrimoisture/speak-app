# 英語口說練習

手機優先的英語口說練習頁。介面與說明是繁體中文（台灣），對話是英語。瀏覽器直接把麥克風的原始音訊送給 [Gemini Live API](https://ai.google.dev/gemini-api/docs/live-api)，並播放模型回傳的語音。中間沒有另外的語音轉文字步驟。

這是靜態網站，沒有後端、沒有建置步驟。部署目標是 GitHub Pages。

## 金鑰只留在你的裝置

這個倉庫是公開的，**不要把 API 金鑰提交進來**。

第一次打開時，把自己的 Gemini API 金鑰貼上。它只寫進這台手機或電腦的 `localStorage`（鍵名 `speak-app.apiKey`）。設定頁可以清除或更換。金鑰會由瀏覽器直接拿去連 Google，不會傳到這個網站的伺服器——因為沒有伺服器。

官方建議正式產品用[暫時性權杖（ephemeral tokens）](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens)。建立權杖必須由你的後端拿著金鑰去呼叫，這個純靜態頁做不到。所以這裡用「自己貼上的金鑰」給個人練習。請不要把金鑰貼到別處，也不要在共用的瀏覽器上留下它。

免費層的對話內容可能會被 Google 用來改善產品。見[定價頁](https://ai.google.dev/gemini-api/docs/pricing)的 Free 說明。

## 使用的模型與限制

對照官方文件的日期：**2026-10-11**。

語音對話使用 **`gemini-3.8-live`**。

- [模型頁](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-live)把它標成穩定版，並寫成大多數低延遲語音體驗的預設選擇（2026 年 9 月更新）。原生音訊只接受 `AUDIO` 回應；`thinkingLevel` 不支援；把 `proactiveAudio` 設成 `false` 會報錯。
- [定價頁](https://ai.google.dev/gemini-api/docs/pricing)把 `gemini-3.8-live`、`gemini-3.8-live-extended-thinking`、`gemini-3.1-flash-live-preview` 的輸入與輸出都標成 Free tier「Free of charge」。本頁選文件建議的預設模型 `gemini-3.8-live`。
- [速率限制頁](https://ai.google.dev/gemini-api/docs/rate-limits)（2026-10-09）**沒有公布**免費層固定的 RPM、TPM、RPD。額度依專案而定，要到 AI Studio 看，而且文件寫明不保證。免費層沒有消費金額上限（表上是 N/A）。遇到 429 就是超過你那個專案的額度。
- [Live 能力說明](https://ai.google.dev/gemini-api/docs/live-api/capabilities)：模型輸入上限 131,072 tokens、輸出上限 65,536 tokens；原生語音的上下文約 128k tokens。音訊輸入是 16-bit PCM、16 kHz、little-endian；輸出是 24 kHz PCM。
- [工作階段管理](https://ai.google.dev/gemini-api/docs/live-api/session-management)：沒有壓縮時，純語音大約 15 分鐘；單條 WebSocket 大約 10 分鐘，結束前會送 `GoAway`。本頁有開啟 context window compression（sliding window）與 session resumption，讓練習可以接過這兩段限制。續接權杖在最後一次工作階段結束後約 2 小時內有效。

結束練習後的書面回饋改呼叫 **`gemini-3.8-flash`** 的 `generateContent`。定價頁同樣把它列在免費層。Live 模型只回語音，所以文字回饋是另外一次請求：材料是逐字稿，加上 Live 模型在結束時用語音說、再轉成文字的發音筆記。發音筆記只採用它真正講出來的內容，文字模型不會從逐字稿猜發音。

逐字稿來自 Live API 的 `inputAudioTranscription` / `outputAudioTranscription`。有回傳就顯示，沒有就保持空白。

## 怎麼用

1. 用手機瀏覽器打開網站（建議 iOS Safari 或 Chrome）。
2. 貼上 API 金鑰。到 [Google AI Studio](https://aistudio.google.com/apikey) 建立。
3. 看今日主題。日期以台北時間計算，同一天會落到同一題，除非你按「換一個主題」或輸入自訂主題。
4. 選難度：初級 / 中級 / 進階。對方的用字和語速會跟著變。
5. 選「點按說話」或「免持」，然後開始。對方會先用英語開口。
6. 點按模式：點一下開始把聲音送出，再點一下結束這句。按鈕變紅、並顯示秒數時，才是正在傳送。麥克風會先保持開啟，避免吃掉句子開頭。
7. 免持：麥克風持續傳送，對方自己判斷你說完了。可以再點大按鈕暫停。
8. 按「結束」取得繁體中文回饋（文法、更自然的說法、發音、三句複習），並存進這台裝置的練習紀錄。

iOS Safari 需要在使用者點擊的當下解鎖 `AudioContext` 並請求麥克風。若權限被拒，頁面會用中文說明要到「設定 › Safari › 麥克風」允許。麥克風只能在 HTTPS（或電腦上的 localhost）使用。

## 本機預覽

不需要安裝套件。

```bash
cd site
python3 -m http.server 4173
```

打開 <http://127.0.0.1:4173>。

單元測試：

```bash
node --test tests/*.test.mjs
```

模擬瀏覽器流程（需要本機的 Chrome，以及暫時安裝的 `puppeteer-core`，不會寫進這個倉庫）：

```bash
npm install --prefix /tmp/speak-e2e puppeteer-core
node tests/e2e.mjs
```

## 部署到 GitHub Pages

推上 `main` 之後，[`.github/workflows/pages.yml`](.github/workflows/pages.yml) 會把 `site/` 部署到 GitHub Pages。

倉庫擁有者需要在 GitHub：**Settings → Pages → Build and deployment → Source：GitHub Actions**。這個開關要手動打開一次。在那之前，workflow 就算在 `main` 上跑也不會變成網站。

網站位址會是 `https://agrimoisture.github.io/speak-app/`。資源都用相對路徑，所以放在專案子路徑沒問題。也可以用瀏覽器的「加入主畫面」。`manifest.webmanifest` 會讓它以獨立 App 的方式打開。

## 測試範圍

單元測試涵蓋每日主題（含台北換日）、主題重抽、自訂主題、金鑰與紀錄的 localStorage、Live WebSocket 訊息（點按的 `activityStart` / `activityEnd`、免持、斷線續接、結束時的發音請求），以及模擬的伺服器訊息。

另外用無頭 Chrome 走了一次介面：貼上金鑰、重新整理後金鑰還在、換主題、自訂主題、難度、模擬的 WebSocket 對話、結束後的回饋與紀錄、清除金鑰。

**沒有用真的 Gemini API 金鑰。** 所以沒有驗證真實的雙向語音、iPhone 上的麥克風與喇叭、或免費層實際會在第幾次請求回 429。那些要等你貼上自己的金鑰，在手機上試一次。
