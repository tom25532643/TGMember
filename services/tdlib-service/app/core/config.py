from pathlib import Path
import os
import platform

BASE_DIR = Path(__file__).resolve().parents[2]


def _default_tdjson_library() -> Path:
    if platform.system().lower() == 'windows':
        return BASE_DIR / 'Release' / 'tdjson.dll'
    return BASE_DIR / 'lib' / 'libtdjson.so'


TDJSON_LIBRARY = Path(os.getenv('TDJSON_LIBRARY', str(_default_tdjson_library()))).resolve()
TDLIB_DATA_ROOT = Path(os.getenv('TDLIB_DATA_ROOT', str(BASE_DIR / 'tdlib-data'))).resolve()

# Prefer environment variables in real deployments.
API_ID = int(os.getenv('TG_API_ID', '28311721'))
API_HASH = os.getenv('TG_API_HASH', 'ec09410e61f01f57ac20f46c8d698c5d')

APP_TITLE = 'TGMember TDLib Service'
SYSTEM_LANGUAGE_CODE = os.getenv('TDLIB_SYSTEM_LANGUAGE_CODE', 'en')
DEVICE_MODEL = os.getenv('TDLIB_DEVICE_MODEL', 'TGMember')
SYSTEM_VERSION = os.getenv('TDLIB_SYSTEM_VERSION', platform.system())
APPLICATION_VERSION = os.getenv('TDLIB_APPLICATION_VERSION', '0.1.0')
TDLIB_LOG_VERBOSITY = int(os.getenv('TDLIB_LOG_VERBOSITY', '1'))
SESSION_RESTORE_TIMEOUT = float(os.getenv('SESSION_RESTORE_TIMEOUT', '15'))
SESSION_RESTORE_SCAN_PREFIX = os.getenv('SESSION_RESTORE_SCAN_PREFIX', 'user_')
