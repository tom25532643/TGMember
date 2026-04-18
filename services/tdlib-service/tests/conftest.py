"""
Pytest 配置和共用 fixture
"""
import pytest
import sys
from pathlib import Path

# 添加 tdlib-service 目錄到 Python path
tdlib_service_path = Path(__file__).parent.parent
sys.path.insert(0, str(tdlib_service_path))


@pytest.fixture
def api_base_url():
    """API 基礎 URL"""
    return 'http://127.0.0.1:8000'


@pytest.fixture
def mock_user_id():
    """測試用的 mock user ID"""
    return '123456789'


@pytest.fixture
def mock_folder_id():
    """測試用的 mock folder ID"""
    return 1


@pytest.fixture
def sample_chats():
    """樣本聊天列表"""
    return [
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


@pytest.fixture
def sample_folders():
    """樣本盒子列表"""
    return [
        {'id': 0, 'name': 'Favorites', 'icon': 'folderIconFavorites', 'color_id': None},
        {'id': 1, 'name': 'Work', 'icon': None, 'color_id': 0},
        {'id': 2, 'name': 'Personal', 'icon': None, 'color_id': 1},
    ]
