"""
測試群組 API 端點
"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


class TestGroupAPI:
    """測試群組 API 端點"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """每個測試前設定"""
        yield

    def test_group_routes_import(self):
        """測試群組路由可以正常匯入"""
        from app.routes import group
        assert group.router is not None
        assert group.router.prefix == '/groups'

    @pytest.mark.parametrize("group_id,expected_status", [
        (1, 200),  # 正常情況
        (999, 200),  # 不存在的群組（會返回空列表）
    ])
    @patch('app.routes.group.get_group_members_from_backend')
    @patch('app.state.session_manager.get')
    def test_preview_group_send(self, mock_session_get, mock_get_members, group_id, expected_status):
        """測試群組預覽功能"""
        # Mock backend API 回應
        mock_get_members.return_value = [
            {'id': 1, 'name': 'Test Member 1'},
            {'id': 2, 'name': 'Test Member 2'},
        ]

        # Mock session
        mock_session = MagicMock()
        mock_session.get_folders.return_value = [
            {'id': 1, 'name': 'Test Folder'}
        ]
        mock_session.get_folder_chats_preview.return_value = {
            'chats': [
                {'chat_id': 101, 'title': 'Test Chat', 'type': 'chatTypePrivate'}
            ],
            'total': 1
        }
        mock_session_get.return_value = mock_session

        response = client.post(
            f'/groups/123/{group_id}/preview',
            json={'exclude_types': []}
        )

        assert response.status_code == expected_status
        if expected_status == 200:
            data = response.json()
            assert data['ok'] is True
            assert 'data' in data</content>
<parameter name="filePath">d:\SynologyDrive\TGMember\services\tdlib-service\tests\test_group_api.py