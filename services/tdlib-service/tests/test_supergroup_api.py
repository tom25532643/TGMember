from fastapi.testclient import TestClient
from unittest.mock import Mock
from app.main import app
from app.state import session_manager

client = TestClient(app)


def test_list_supergroups(monkeypatch):
    fake_session = Mock()
    fake_session.get_supergroups.return_value = [
        {
            "chat_id": -1001,
            "title": "Test Channel",
            "supergroup_id": 123,
            "is_channel": True,
        }
    ]

    monkeypatch.setattr(session_manager, "get", lambda user_id: fake_session)

    resp = client.get("/supergroups/1")
    assert resp.status_code == 200

    data = resp.json()
    assert data["ok"] is True
    assert len(data["data"]) == 1


def test_get_members_preview(monkeypatch):
    fake_session = Mock()
    fake_session.get_supergroup_members_preview.return_value = {
        "title": "Test Channel",
        "is_channel": True,
        "total": 2,
        "members": [
            {"user_id": 111, "status": "member"},
            {"user_id": 222, "status": "member"},
        ],
    }

    monkeypatch.setattr(session_manager, "get", lambda user_id: fake_session)

    resp = client.get("/supergroups/1/-1001/members")
    assert resp.status_code == 200

    data = resp.json()
    assert data["ok"] is True
    assert data["data"]["total"] == 2


def test_get_members_all(monkeypatch):
    fake_session = Mock()
    fake_session.get_all_supergroup_members.return_value = {
        "title": "Test Channel",
        "is_channel": True,
        "total": 5,
        "members": [{"user_id": i} for i in range(5)],
    }

    monkeypatch.setattr(session_manager, "get", lambda user_id: fake_session)

    resp = client.get("/supergroups/1/-1001/members/all")
    assert resp.status_code == 200

    data = resp.json()
    assert data["ok"] is True
    assert len(data["data"]["members"]) == 5


def test_send_members(monkeypatch):
    fake_session = Mock()
    fake_session.send_to_members.return_value = {
        "targeted": 2,
        "success": 2,
        "failed": 0,
        "results": [],
    }

    monkeypatch.setattr(session_manager, "get", lambda user_id: fake_session)

    resp = client.post(
        "/supergroups/1/-1001/send",
        json={"text": "hello", "max_count": 2},
    )

    assert resp.status_code == 200

    data = resp.json()
    assert data["ok"] is True
    assert data["data"]["success"] == 2