"""
前端集成測試：驗證 HTML 頁面的完整性和邏輯
"""
import pytest
from pathlib import Path
import re


class TestFrontendPages:
    """測試前端 HTML 頁面"""

    @pytest.fixture
    def frontend_dir(self):
        return Path(__file__).parent.parent.parent.parent / 'apps' / 'admin-ui'

    def read_html(self, filepath: Path) -> str:
        """讀取 HTML 檔案"""
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()

    def test_folder_send_page_exists(self, frontend_dir):
        """測試：folder-send.html 存在"""
        page_path = frontend_dir / 'folder-send.html'
        assert page_path.exists(), f"folder-send.html 不存在於 {frontend_dir}"

    def test_folder_send_page_has_title(self, frontend_dir):
        """測試：頁面有正確的標題"""
        content = self.read_html(frontend_dir / 'folder-send.html')
        assert '<title>盒子發送</title>' in content, "頁面缺少標題"

    def test_folder_send_page_has_key_elements(self, frontend_dir):
        """測試：頁面包含關鍵 UI 元素"""
        content = self.read_html(frontend_dir / 'folder-send.html')
        
        # 檢查關鍵的 HTML 元素
        assert 'id="userId"' in content, "缺少 userId 輸入框"
        assert 'id="folderId"' in content, "缺少 folderId 選擇框"
        assert 'id="messageText"' in content, "缺少 messageText 文本框"
        assert 'id="retryFailed"' in content, "缺少 retryFailed 複選框"

    def test_folder_send_page_has_key_functions(self, frontend_dir):
        """測試：頁面包含關鍵的 JavaScript 函數"""
        content = self.read_html(frontend_dir / 'folder-send.html')
        
        functions = [
            'function loadFolders',
            'function previewFolderChats',
            'function sendToFolder',
            'function displayPreview',
            'function displayResults',
        ]
        
        for func in functions:
            assert func in content, f"缺少函數: {func}"

    def test_folder_send_page_api_endpoints(self, frontend_dir):
        """測試：頁面使用了正確的 API 端點"""
        content = self.read_html(frontend_dir / 'folder-send.html')
        
        endpoints = [
            '/folders/${userId}',
            '/folders/${userId}/${folderId}/preview',
            '/folders/${userId}/${folderId}/send',
        ]
        
        for endpoint in endpoints:
            assert endpoint in content, f"缺少 API 端點: {endpoint}"

    def test_folder_send_page_has_styles(self, frontend_dir):
        """測試：頁面有基本的 CSS 樣式"""
        content = self.read_html(frontend_dir / 'folder-send.html')
        
        # 檢查是否有 <style> 標籤
        assert '<style>' in content, "缺少 <style> 標籤"
        
        # 檢查是否有重要的 CSS class
        css_classes = [
            '.button-group',
            '.form-group',
            '.chat-item',
            '.status-badge',
            '.stats',
        ]
        
        for cls in css_classes:
            assert cls in content, f"缺少 CSS class: {cls}"

    def test_index_page_has_folder_send_link(self, frontend_dir):
        """測試：index.html 有連結到 folder-send 頁面"""
        content = self.read_html(frontend_dir / 'index.html')
        
        assert 'folder-send.html' in content, "index.html 缺少 folder-send.html 連結"
        assert '📦' in content or 'Box Send' in content, "index.html 缺少盒子功能標籤"

    def test_folder_send_page_form_validation(self, frontend_dir):
        """測試：頁面有表單驗證邏輯"""
        content = self.read_html(frontend_dir / 'folder-send.html')
        
        # 檢查是否有驗證 userId 和 folderId 的邏輯
        assert 'userId' in content and 'value.trim()' in content, "缺少 userId 驗證"
        assert 'folderId' in content and 'value.trim()' in content, "缺少 folderId 驗證"
        assert 'messageText' in content and 'value.trim()' in content, "缺少 messageText 驗證"

    def test_folder_send_page_error_handling(self, frontend_dir):
        """測試：頁面有錯誤處理邏輯"""
        content = self.read_html(frontend_dir / 'folder-send.html')
        
        # 檢查是否有 showError 和 clearError 函數
        assert 'function showError' in content, "缺少 showError 函數"
        assert 'function clearError' in content, "缺少 clearError 函數"
        assert 'id="error-message"' in content, "缺少錯誤消息 div"

    def test_folder_send_page_chat_type_filters(self, frontend_dir):
        """測試：頁面包含 chat type 過濾選項"""
        content = self.read_html(frontend_dir / 'folder-send.html')
        
        chat_types = [
            'chatTypeChannel',
            'chatTypeBasicGroup',
            'chatTypeSupergroup',
            'chatTypePrivate',
        ]
        
        for chat_type in chat_types:
            assert chat_type in content, f"缺少 chat type filter: {chat_type}"

    def test_folder_send_page_results_display(self, frontend_dir):
        """測試：頁面有結果顯示區域"""
        content = self.read_html(frontend_dir / 'folder-send.html')
        
        # 檢查結果表格和統計
        assert 'id="result-section"' in content, "缺少結果區域"
        assert 'id="results-table"' in content, "缺少結果表格"
        assert 'class="results-table"' in content, "缺少結果表格 CSS"
        assert 'stat-value' in content, "缺少統計值顯示"


