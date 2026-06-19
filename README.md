# TGMember

TGMember is a Telegram member management and broadcast tool. It has three main parts:

- `services/backend-api`: CRM/member API on port `8001`
- `services/tdlib-service`: Telegram TDLib API on port `8000`
- `tgmember-mobile`: Expo / React Native web app, deployed as a PWA

The product is focused on workflow tools such as Folder Send and Audience Send. It is not intended to be a Telegram clone.

## Local Setup

Install dependencies inside each service or use Docker Compose.

Backend API:

```bash
cd services/backend-api
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

TDLib service:

```bash
cd services/tdlib-service
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Mobile / PWA:

```bash
cd tgmember-mobile
npm install
npm run web
```

## Docker Compose

Copy `.env.example` to `.env` and set the Cloudflare tunnel token:

```bash
CLOUDFLARED_TUNNEL_TOKEN=your-token-here
```

Then start the stack:

```bash
docker compose up --build
```

If the old tunnel token was ever committed or shared, rotate it in Cloudflare before using this repository again.

## Checks

TDLib tests:

```bash
cd services/tdlib-service
python -m pytest tests -q
```

All checks:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check_all.ps1
```

Mobile lint and typecheck:

```bash
cd tgmember-mobile
npm run lint
npm run typecheck
```

## Notes

- Local databases, TDLib session data, build output, pytest caches, `node_modules`, and local toolchains are ignored by git.
- If the project lives inside Synology Drive, build output may appear as reparse/sync files. Use a separate output directory for local PWA export:

```powershell
cd tgmember-mobile
$env:WEB_BUILD_DIR="dist-local"
$env:WEB_BUILD_MAX_WORKERS="1"
npm run build:web
```