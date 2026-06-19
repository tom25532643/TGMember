# 第二階段穩定性報告

日期：2026-06-19

## 範圍

這次目標是讓專案更容易在本機檢查與建置，並處理第一階段留下的 mobile UI 亂碼問題。沒有修改 TDLib session、Telegram 發送 API 或資料庫 schema。

## 已完成項目

- 新增 `scripts/check_all.ps1`，一鍵執行 backend health、TDLib tests、mobile lint、mobile typecheck。
- 在 `tgmember-mobile/package.json` 新增 `typecheck` script。
- 將 `build:web` 改成 `node ./scripts/build-web.js`，支援 `WEB_BUILD_DIR` 與 `WEB_BUILD_MAX_WORKERS`。
- 更新 `tgmember-mobile/workbox-config.js`，讓 workbox 依照 `WEB_BUILD_DIR` 產生 service worker。
- 新增 `tgmember-mobile/scripts/build-web.js`，在 Windows 預設使用單 worker，降低 Metro worker spawn 問題。
- 將 `tgmember-mobile/app/(tabs)/index.tsx` 的 UI、alert、log 文字改成可讀英文，並移除既有 unused state。
- 將 `tgmember-mobile/auth/authMachine.ts` 的登入錯誤訊息改成可讀英文。
- 更新 README 的一鍵檢查與本機 PWA build 說明。

## 已執行驗證

- `powershell -ExecutionPolicy Bypass -File scripts/check_all.ps1` 成功完成。
- Backend TestClient health：`200 {'status': 'ok'}`。
- TDLib service tests：`44 passed, 19 skipped`。
- Mobile lint：通過，已無先前 unused variable warnings。
- Mobile typecheck：通過。
- PWA build：使用 `WEB_BUILD_DIR=dist-local-codex` 與 `WEB_BUILD_MAX_WORKERS=1` 成功輸出，workbox service worker 也成功產生。

## 驗證警告

- TDLib tests 仍有 FastAPI `on_event` deprecation warning。
- pytest 仍因 Synology Drive 權限/同步行為無法寫入 cache。
- 第一次 PWA build 需要下載 `workbox-cli`；在受限網路下需要允許 npm/npx 存取 registry。
- Windows 下 build script 使用 shell 呼叫 `npx.cmd`，Node 會輸出 `DEP0190` warning；目前不影響 build 成功。

## 尚待處理

- `apps/admin-ui` 仍有既有未提交改動，尚未納入本階段整理。
- Production/local API config 尚未做完整環境切換策略。
- FastAPI `on_event` 應在後續改為 lifespan handler。
- Synology Drive 內既有 `tgmember-mobile/dist` reparse placeholder 仍可能卡住預設 `dist` build；本階段已提供 `WEB_BUILD_DIR` 作為替代路徑。