# backend-api

FastAPI service for TGMember CRM data. It stores members, groups, tags, notes, and message logs, and delegates Telegram message delivery to `tdlib-service`.

## Configuration

`TDLIB_SERVICE_BASE_URL` points to the TDLib service.

Local default:

```bash
TDLIB_SERVICE_BASE_URL=http://127.0.0.1:8000
```

Docker Compose default:

```bash
TDLIB_SERVICE_BASE_URL=http://tgmember-tdlib:8000
```

## Run Locally

```bash
cd services/backend-api
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Health check:

```bash
curl http://127.0.0.1:8001/health
```

## Database

The local SQLite database is `tgmember.db`. It is ignored by git.

To seed a fresh local database:

```bash
sqlite3 tgmember.db < seed.sql
```
