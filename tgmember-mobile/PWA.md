# TGMember PWA

TGMember mobile uses Expo Router and can be exported as a static web app with PWA support.

## Build

```bash
cd tgmember-mobile
npm install
npm run build:web
```

The static output is generated in:

```text
tgmember-mobile/dist
```

`npm run build:web` runs:

1. `expo export -p web`
2. `workbox generateSW workbox-config.js`

This creates:

```text
dist/service-worker.js
```

## Local preview

Use any static file server:

```bash
cd tgmember-mobile/dist
npx serve .
```

Open the HTTPS or localhost URL in Chrome / Edge / Safari.

## Install behavior

The app is installable when the browser sees:

- `/manifest.json`
- `/service-worker.js`
- HTTPS, or localhost during development
- valid icons

## Important API note

The app still calls the backend services directly:

```text
TDLib Service: http://<server-ip>:8000
CRM/FastAPI:  http://<server-ip>:8001
```

For real PWA deployment over HTTPS, the backend should also be reachable over HTTPS, otherwise browsers may block requests because of mixed content.

Recommended next step:

- Move API base URLs into one config file.
- Use production HTTPS URLs when deploying the PWA.
