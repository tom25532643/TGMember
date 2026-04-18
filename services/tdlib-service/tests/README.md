# TGMember 端對端測試指南

## 概述

本目錄包含 TGMember 項目的完整測試套件，涵蓋：
- **API 單元測試** (`test_folder_api.py`) - 測試盒子發送 API 端點
- **業務邏輯測試** - 測試 `TdAuthSession` 的 folder 相關方法
- **前端測試** (`test_frontend.py`) - 驗證前端頁面的完整性
- **端對端測試** (`test_e2e.py`) - 完整流程測試

## 快速開始

### 1. 安裝測試依賴

```bash
cd services/tdlib-service
pip install -r requirements.txt
# 或使用 conda
# conda install pytest pytest-asyncio httpx
```

### 2. 運行所有測試

```bash
# 運行所有測試
pytest

# 運行指定測試文件
pytest tests/test_folder_api.py
pytest tests/test_frontend.py
pytest tests/test_e2e.py

# 運行指定測試類別
pytest tests/test_e2e.py::TestE2EFolderSending

# 運行指定測試函數
pytest tests/test_e2e.py::TestE2EFolderSending::test_e2e_flow_1_get_folders

# 詳細輸出
pytest -v

# 顯示 print 輸出
pytest -s

# 顯示測試覆蓋率（需安裝 pytest-cov）
pytest --cov=app tests/
```

## 測試組織

### 測試 1: API 端點測試 (`test_folder_api.py`)

測試所有盒子發送 API 端點的功能：

- `TestFolderAPI.test_get_folders_success` - 取得盒子列表
- `TestFolderAPI.test_get_folder_chats_success` - 取得盒子內的聊天
- `TestFolderAPI.test_preview_folder_send` - 預覽發送前的聊天列表
- `TestFolderAPI.test_preview_folder_send_with_filters` - 帶過濾的預覽
- `TestFolderAPI.test_send_to_folder_success` - 發送訊息
- `TestFolderAPI.test_send_to_folder_with_filters` - 帶過濾的發送

**運行：**
```bash
pytest tests/test_folder_api.py -v
```

### 測試 2: 前端頁面測試 (`test_frontend.py`)

驗證前端 HTML 和 JavaScript 的完整性：

- `TestFrontendPages.test_folder_send_page_exists` - 檢查頁面文件
- `TestFrontendPages.test_folder_send_page_has_key_elements` - 檢查 UI 元素
- `TestFrontendPages.test_folder_send_page_has_key_functions` - 檢查 JavaScript 函數
- `TestFrontendPages.test_folder_send_page_api_endpoints` - 檢查 API 調用
- `TestFrontendPages.test_index_page_has_folder_send_link` - 檢查菜單連結

**運行：**
```bash
pytest tests/test_frontend.py -v
```

### 測試 3: 端對端測試 (`test_e2e.py`)

完整的業務流程測試：

#### 流程 1: 完整發送流程
1. `test_e2e_flow_1_get_folders` - 獲取盒子列表
2. `test_e2e_flow_2_select_folder_and_preview` - 選擇盒子並預覽
3. `test_e2e_flow_3_preview_with_filters` - 帶過濾的預覽
4. `test_e2e_flow_4_send_to_folder_all` - 發送到所有聊天
5. `test_e2e_flow_5_send_to_folder_with_filters` - 帶過濾的發送

#### 流程 2: 多盒子場景
- `test_e2e_flow_multiple_folders` - 測試多個盒子操作

#### 錯誤情況
- `test_e2e_error_no_session` - Session 不存在
- `test_e2e_error_empty_message` - 空訊息
- `test_e2e_error_whitespace_only_message` - 只有空格的訊息

#### 邊界情況
- `test_e2e_boundary_very_long_message` - 很長的訊息
- `test_e2e_boundary_unicode_message` - Unicode 訊息
- `test_e2e_boundary_all_exclude_types` - 排除所有 chat type

**運行：**
```bash
pytest tests/test_e2e.py -v
```

## 測試覆蓋範圍

### ✅ API 端點
- `GET /folders/{user_id}` - 取得盒子列表
- `GET /folders/{user_id}/{folder_id}/chats` - 取得盒子內的聊天
- `POST /folders/{user_id}/{folder_id}/preview` - 預覽發送前的聊天
- `POST /folders/{user_id}/{folder_id}/send` - 發送訊息

### ✅ 業務邏輯
- 盒子列表取得
- 盒子內聊天列表取得
- Chat type 過濾
- 預覽功能（不含過濾、含過濾）
- 發送功能（不含過濾、含過濾、帶重試）
- 錯誤處理
- 邊界情況處理

### ✅ 前端頁面
- HTML 頁面結構完整性
- 關鍵 UI 元素存在性
- JavaScript 函數實現
- API 端點調用正確性
- 錯誤處理邏輯
- 表單驗證邏輯

## 常見問題

### Q: 如何在運行測試時查看 print 輸出？
```bash
pytest -s
```

### Q: 如何只運行某一個測試類別？
```bash
pytest tests/test_e2e.py::TestE2EFolderSending -v
```

### Q: 如何跳過某些測試？
```bash
pytest -m "not slow"  # 跳過標記為 @pytest.mark.slow 的測試
```

### Q: 如何生成測試報告？
```bash
# HTML 報告 (需要 pytest-html)
pytest --html=report.html

# JUnit XML 報告
pytest --junit-xml=report.xml

# 覆蓋率報告 (需要 pytest-cov)
pytest --cov=app --cov-report=html
```

## 測試寫作指南

### 新增測試時的最佳實踐

1. **命名規則**：
   - 測試文件: `test_*.py`
   - 測試類別: `Test*`
   - 測試方法: `test_*`

2. **結構**：
   ```python
   def test_something(self):
       # Arrange - 準備數據
       user_id = "123"
       session = self.create_mock_session(user_id)
       
       # Act - 執行操作
       resp = client.get(f'/folders/{user_id}')
       
       # Assert - 驗證結果
       assert resp.status_code == 200
   ```

3. **使用 fixtures**：
   - 使用 `conftest.py` 中定義的共用 fixtures
   - 避免重複代碼

4. **Mock 對象**：
   - 使用 `unittest.mock.MagicMock` mock TdAuthSession
   - 使用 `side_effect` 模擬複雜邏輯

## 持續集成建議

### GitHub Actions 示例

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: 3.9
      - run: pip install -r services/tdlib-service/requirements.txt
      - run: pytest services/tdlib-service/tests/ -v
```

## 下一步

- 添加更多業務邏輯測試
- 添加性能測試
- 添加安全性測試
- 搭建 CI/CD 流程

---

最後更新: 2026-04-18
