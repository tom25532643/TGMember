from pathlib import Path


def find_admin_ui():
    """
    從 tests 目錄往上找 admin-ui 資料夾（支援 monorepo 結構）
    """
    p = Path(__file__).resolve()
    for parent in p.parents:
        candidate = parent / "admin-ui"
        if candidate.exists():
            return candidate
        # 支援 apps/admin-ui
        candidate2 = parent / "apps" / "admin-ui"
        if candidate2.exists():
            return candidate2

    raise AssertionError("找不到 admin-ui 資料夾")


BASE = find_admin_ui()


def test_audience_send_html_exists():
    assert (BASE / "audience-send.html").exists()


def test_audience_send_js_exists():
    assert (BASE / "js" / "audience-send.js").exists()


def test_html_has_required_elements():
    html = (BASE / "audience-send.html").read_text(encoding="utf-8")

    assert "userId" in html
    assert "chatId" in html
    assert "messageText" in html
    assert "loadSourcesBtn" in html
    assert "loadMembersBtn" in html
    assert "sendMembersBtn" in html


def test_html_loads_correct_js():
    html = (BASE / "audience-send.html").read_text(encoding="utf-8")

    assert "./js/audience-send.js" in html


def test_js_has_core_functions():
    js = (BASE / "js" / "audience-send.js").read_text(encoding="utf-8")

    assert "loadSources" in js
    assert "loadMembers" in js
    assert "sendToMembers" in js