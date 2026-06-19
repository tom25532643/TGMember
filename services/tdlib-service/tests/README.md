# TDLib Service Tests

This folder contains pytest coverage for the TDLib service API and mocked send workflows.

## Run

```bash
cd services/tdlib-service
pip install -r requirements.txt
python -m pytest tests -q
```

Useful focused runs:

```bash
python -m pytest tests/test_folder_api.py -v
python -m pytest tests/test_e2e.py -v
python -m pytest tests/test_supergroup_api.py -v
```

## Current Coverage

- Folder API success, preview, send, and filter paths
- E2E-style mocked folder send flows
- Supergroup and session member send helpers
- Legacy frontend and old group API tests are intentionally skipped

## Notes

The tests mock TDLib sessions and should not contact Telegram. If pytest reports cache write warnings inside Synology Drive, remove stale `.pytest_cache` / `pytest-cache-files-*` folders or run tests outside the synced folder.
