import os
from urllib.parse import urlparse


class Settings:
    def __init__(self, tdlib_service_base_url: str):
        self.tdlib_service_base_url = tdlib_service_base_url


def _validate_base_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(
            "TDLIB_SERVICE_BASE_URL must be a valid http/https URL, "
            f"got: {value!r}"
        )

    return value.rstrip("/")


def load_settings() -> Settings:
    raw_url = os.getenv("TDLIB_SERVICE_BASE_URL", "http://127.0.0.1:8010")
    base_url = _validate_base_url(raw_url)
    return Settings(tdlib_service_base_url=base_url)
