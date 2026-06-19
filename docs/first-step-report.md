# 第一階段止血報告

日期：2026-06-19

## 範圍

這次只處理專案衛生與風險降低，沒有修改 Telegram、TDLib session、資料庫或廣播發送的業務邏輯。

## 已完成項目

- 將 Cloudflare tunnel token 從 `docker-compose.yml` 移出。
- 在 `.env.example` 補上 `CLOUDFLARED_TUNNEL_TOKEN` 範例變數。
- 擴充 `.gitignore`，忽略 pytest cache、前端 build output、`node_modules`、Synology/暫時輸出目錄，以及大型本機工具鏈 `vcpkg/`。
- 在 `services/backend-api/requirements.txt` 加上 `httpx`，讓 FastAPI `TestClient` 可以執行。
- 將亂碼 README 內容改成可讀的專案與服務說明。
- 建立本報告：`docs/first-step-report.md`。

## 安全提醒

先前 Cloudflare tunnel token 曾出現在版本化設定檔中，請視為已暴露。建議到 Cloudflare 重新產生/輪替 token，之後只放在本機 `.env` 或部署環境的 secret store。

## 已執行驗證

- Backend FastAPI TestClient health check：`200 {'status': 'ok'}`。
- TDLib service 測試：`44 passed, 19 skipped`。
- Mobile lint：完成，`0 errors, 6 warnings`。
- Mobile TypeScript 檢查：`npx tsc --noEmit` 成功通過。

## 驗證警告

- TDLib 測試仍有 FastAPI `on_event` deprecation warning。
- pytest 在 Synology Drive 資料夾內仍無法寫入 cache，這是本機權限/同步行為造成。
- Mobile lint 的 6 個 warnings 是既有 unused variables，位於 `tgmember-mobile/app/(tabs)/index.tsx`。

## 尚待處理

- `tgmember-mobile/app/(tabs)/index.tsx` 仍有 UI 文字亂碼。
- Expo web export 可能仍會被 Synology Drive 的 `dist` reparse/sync placeholder 卡住。
- FastAPI startup handler 仍使用已 deprecated 的 `on_event`。
- 既有的 `apps/admin-ui` 與 `services/tdlib-service/requirements.txt` 工作樹改動已保留，沒有在本階段處理。