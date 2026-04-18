# TGMember TDLib Service Refactor

## Structure

- `app/core/config.py` - config and constants
- `app/core/errors.py` - custom exceptions
- `app/services/tdjson_client.py` - low-level TDLib wrapper
- `app/services/parsers.py` - DTO / parser helpers
- `app/services/session.py` - per-user session and session manager
- `app/ws/manager.py` - websocket connection manager
- `app/routes/auth.py` - auth endpoints
- `app/routes/chat.py` - chat endpoints
- `app/routes/ws.py` - websocket endpoint
- `app/main.py` - FastAPI app entry
- `run.py` - local runner

## Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

or

```bash
python run.py
```
