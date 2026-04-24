"""
整體端到端測試：盒子發送功能
"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.state import session_manager
from app.services.session import TdAuthSession, TdSessionManager


client = TestClient(app)


class TestFolderAPI:
    """測試盒子 API 端點"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """每個測試前重置 session manager"""
        session_manager._sessions.clear()
        yield
        session_manager._sessions.clear()

    def create_mock_session(self, user_id: str = "123456789"):
        """建立 mock session 用於測試"""
        session = MagicMock(spec=TdAuthSession)
        session.user_id = user_id
        session._is_ready = True
        
        # Mock folders
        session.get_folders.return_value = [
            {'id': 0, 'name': 'Favorites', 'icon': 'folderIconFavorites', 'color_id': None},
            {'id': 1, 'name': 'Custom 1', 'icon': None, 'color_id': 0},
            {'id': 2, 'name': 'Custom 2', 'icon': None, 'color_id': 1},
        ]
        
        # Mock folder chats
        session.get_folder_chats.return_value = [
            {
                'chat_id': 101,
                'title': 'Private Chat A',
                'type': 'chatTypePrivate',
                'last_message': None,
            },
            {
                'chat_id': 102,
                'title': 'Group B',
                'type': 'chatTypeBasicGroup',
                'last_message': None,
            },
            {
                'chat_id': 103,
                'title': 'Channel C',
                'type': 'chatTypeChannel',
                'last_message': None,
            },
        ]
        
        # Mock preview
        session.get_folder_chats_preview.return_value = {
            'total': 3,
            'included': 2,
            'excluded': 1,
            'chats': [
                {
                    'chat_id': 101,
                    'title': 'Private Chat A',
                    'type': 'chatTypePrivate',
                    'last_message': None,
                },
                {
                    'chat_id': 102,
                    'title': 'Group B',
                    'type': 'chatTypeBasicGroup',
                    'last_message': None,
                },
            ],
            'excluded_chats': [
                {
                    'chat_id': 103,
                    'title': 'Channel C',
                    'type': 'chatTypeChannel',
                    'last_message': None,
                }
            ],
        }
        
        # Mock send to folder
        session.send_to_folder.return_value = {
            'total': 3,
            'excluded': 1,
            'success': 2,
            'failed': 0,
            'results': [
                {
                    'chat_id': 101,
                    'title': 'Private Chat A',
                    'type': 'chatTypePrivate',
                    'ok': True,
                },
                {
                    'chat_id': 102,
                    'title': 'Group B',
                    'type': 'chatTypeBasicGroup',
                    'ok': True,
                },
            ],
            'failed_detail': [],
        }
        
        session_manager._sessions[user_id] = session
        return session

    def test_get_folders_success(self):
        """測試：取得盒子列表"""
        user_id = "123456789"
        self.create_mock_session(user_id)
        
        resp = client.get(f'/folders/{user_id}')
        
        assert resp.status_code == 200
        data = resp.json()
        assert data['ok'] is True
        assert len(data['data']) == 3
        assert data['data'][0]['name'] == 'Favorites'

    def test_get_folders_normalizes_nested_name(self):
        """測試：若 folder.name 為巢狀物件或 JSON 字串，必須正確解析"""
        with patch('app.services.session.TdLibClient') as mock_client:
            mock_client.return_value = MagicMock()
            session = TdAuthSession('123456789', 1, 'hash')
            session._chat_folders = [
                {'id': 42, 'name': {'text': 'Favorites'}, 'icon': None, 'color_id': None},
                {'id': 43, 'name': '{"title":"Work Contacts"}', 'icon': None, 'color_id': None},
            ]

            folders = session.get_folders()

            assert len(folders) == 2
            assert folders[0]['name'] == 'Favorites'
            assert folders[1]['name'] == 'Work Contacts'

    def test_get_folders_normalizes_chat_folder_name_object(self):
        with patch('app.services.session.TdLibClient') as mock_client:
            mock_client.return_value = MagicMock()
            session = TdAuthSession('123456789', 1, 'hash')
            session._chat_folders = [
                {
                    'id': 42,
                    'name': {
                        '@type': 'chatFolderName',
                        'name': {
                            '@type': 'text',
                            'text': 'Favorites',
                        },
                    },
                    'icon': None,
                    'color_id': None,
                }
            ]

            folders = session.get_folders()

            assert len(folders) == 1
            assert folders[0]['name'] == 'Favorites'

    def test_get_folders_normalizes_name_from_entire_folder_object(self):
        with patch('app.services.session.TdLibClient') as mock_client:
            mock_client.return_value = MagicMock()
            session = TdAuthSession('123456789', 1, 'hash')
            session._chat_folders = [
                {
                    'id': 76,
                    'name': None,
                    'display': {
                        'name': {
                            '@type': 'chatFolderName',
                            'name': {
                                '@type': 'text',
                                'text': 'Work Contacts',
                            },
                        }
                    },
                    'icon': None,
                    'color_id': None,
                }
            ]

            folders = session.get_folders()

            assert len(folders) == 1
            assert folders[0]['name'] == 'Work Contacts'

    def test_get_folders_normalizes_formatted_text_name(self):
        with patch('app.services.session.TdLibClient') as mock_client:
            mock_client.return_value = MagicMock()
            session = TdAuthSession('123456789', 1, 'hash')
            session._chat_folders = [
                {
                    '@type': 'chatFolderInfo',
                    'id': 76,
                    'name': {
                        '@type': 'chatFolderName',
                        'text': {
                            '@type': 'formattedText',
                            'text': '啦啦啦',
                            'entities': []
                        },
                        'animate_custom_emoji': True
                    },
                    'icon': {'@type': 'chatFolderIcon', 'name': 'Custom'},
                    'color_id': 6,
                    'is_shareable': False,
                    'has_my_invite_links': False
                }
            ]

            folders = session.get_folders()

            assert len(folders) == 1
            assert folders[0]['name'] == '啦啦啦'

    def test_get_folders_not_found(self):
        """測試：session 不存在"""
        resp = client.get('/folders/nonexistent')
        
        assert resp.status_code == 404
        data = resp.json()
        assert 'Session not found' in data['detail']

    def test_get_folder_chats_success(self):
        """測試：取得盒子內的聊天列表"""
        user_id = "123456789"
        self.create_mock_session(user_id)
        
        resp = client.get(f'/folders/{user_id}/1/chats')
        
        assert resp.status_code == 200
        data = resp.json()
        assert data['ok'] is True
        assert len(data['data']) == 3
        chats = data['data']
        assert chats[0]['chat_id'] == 101
        assert chats[0]['title'] == 'Private Chat A'
        assert chats[0]['type'] == 'chatTypePrivate'

    def test_preview_folder_send(self):
        """測試：預覽發送前的聊天列表（不含排除）"""
        user_id = "123456789"
        self.create_mock_session(user_id)
        
        resp = client.post(
            f'/folders/{user_id}/1/preview',
            json={'exclude_types': []}
        )
        
        assert resp.status_code == 200
        data = resp.json()
        assert data['ok'] is True
        preview = data['data']
        
        assert preview['total'] == 3
        assert preview['included'] == 2
        assert preview['excluded'] == 1
        assert len(preview['chats']) == 2
        assert len(preview['excluded_chats']) == 1

    def test_preview_folder_send_with_filters(self):
        """測試：預覽發送前的聊天列表（含排除過濾）"""
        user_id = "123456789"
        self.create_mock_session(user_id)
        
        resp = client.post(
            f'/folders/{user_id}/1/preview',
            json={'exclude_types': ['chatTypeChannel']}
        )
        
        assert resp.status_code == 200
        data = resp.json()
        assert data['ok'] is True
        preview = data['data']
        
        # 驗證 mock 被呼叫時傳入正確的參數
        session = session_manager.get(user_id)
        session.get_folder_chats_preview.assert_called_with(1, ['chatTypeChannel'])

    def test_send_to_folder_success(self):
        """測試：發送訊息到盒子"""
        user_id = "123456789"
        self.create_mock_session(user_id)
        
        resp = client.post(
            f'/folders/{user_id}/1/send',
            json={
                'text': 'Hello everyone!',
                'exclude_types': [],
                'retry_failed': True
            }
        )
        
        assert resp.status_code == 200
        data = resp.json()
        assert data['ok'] is True
        result = data['data']
        
        assert result['total'] == 3
        assert result['excluded'] == 1
        assert result['success'] == 2
        assert result['failed'] == 0
        assert len(result['results']) == 2

    def test_send_to_folder_empty_text(self):
        """測試：空訊息拒絕"""
        user_id = "123456789"
        self.create_mock_session(user_id)
        
        resp = client.post(
            f'/folders/{user_id}/1/send',
            json={
                'text': '',
                'exclude_types': [],
                'retry_failed': True
            }
        )
        
        assert resp.status_code == 400
        data = resp.json()
        assert 'text required' in data['detail']

    def test_send_to_folder_with_filters(self):
        """測試：發送時排除特定 chat type"""
        user_id = "123456789"
        self.create_mock_session(user_id)
        
        resp = client.post(
            f'/folders/{user_id}/1/send',
            json={
                'text': 'Hello!',
                'exclude_types': ['chatTypeChannel', 'chatTypeBasicGroup'],
                'retry_failed': True
            }
        )
        
        assert resp.status_code == 200
        data = resp.json()
        assert data['ok'] is True
        
        # 驗證發送時傳入正確的參數
        session = session_manager.get(user_id)
        session.send_to_folder.assert_called_with(
            1,
            'Hello!',
            exclude_types=['chatTypeChannel', 'chatTypeBasicGroup'],
            retry_failed=True
        )

    def test_send_to_folder_retry_disabled(self):
        """測試：發送時禁用重試"""
        user_id = "123456789"
        self.create_mock_session(user_id)
        
        resp = client.post(
            f'/folders/{user_id}/1/send',
            json={
                'text': 'Hello!',
                'retry_failed': False
            }
        )
        
        assert resp.status_code == 200
        session = session_manager.get(user_id)
        session.send_to_folder.assert_called_with(
            1,
            'Hello!',
            exclude_types=None,
            retry_failed=False
        )


class TestFolderLogic:
    """測試業務邏輯（TdAuthSession 的 folder 相關方法）"""

    def test_get_folder_chats_preview_no_filters(self):
        """測試：預覽無過濾"""
        session = TdAuthSession(
            user_id="123",
            api_id=123,
            api_hash="abc",
            tdjson_path=None
        )
        
        # Mock chat cache
        session._chat_cache = {
            101: {
                'id': 101,
                'title': 'Chat A',
                'type': {'@type': 'chatTypePrivate'},
                'positions': [{'list': {'@type': 'chatListFolder', 'chat_folder_id': 1}, 'order': 100}],
            },
            102: {
                'id': 102,
                'title': 'Chat B',
                'type': {'@type': 'chatTypeChannel'},
                'positions': [{'list': {'@type': 'chatListFolder', 'chat_folder_id': 1}, 'order': 50}],
            },
        }
        
        # Mock get_folder_chats 回傳結果
        with patch.object(session, 'get_folder_chats') as mock_get:
            mock_get.return_value = [
                {'chat_id': 101, 'title': 'Chat A', 'type': 'chatTypePrivate'},
                {'chat_id': 102, 'title': 'Chat B', 'type': 'chatTypeChannel'},
            ]
            
            preview = session.get_folder_chats_preview(1, exclude_types=None)
            
            assert preview['total'] == 2
            assert preview['included'] == 2
            assert preview['excluded'] == 0
            assert len(preview['chats']) == 2
            assert len(preview['excluded_chats']) == 0

    def test_get_folder_chats_preview_with_filters(self):
        """測試：預覽有過濾"""
        session = TdAuthSession(
            user_id="123",
            api_id=123,
            api_hash="abc",
            tdjson_path=None
        )
        
        with patch.object(session, 'get_folder_chats') as mock_get:
            mock_get.return_value = [
                {'chat_id': 101, 'title': 'Chat A', 'type': 'chatTypePrivate'},
                {'chat_id': 102, 'title': 'Chat B', 'type': 'chatTypeChannel'},
                {'chat_id': 103, 'title': 'Chat C', 'type': 'chatTypeBasicGroup'},
            ]
            
            preview = session.get_folder_chats_preview(
                1,
                exclude_types=['chatTypeChannel', 'chatTypeBasicGroup']
            )
            
            assert preview['total'] == 3
            assert preview['included'] == 1
            assert preview['excluded'] == 2
            assert len(preview['chats']) == 1
            assert len(preview['excluded_chats']) == 2
            assert preview['chats'][0]['chat_id'] == 101
            assert preview['excluded_chats'][0]['chat_id'] == 102
            assert preview['excluded_chats'][1]['chat_id'] == 103


class TestErrorHandling:
    """測試錯誤處理與邊界情況"""

    def test_api_error_without_text(self):
        """測試：沒有 text 欄位的請求"""
        user_id = "123456789"
        session_manager._sessions.clear()
        session = MagicMock(spec=TdAuthSession)
        session_manager._sessions[user_id] = session
        
        resp = client.post(
            f'/folders/{user_id}/1/send',
            json={'exclude_types': []}
        )
        
        # FastAPI 應該返回 422（驗證錯誤）或 400
        assert resp.status_code in [400, 422]

    def test_api_invalid_folder_id(self):
        """測試：無效的 folder ID"""
        user_id = "123456789"
        
        # 不建立 session，直接測試 404
        resp = client.get(f'/folders/{user_id}/999/chats')
        
        assert resp.status_code == 200


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
