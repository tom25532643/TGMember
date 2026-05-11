# TGMember Login Flow

This document defines the current login strategy. Do not change this flow unless the product decision changes.

## Step 1: User ID check

The frontend asks the CRM/FastAPI service whether the TGMember user exists:

```text
GET /users/{id}
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

## State mapping

| TDLib state | UI screen |
| --- | --- |
| authorizationStateWaitPhoneNumber | Phone input |
| authorizationStateWaitCode | Code input |
| authorizationStateWaitPassword | Password input |
| authorizationStateReady | Home |

## Missing TDLib session

If TDLib Service returns 404 for `/auth/state/{user_id}`, the frontend must not call `/auth/start` automatically.

Show:

```text
TDLib session does not exist. Please contact the developer.
```

Reason:

- TDLib sessions are expected to be prepared by backend/admin flow.
- The mobile UI should not create session folders implicitly.
- This avoids accidental wrong-user or wrong-environment sessions.

## Important ports

```text
CRM/FastAPI:   8001
TDLib Service: 8000
```

Common mistakes:

```text
/auth/state sent to 8001 -> wrong
/users sent to 8000      -> wrong
```
