# TGMember Architecture

TGMember is a Telegram member management and broadcast tool.

It is not intended to be a Telegram clone. The product UI should stay focused on tool workflows:

- Group Send
- Audience Send

## High-level flow

```text
UI / PWA / Mobile App
  -> FastAPI CRM service, port 8001
  -> TDLib Service, port 8000
  -> Telegram via TDLib
```

## Frontend

Path:

```text
tgmember-mobile
```

Stack:

- React Native
- Expo Router
- Web export for PWA/static deployment

The frontend checks the CRM service first, then the TDLib service.

## CRM / FastAPI service

Default port:

```text
8001
```

Responsibility:

- Validate whether a TGMember user account exists.
- It does not operate Telegram directly.

Current login check endpoint:

```text
GET /members/{id}
```

## TDLib Service

Default port:

```text
8000
```

Responsibility:

- Telegram login state
- TDLib session handling
- Telegram groups, folders, members and messages

Current auth endpoints:

```text
GET  /auth/state/{user_id}
POST /auth/start
POST /auth/phone
POST /auth/code
POST /auth/password
```

## Session policy

Each TGMember user maps to one independent TDLib session folder.

Current login behavior:

```text
CRM user does not exist
-> Stop login and show an error

CRM user exists, but TDLib /auth/state/{user_id} returns 404
-> POST /auth/start
-> Show phone input

TDLib session exists
-> Follow TDLib auth state mapping
```

## API configuration

Frontend API base URLs are centralized in:

```text
tgmember-mobile/config/api.ts
```

Use this file to switch between local PC, NAS, LAN, VPN or production endpoints.
