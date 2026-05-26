# backend-api 設定說明

## `TDLIB_SERVICE_BASE_URL`

`backend-api` 透過 `TDLIB_SERVICE_BASE_URL` 連到 tdlib-service。若未設定，預設值是：

- `http://127.0.0.1:8010`

啟動時會驗證 URL 格式，必須是合法的 `http`/`https` URL。

### 本機開發

```bash
export TDLIB_SERVICE_BASE_URL="http://127.0.0.1:8010"
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Docker Compose（同 network service 名稱）

```yaml
services:
  backend-api:
    environment:
      TDLIB_SERVICE_BASE_URL: http://tdlib-service:8010
```

### 遠端服務

```bash
export TDLIB_SERVICE_BASE_URL="https://tdlib-service.example.com"
uvicorn main:app --host 0.0.0.0 --port 8000
```
