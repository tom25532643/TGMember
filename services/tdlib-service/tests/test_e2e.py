"""
端對端集成測試：完整的盒子發送流程
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.state import session_manager
from app.services.session import TdAuthSession


client = TestClient(app)


class TestE2EFolderSending:
    """端對端測試：盒子發送完整流程"""

    @pytest.fixture(autouse=True)
    def setup_teardown(self):
        """測試前後清理"""
        session_manager._sessions.clear()
        yield
        session_manager._sessions.clear()

    def create_full_mock_session(self, user_id: str = "123456789"):
        """建立完整的 mock session，模擬真實情況"""
        session = MagicMock(spec=TdAuthSession)
        session.user_id = user_id
        session._is_ready = True
        
        # Mock folders
        folders = [
            {'id': 0, 'name': 'Favorites', 'icon': 'folderIconFavorites', 'color_id': None},
            {'id': 1, 'name': 'Work Contacts', 'icon': None, 'color_id': 0},
            {'id': 2, 'name': 'VIP Clients', 'icon': None, 'color_id': 1},
        ]
        session.get_folders.return_value = folders
        
        # Mock chats for different scenarios
        chats = [
            {
                'chat_id': 10001,
                'title': 'Alice',
                'type': 'chatTypePrivate',
                'last_message': {'text': 'Hello!', 'date': 1234567890},
            },
            {
                'chat_id': 10002,
                'title': 'Bob',
                'type': 'chatTypePrivate',
                'last_message': {'text': 'Hi there', 'date': 1234567880},
            },
            {
                'chat_id': 10003,
                'title': 'Team Channel',
                'type': 'chatTypeChannel',
                'last_message': {'text': 'Announcement', 'date': 1234567870},
            },
            {
                'chat_id': 10004,
                'title': 'Management Group',
                'type': 'chatTypeBasicGroup',
                'last_message': {'text': 'Meeting at 3pm', 'date': 1234567860},
            },
        ]
        session.get_folder_chats.return_value = chats
        
        # Mock preview
        def mock_preview(folder_id, exclude_types=None):
            if exclude_types is None:
                exclude_types = []
            
            filtered = [c for c in chats if c['type'] not in exclude_types]
            excluded = [c for c in chats if c['type'] in exclude_types]
            
            return {
                'total': len(chats),
                'included': len(filtered),
                'excluded': len(excluded),
                'chats': filtered,
                'excluded_chats': excluded,
            }
        
        session.get_folder_chats_preview.side_effect = mock_preview
        
        # Mock send to folder
        def mock_send(folder_id, text, exclude_types=None, retry_failed=True):
            preview = mock_preview(folder_id, exclude_types)
            targets = preview['chats']
            
            results = []
            for t in targets:
                results.append({
                    'chat_id': t['chat_id'],
                    'title': t['title'],
                    'type': t['type'],
                    'ok': True,  # 模擬全部成功
                })
            
            return {
                'total': len(chats),
                'excluded': len(preview['excluded_chats']),
                'success': len(results),
                'failed': 0,
                'results': results,
                'failed_detail': [],
            }
        
        session.send_to_folder.side_effect = mock_send
        
        session_manager._sessions[user_id] = session
        return session

    # ========== 流程 1：完全流程 (預覽 -> 發送) ==========

    def test_e2e_flow_1_get_folders(self):
        """Step 1: 取得用戶的盒子列表"""
        user_id = "123456789"
        self.create_full_mock_session(user_id)
        
        # 第一步：獲取盒子列表
        resp = client.get(f'/folders/{user_id}')
        assert resp.status_code == 200
        
        data = resp.json()
        assert data['ok'] is True
        folders = data['data']
        
        assert len(folders) == 3
        assert folders[0]['name'] == 'Favorites'
        assert folders[1]['name'] == 'Work Contacts'
        assert folders[2]['name'] == 'VIP Clients'

    def test_e2e_flow_2_select_folder_and_preview(self):
        """Step 2: 選擇盒子並預覽其中的聊天"""
        user_id = "123456789"
        self.create_full_mock_session(user_id)
        
        folder_id = 1
        
        # 預覽盒子內的所有聊天
        resp = client.post(
            f'/folders/{user_id}/{folder_id}/preview',
            json={'exclude_types': []}
        )
        
        assert resp.status_code == 200
        data = resp.json()
        assert data['ok'] is True
        
        preview = data['data']
        assert preview['total'] == 4
        assert preview['included'] == 4
        assert preview['excluded'] == 0
        assert len(preview['chats']) == 4

    def test_e2e_flow_3_preview_with_filters(self):
        """Step 3: 預覽時排除特定 chat type"""
        user_id = "123456789"
        self.create_full_mock_session(user_id)
        
        folder_id = 1
        exclude_types = ['chatTypeChannel', 'chatTypeBasicGroup']
        
        # 排除頻道和群組，只保留私聊
        resp = client.post(
            f'/folders/{user_id}/{folder_id}/preview',
            json={'exclude_types': exclude_types}
        )
        
        assert resp.status_code == 200
        data = resp.json()
        preview = data['data']
        
        assert preview['total'] == 4
        assert preview['included'] == 2  # 只有 2 個私聊
        assert preview['excluded'] == 2  # 排除了 1 頻道 + 1 群組
        assert len(preview['chats']) == 2
        assert all(c['type'] == 'chatTypePrivate' for c in preview['chats'])

    def test_e2e_flow_4_send_to_folder_all(self):
        """Step 4: 發送訊息到所有聊天"""
        user_id = "123456789"
        self.create_full_mock_session(user_id)
        
        folder_id = 1
        message_text = "Hello everyone! This is an important announcement."
        
        resp = client.post(
            f'/folders/{user_id}/{folder_id}/send',
            json={
                'text': message_text,
                'exclude_types': [],
                'retry_failed': True
            }
        )
        
        assert resp.status_code == 200
        data = resp.json()
        assert data['ok'] is True
        
        result = data['data']
        assert result['total'] == 4
        assert result['excluded'] == 0
        assert result['success'] == 4
        assert result['failed'] == 0
        assert len(result['results']) == 4
        
        # 驗證所有結果都標記為成功
        for r in result['results']:
            assert r['ok'] is True
    
    def test_e2e_flow_5_send_to_folder_with_filters(self):
        """Step 5: 發送訊息到特定 chat type（排除其他）"""
        user_id = "123456789"
        self.create_full_mock_session(user_id)
        
        folder_id = 1
        message_text = "Message for private chats only"
        exclude_types = ['chatTypeChannel', 'chatTypeBasicGroup']
        
        resp = client.post(
            f'/folders/{user_id}/{folder_id}/send',
            json={
                'text': message_text,
                'exclude_types': exclude_types,
                'retry_failed': True
            }
        )
        
        assert resp.status_code == 200
        data = resp.json()
        result = data['data']
        
        # 應該發送給 2 個私聊，排除 1 頻道 + 1 群組
        assert result['total'] == 4
        assert result['excluded'] == 2
        assert result['success'] == 2
        assert result['failed'] == 0
        assert len(result['results']) == 2
        
        # 所有成功的都應該是私聊
        for r in result['results']:
            assert r['type'] == 'chatTypePrivate'
            assert r['ok'] is True

    # ========== 流程 2: 多盒子場景 ==========

    def test_e2e_flow_multiple_folders(self):
        """測試多個盒子的發送場景"""
        user_id = "123456789"
        session = self.create_full_mock_session(user_id)
        
        # 依序對不同的盒子發送訊息
        for folder_id in [0, 1, 2]:
            resp = client.post(
                f'/folders/{user_id}/{folder_id}/send',
                json={
                    'text': f'Message to folder {folder_id}',
                    'exclude_types': [],
                    'retry_failed': True
                }
            )
            
            assert resp.status_code == 200
            data = resp.json()
            assert data['ok'] is True

    # ========== 錯誤情況 ==========

    def test_e2e_error_no_session(self):
        """測試：session 不存在的情況"""
        resp = client.get('/folders/nonexistent_user')
        assert resp.status_code == 404

    def test_e2e_error_empty_message(self):
        """測試：空訊息的情況"""
        user_id = "123456789"
        self.create_full_mock_session(user_id)
        
        resp = client.post(
            f'/folders/{user_id}/1/send',
            json={
                'text': '',
                'exclude_types': [],
                'retry_failed': True
            }
        )
        
        assert resp.status_code == 400

    def test_e2e_error_whitespace_only_message(self):
        """測試：只有空格的訊息"""
        user_id = "123456789"
        self.create_full_mock_session(user_id)
        
        resp = client.post(
            f'/folders/{user_id}/1/send',
            json={
                'text': '   \n\t  ',
                'exclude_types': [],
                'retry_failed': True
            }
        )
        
        assert resp.status_code == 400

    # ========== 邊界情況 ==========

    def test_e2e_boundary_very_long_message(self):
        """測試：很長的訊息"""
        user_id = "123456789"
        self.create_full_mock_session(user_id)
        
        # 建立 5000 字符的訊息
        long_message = 'A' * 5000
        
        resp = client.post(
            f'/folders/{user_id}/1/send',
            json={
                'text': long_message,
                'exclude_types': [],
                'retry_failed': True
            }
        )
        
        # 應該成功（取決於 Telegram 的限制，但 API 層應該接受）
        assert resp.status_code == 200

    def test_e2e_boundary_unicode_message(self):
        """測試：包含各種 Unicode 字符的訊息"""
        user_id = "123456789"
        self.create_full_mock_session(user_id)
        
        unicode_message = "Hello 你好 مرحبا שלום Привет 🎉🚀😊"
        
        resp = client.post(
            f'/folders/{user_id}/1/send',
            json={
                'text': unicode_message,
                'exclude_types': [],
                'retry_failed': True
            }
        )
        
        assert resp.status_code == 200
        data = resp.json()
        assert data['ok'] is True

    def test_e2e_boundary_all_exclude_types(self):
        """測試：排除所有 chat type"""
        user_id = "123456789"
        self.create_full_mock_session(user_id)
        
        resp = client.post(
            f'/folders/{user_id}/1/preview',
            json={'exclude_types': [
                'chatTypePrivate',
                'chatTypeChannel',
                'chatTypeBasicGroup',
                'chatTypeSupergroup'
            ]}
        )
        
        assert resp.status_code == 200
        data = resp.json()
        preview = data['data']
        
        # 應該沒有要發送的聊天
        assert preview['included'] == 0
        assert preview['excluded'] == 4
        assert len(preview['chats']) == 0


class TestSessionIntegration:
    """測試 session 整合"""

    def test_session_multiple_concurrent_users(self):
        """測試：多個用戶同時操作"""
        user_ids = ["user1", "user2", "user3"]
        
        for user_id in user_ids:
            session = MagicMock(spec=TdAuthSession)
            session.user_id = user_id
            session.get_folders.return_value = [
                {'id': 1, 'name': f'Folder for {user_id}', 'icon': None, 'color_id': None}
            ]
            session_manager._sessions[user_id] = session
        
        # 依序對每個用戶查詢
        for user_id in user_ids:
            resp = client.get(f'/folders/{user_id}')
            assert resp.status_code == 200
            data = resp.json()
            assert data['ok'] is True
            assert len(data['data']) == 1

    def test_session_cleanup(self):
        """測試：session 清理"""
        user_id = "temp_user"
        session = MagicMock(spec=TdAuthSession)
        session.user_id = user_id
        session_manager._sessions[user_id] = session
        
        assert user_id in session_manager._sessions
        
        # 移除 session
        session_manager.remove(user_id)
        assert user_id not in session_manager._sessions


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
