from unittest.mock import Mock

import pytest
from app.services.session import TdAuthSession


@pytest.fixture(autouse=True)
def disable_send_sleep(monkeypatch):
    monkeypatch.setattr("app.services.session.time.sleep", lambda seconds: None)


def make_session():
    s = TdAuthSession(user_id="1", api_id=123, api_hash="abc")
    s.client = Mock()
    return s


def test_send_to_members_success(monkeypatch):
    s = make_session()

    monkeypatch.setattr(
        s,
        "get_all_supergroup_members",
        lambda chat_id, max_pages=5, page_size=200: {
            "title": "Test Source",
            "total": 2,
            "members": [
                {"user_id": 111, "status": "member"},
                {"user_id": 222, "status": "member"},
            ],
        },
    )

    monkeypatch.setattr(
        s,
        "create_private_chat",
        lambda user_id: {"id": user_id + 1000},
    )

    calls = []

    def fake_send(chat_id, text):
        calls.append((chat_id, text))
        return {"ok": True}

    monkeypatch.setattr(s, "send_text", fake_send)

    result = s.send_to_members(chat_id=-1001, text="hi", max_count=2)

    assert result["success"] == 2
    assert result["failed"] == 0
    assert len(calls) == 2


def test_send_to_members_partial_fail(monkeypatch):
    s = make_session()

    monkeypatch.setattr(
        s,
        "get_all_supergroup_members",
        lambda chat_id, max_pages=5, page_size=200: {
            "title": "Test",
            "total": 2,
            "members": [
                {"user_id": 111},
                {"user_id": 222},
            ],
        },
    )

    monkeypatch.setattr(
        s,
        "create_private_chat",
        lambda user_id: {"id": user_id + 1000},
    )

    def fake_send(chat_id, text):
        if chat_id == 111 + 1000:
            raise Exception("send fail")
        return {"ok": True}

    monkeypatch.setattr(s, "send_text", fake_send)

    result = s.send_to_members(chat_id=-1001, text="hi", max_count=2)

    assert result["success"] == 1
    assert result["failed"] == 1

def test_send_to_members_respects_max_count(monkeypatch):
    s = make_session()

    monkeypatch.setattr(
        s,
        "get_all_supergroup_members",
        lambda chat_id, max_pages=5, page_size=200: {
            "title": "Test Source",
            "total": 3,
            "members": [
                {"user_id": 111, "status": "member"},
                {"user_id": 222, "status": "member"},
                {"user_id": 333, "status": "member"},
            ],
        },
    )

    monkeypatch.setattr(
        s,
        "create_private_chat",
        lambda user_id: {"id": user_id + 1000},
    )

    calls = []

    def fake_send(chat_id, text):
        calls.append((chat_id, text))
        return {"ok": True}

    monkeypatch.setattr(s, "send_text", fake_send)

    result = s.send_to_members(chat_id=-1001, text="hi", max_count=1)

    assert result["targeted"] == 1
    assert result["success"] == 1
    assert len(calls) == 1
    assert calls == [(111 + 1000, "hi")]


def test_send_to_members_caps_max_count_at_200(monkeypatch):
    s = make_session()

    monkeypatch.setattr(
        s,
        "get_all_supergroup_members",
        lambda chat_id, max_pages=5, page_size=200: {
            "title": "Test Source",
            "total": 250,
            "members": [
                {"user_id": user_id, "status": "member"}
                for user_id in range(1000, 1250)
            ],
        },
    )

    monkeypatch.setattr(
        s,
        "create_private_chat",
        lambda user_id: {"id": user_id + 1000},
    )

    calls = []

    def fake_send(chat_id, text):
        calls.append((chat_id, text))
        return {"ok": True}

    monkeypatch.setattr(s, "send_text", fake_send)

    result = s.send_to_members(chat_id=-1001, text="hi", max_count=500)

    assert result["targeted"] == 200
    assert result["success"] == 200
    assert len(calls) == 200