class TestFrontendScripts:
    """測試前端 JavaScript 邏輯"""

    def extract_js_code(self, html_content: str) -> str:
        """從 HTML 提取 JavaScript 代碼"""
        match = re.search(r'<script>(.*?)</script>', html_content, re.DOTALL)
        return match.group(1) if match else ''

    def test_api_base_url_defined(self, frontend_dir):
        """測試：API_BASE URL 已定義"""
        content = self.read_html(frontend_dir / 'folder-send.html')
        js_code = self.extract_js_code(content)
        
        assert "const API_BASE = 'http://127.0.0.1:8000'" in js_code or \
               'API_BASE' in js_code, "API_BASE URL 未定義"

    def test_exclude_type_checkboxes_logic(self, frontend_dir):
        """測試：排除類型的複選框邏輯"""
        content = self.read_html(frontend_dir / 'folder-send.html')
        js_code = self.extract_js_code(content)
        
        # 檢查是否有收集 exclude type 的邏輯
        assert 'exclude-type' in js_code or 'excludeTypes' in js_code or \
               'exclude_types' in js_code, "缺少 exclude type 邏輯"

    def test_preview_display_logic(self, frontend_dir):
        """測試：預覽顯示邏輯"""
        content = self.read_html(frontend_dir / 'folder-send.html')
        js_code = self.extract_js_code(content)
        
        assert 'function displayPreview' in js_code, "缺少 displayPreview 函數"
        assert 'included' in js_code.lower(), "缺少 included 數據處理"
        assert 'excluded' in js_code.lower(), "缺少 excluded 數據處理"

    def test_result_display_logic(self, frontend_dir):
        """測試：結果顯示邏輯"""
        content = self.read_html(frontend_dir / 'folder-send.html')
        js_code = self.extract_js_code(content)
        
        assert 'function displayResults' in js_code, "缺少 displayResults 函數"
        assert 'success' in js_code.lower(), "缺少 success 數據顯示"
        assert 'failed' in js_code.lower(), "缺少 failed 數據顯示"

    def test_fetch_error_handling(self, frontend_dir):
        """測試：fetch 錯誤處理"""
        content = self.read_html(frontend_dir / 'folder-send.html')
        js_code = self.extract_js_code(content)
        
        # 檢查是否有 try-catch 或錯誤處理
        assert 'catch' in js_code, "缺少 catch 錯誤處理"
        assert 'showError' in js_code, "缺少錯誤顯示邏輯"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
