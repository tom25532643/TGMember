# TGMember PWA Deployment

TGMember mobile can be exported as a static web app and hosted by NAS Web Station or any static web server.

## Build

```bash
cd tgmember-mobile
npm install
npm run build:web
```

Output:

```text
tgmember-mobile/dist
```

## NAS static deployment

Copy the contents of `dist` into the Web Station document root.

Correct:

```text
/web/tgmember/index.html
/web/tgmember/manifest.json
/web/tgmember/service-worker.js
/web/tgmember/_expo/...
```

Wrong:

```text
/web/tgmember/dist/index.html
```

## API endpoints

The static PWA still calls backend APIs directly.

Configure endpoints in:

```text
tgmember-mobile/config/api.ts
```

For LAN testing:

```text
TDLib Service: http://<backend-ip>:8000
CRM/FastAPI:   http://<backend-ip>:8001
```

If the backend is still running on a Windows PC, use the Windows PC LAN IP, not the NAS IP.

If the backend is moved to NAS later, use the NAS IP or production domain.

## HTTPS note

For a real installable PWA over the internet, use HTTPS.

Options:

- VPN for private/internal use
- Cloudflare Tunnel for external HTTPS without opening router ports
- DDNS plus reverse proxy, only if security is handled carefully

Avoid exposing TDLib Service directly to the public internet without authentication and network protection.
