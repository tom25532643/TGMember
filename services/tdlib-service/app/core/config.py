from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parents[2]
TDJSON_DLL = BASE_DIR / 'Release' / 'tdjson.dll'
TDLIB_DATA_ROOT = BASE_DIR / 'tdlib-data'

# Prefer environment variables in real deployments.
API_ID = int(os.getenv('TG_API_ID', '28311721'))
API_HASH = os.getenv('TG_API_HASH', 'ec09410e61f01f57ac20f46c8d698c5d')

APP_TITLE = 'TGMember TDLib Service'
SYSTEM_LANGUAGE_CODE = 'en'
DEVICE_MODEL = 'TGMember'
SYSTEM_VERSION = 'Windows 10'
APPLICATION_VERSION = '0.1.0'
TDLIB_LOG_VERBOSITY = int(os.getenv('TDLIB_LOG_VERBOSITY', '1'))
SESSION_RESTORE_TIMEOUT = float(os.getenv('SESSION_RESTORE_TIMEOUT', '15'))
SESSION_RESTORE_SCAN_PREFIX = os.getenv('SESSION_RESTORE_SCAN_PREFIX', 'user_')