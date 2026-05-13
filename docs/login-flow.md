# TGMember Login Flow

This document defines the current login strategy. Do not change this flow unless the product decision changes.

## Step 1: User ID check

The frontend asks the CRM/FastAPI service whether the TGMember user exists:

```text
GET /members/{id}
```

If the user does not exist, the frontend must stop the flow and show:

```text
No such account. Please contact the developer.
```

## Step 2: TDLib session state check

If the CRM user exists, the frontend asks TDLib Service for the Telegram auth state:

```text
GET /auth/state/{user_id}
```

## Step 3: Missing TDLib session

If TDLib Service returns 404 for `/auth/state/{user_id}`, it means the TGMember user exists but the Telegram/TDLib login flow has not started yet.

The frontend should call:

```text
POST /auth/start
```

Then show the phone input screen.

## State mapping

| TDLib state | UI screen |
| --- | --- |
| authorizationStateWaitPhoneNumber | Phone input |
| authorizationStateWaitCode | Code input |
| authorizationStateWaitPassword | Password input |
| authorizationStateReady | Home |

## Current login behavior

```text
CRM user does not exist
-> Show "No such account. Please contact the developer."

CRM user exists, but TDLib session does not exist
-> POST /auth/start
-> Phone input

TDLib session exists
-> Follow TDLib auth state mapping
```

## Important ports

```text
CRM/FastAPI:   8001
TDLib Service: 8000
```

Common mistakes:

```text
/auth/state sent to 8001 -> wrong
/members sent to 8000    -> wrong
/users/{id}              -> outdated, use /members/{id}
```
