# TGMember

## 本地資料建立方式

### backend-api 本地 SQLite 資料庫
1. 進入 backend API 目錄：
   ```bash
   cd services/backend-api
   ```
2. 啟動服務（啟動時會自動建立資料表）：
   ```bash
   uvicorn main:app --reload
   ```
3. 若需要初始化範例資料，可匯入 seed SQL：
   ```bash
   sqlite3 tgmember.db < seed.sql
   ```

> `tgmember.db` 屬於本機執行資料，不應提交到版本控制。

## 不應提交的檔案

請勿提交以下產物檔案：
- Python 快取：`__pycache__/`、`*.pyc`、`*.pyo`
- 本機資料庫：`*.db`（包含 `services/backend-api/tgmember.db`）
- 其他本機執行產物（例如測試快取、暫存檔）

若需要共享初始資料，請改提交 seed 腳本或 SQL dump 範本（例如 `services/backend-api/seed.sql`），而非直接提交執行中的資料庫檔。
