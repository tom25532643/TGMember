# 第三階段 API 設定報告

日期：2026-06-19

## 範圍

這次整理 mobile/PWA 的 API base URL 設定方式，讓 production DNS、NAS LAN、本機開發可以用環境變數切換，不再需要直接修改程式碼。

## 已完成項目

- 更新 `tgmember-mobile/config/api.ts`，加入 API target presets。
- 預設 target 為 `production`，維持既有 DNS：
  - `https://tdlib.tgmembertools.com`
  - `https://api.tgmembertools.com`
- 新增 `local` target：
  - `http://127.0.0.1:8000`
  - `http://127.0.0.1:8001`
- 新增 `nas` target，可透過 `EXPO_PUBLIC_NAS_HOST` 產生 NAS LAN URL。
- 支援直接覆蓋：
  - `EXPO_PUBLIC_TDLIB_BASE_URL`
  - `EXPO_PUBLIC_CRM_BASE_URL`
- 新增 `tgmember-mobile/.env.example`，提供 PWA API target 範例。
- 更新 README 的 mobile API target 說明。

## 使用方式

Production 預設不用設定。

NAS LAN 測試可建立 `tgmember-mobile/.env`：

```env
EXPO_PUBLIC_API_TARGET=nas
EXPO_PUBLIC_NAS_HOST=192.168.1.10
```

如果要直接指定完整 URL：

```env
EXPO_PUBLIC_TDLIB_BASE_URL=https://tdlib.tgmembertools.com
EXPO_PUBLIC_CRM_BASE_URL=https://api.tgmembertools.com
```

## 尚待處理

- `apps/admin-ui` 仍有獨立 config，目前尚未和 PWA config 合併。
- 若要在瀏覽器 runtime 動態切換 API，不重新 build，後續需要改成載入外部 `config.json` 或 server-injected config。