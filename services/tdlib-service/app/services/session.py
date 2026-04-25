import asyncio
import time
import json
import os
import threading
import random
from pathlib import Path
from typing import Any, Dict, Optional

from app.core.config import (
     API_HASH,
    API_ID,
    APPLICATION_VERSION,
    DEVICE_MODEL,
    SESSION_RESTORE_SCAN_PREFIX,
    SESSION_RESTORE_TIMEOUT,
    SYSTEM_LANGUAGE_CODE,
    SYSTEM_VERSION,
    TDLIB_DATA_ROOT,
)
from app.core.errors import TdLibError
from app.services.parsers import parse_message, parse_message_preview
from app.services.tdjson_client import TdLibClient


class TdAuthSession:
    def __init__(self, user_id: str, api_id: int, api_hash: str, tdjson_path: Optional[str] = None):
        self.user_id = user_id
        self.api_id = api_id
        self.api_hash = api_hash
        self.session_dir = str((TDLIB_DATA_ROOT / f'user_{user_id}').resolve())
        self.files_dir = str((TDLIB_DATA_ROOT / f'user_{user_id}' / 'files').resolve())

        os.makedirs(self.session_dir, exist_ok=True)
        os.makedirs(self.files_dir, exist_ok=True)

        self.client = TdLibClient(tdjson_path=tdjson_path)
        self.client.add_update_handler(self._on_update)

        self._lock = threading.Lock()
        self._last_auth_state: Optional[dict] = None
        self._last_error: Optional[dict] = None
        self._me: Optional[dict] = None
        self._started = False
        self._chat_cache: dict[int, dict] = {}
        self._message_cache: dict[int, list[dict]] = {}

        self._broadcast_fn = None
        self._broadcast_chat_fn = None
        self._loop = None
        self._ready_event = threading.Event()
        self._is_ready = False
        self._restore_error: Optional[str] = None
        
        # Auth flow state flags
        self._tdlib_parameters_sent = False
        self._db_key_sent = False
        
        # Folder cache
        self._chat_folders: list[dict] = []
        self._main_chat_list_position: int = 0

    def attach_broadcast(self, user_broadcast_fn, loop, chat_broadcast_fn=None):
        self._broadcast_fn = user_broadcast_fn
        self._broadcast_chat_fn = chat_broadcast_fn
        self._loop = loop

    def _ensure_chat(self, chat_id):
        if chat_id not in self._chat_cache:
            self._chat_cache[chat_id] = {
                'id': chat_id,
                'title': '',
                'type': {},
                'unread_count': 0,
                'last_message': None,
                'positions': [],
            }

    def _set_chat_positions(self, chat_id: int, positions: list[dict]) -> None:
        self._ensure_chat(chat_id)
        self._chat_cache[chat_id]['positions'] = positions or []


    def _apply_chat_position(self, chat_id: int, position: dict) -> None:
        self._ensure_chat(chat_id)

        positions = self._chat_cache[chat_id].get('positions') or []
        target_list = position.get('list') or {}
        target_type = target_list.get('@type')

        def same_list(p: dict) -> bool:
            lst = p.get('list') or {}
            if lst.get('@type') != target_type:
                return False

            if target_type == 'chatListFolder':
                return lst.get('chat_folder_id') == target_list.get('chat_folder_id')

            return True

        positions = [p for p in positions if not same_list(p)]

        # order == 0 代表從該 list 移除
        if (position.get('order') or 0) != 0:
            positions.append(position)

        self._chat_cache[chat_id]['positions'] = positions

    def _broadcast(self, user_id, payload):
        if self._broadcast_fn and self._loop:
            try:
                asyncio.run_coroutine_threadsafe(
                    self._broadcast_fn(user_id, payload),
                    self._loop,
                )
            except Exception as e:
                print(f"[WS ERROR] {e}")

    def _broadcast_chat(self, user_id, chat_id, payload):
        if self._broadcast_chat_fn and self._loop:
            asyncio.run_coroutine_threadsafe(
                self._broadcast_chat_fn(user_id, chat_id, payload),
                self._loop,
            )

    def _on_update(self, update: dict) -> None:
        utype = update.get('@type')

        if utype == 'updateAuthorizationState':
            state = update['authorization_state']
            state_type = state.get('@type')

            with self._lock:
                self._last_auth_state = state

            print(f"[USER {self.user_id}] AUTH STATE = {state_type}")
            print(json.dumps(update, ensure_ascii=False, indent=2))

            if state_type == 'authorizationStateWaitTdlibParameters':
                if not self._tdlib_parameters_sent:
                    self._tdlib_parameters_sent = True
                    try:
                        self.set_tdlib_parameters()
                    except Exception as exc:
                        self._restore_error = f'setTdlibParameters failed: {exc}'
                        print(f'[USER {self.user_id}] setTdlibParameters failed: {exc}')
                return

            if state_type == 'authorizationStateWaitEncryptionKey':
                if not self._db_key_sent:
                    self._db_key_sent = True
                    try:
                        self.check_database_encryption_key()
                    except Exception as exc:
                        self._restore_error = f'checkDatabaseEncryptionKey failed: {exc}'
                        print(f'[USER {self.user_id}] checkDatabaseEncryptionKey failed: {exc}')
                return

            if state_type == 'authorizationStateReady':
                self._is_ready = True
                self._restore_error = None
                self._ready_event.set()

                # 注意: getMe 不再自動調用，避免 timeout
                # 如需要可透過 get_me() 主動呼叫

                return
            
            if state_type == 'authorizationStateWaitPhoneNumber':
                self._is_ready = False
                self._restore_error = 'session requires login again'
                self._ready_event.set()
                return

            if state_type == 'authorizationStateWaitCode':
                self._is_ready = False
                self._restore_error = 'session requires authentication code'
                self._ready_event.set()
                return

            if state_type == 'authorizationStateWaitPassword':
                self._is_ready = False
                self._restore_error = 'session requires 2FA password'
                self._ready_event.set()
                return

            if state_type in {
                'authorizationStateClosed',
                'authorizationStateClosing',
                'authorizationStateLoggingOut',
            }:
                self._is_ready = False
                return

            return

        if utype == 'updateConnectionState':
            print(f'[USER {self.user_id}] CONNECTION = {json.dumps(update, ensure_ascii=False)}')
            return

        if utype == 'updateChat':
            chat = update.get('chat')
            if chat:
                with self._lock:
                    self._chat_cache[chat['id']] = chat
            return
        
        if utype == 'updateNewChat':
            chat = update.get('chat')
            if chat:
                with self._lock:
                    self._chat_cache[chat['id']] = chat
            return

        if utype == 'updateChatLastMessage':
            chat_id = update.get('chat_id')

            with self._lock:
                self._ensure_chat(chat_id)
                self._chat_cache[chat_id]['last_message'] = update.get('last_message')
                self._set_chat_positions(chat_id, update.get('positions') or [])

            return

        if utype == 'updateChatReadInbox':
            chat_id = update.get('chat_id')

            with self._lock:
                self._ensure_chat(chat_id)
                self._chat_cache[chat_id]['unread_count'] = update.get('unread_count', 0)

            return
        
        if utype == 'updateChatPosition':
            chat_id = update.get('chat_id')
            position = update.get('position', {})

            with self._lock:
                self._apply_chat_position(chat_id, position)

            return
        
        if utype == 'updateChatTitle':
            chat_id = update.get('chat_id')

            with self._lock:
                self._ensure_chat(chat_id)
                self._chat_cache[chat_id]['title'] = update.get('title', '')
            return

        if utype == 'updateNewMessage':
            message = update.get('message') or {}
            chat_id = message.get('chat_id')

            if not chat_id:
                return

            parsed_message = parse_message(message)
            message_id = parsed_message.get('id')

            with self._lock:
                self._ensure_chat(chat_id)
                self._chat_cache[chat_id]['last_message'] = message

                if chat_id not in self._message_cache:
                    self._message_cache[chat_id] = []

                # 避免重複加入同一則訊息
                if not any(m.get('id') == message_id for m in self._message_cache[chat_id]):
                    self._message_cache[chat_id].append(parsed_message)

            payload = {
                'event': 'new_message',
                'data': parsed_message,
            }

            self._broadcast_chat(self.user_id, str(chat_id), payload)
            self._broadcast(self.user_id, payload)
            return

        if utype == 'updateChatFolders':
            with self._lock:
                self._chat_folders = update.get('chat_folders', []) or []
                self._main_chat_list_position = update.get('main_chat_list_position', 0)
            return

    def reset_restore_state(self) -> None:
        self._ready_event.clear()
        self._is_ready = False
        self._restore_error = None
        self._tdlib_parameters_sent = False
        self._db_key_sent = False

    def start(self) -> None:
        if self._started:
            return
        self.client.start()
        self._started = True
        
    def restore(self, timeout: float = SESSION_RESTORE_TIMEOUT) -> bool:
        """
        Restart server 時重建 TDLib client，等待是否自動回到 authorizationStateReady。
        只依賴 TDLib 已存在的 session database，不重新送 phone/code/password。
        """
        self.reset_restore_state()
        self.start()

        ok = self._ready_event.wait(timeout=timeout)
        if not ok:
            self._restore_error = f'restore timeout after {timeout} seconds'
            return False
        return self._is_ready

    def set_tdlib_parameters(self) -> None:
        params = {
            '@type': 'setTdlibParameters',
            'use_test_dc': False,
            'database_directory': self.session_dir,
            'files_directory': self.files_dir,
            'use_file_database': True,
            'use_chat_info_database': True,
            'use_message_database': True,
            'use_secret_chats': False,
            'api_id': self.api_id,
            'api_hash': self.api_hash,
            'system_language_code': SYSTEM_LANGUAGE_CODE,
            'device_model': DEVICE_MODEL,
            'system_version': SYSTEM_VERSION,
            'application_version': APPLICATION_VERSION,
        }
        print(f'[USER {self.user_id}] setTdlibParameters payload:')
        print(json.dumps(params, ensure_ascii=False, indent=2))
        self.client.send(params)
    
    def check_database_encryption_key(self) -> None:
        payload = {
            '@type': 'checkDatabaseEncryptionKey',
            'encryption_key': '',
        }
        print(f'[USER {self.user_id}] checkDatabaseEncryptionKey payload:')
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        self.client.send(payload)

    def submit_phone(self, phone_number: str) -> dict:
        return self.client.request({
            '@type': 'setAuthenticationPhoneNumber',
            'phone_number': phone_number,
            'settings': {
                '@type': 'phoneNumberAuthenticationSettings',
                'allow_flash_call': False,
                'allow_missed_call': False,
                'is_current_phone_number': False,
                'allow_sms_retriever_api': False,
            },
        }, timeout=30)

    def submit_code(self, code: str) -> dict:
        return self.client.request({'@type': 'checkAuthenticationCode', 'code': code}, timeout=30)

    def submit_password(self, password: str) -> dict:
        return self.client.request({'@type': 'checkAuthenticationPassword', 'password': password}, timeout=30)

    def get_state(self) -> Dict[str, Any]:
        with self._lock:
            state = self._last_auth_state
            last_error = self._last_error
            me = self._me

        return {
            'user_id': self.user_id,
            'auth_state': state['@type'] if state else None,
            'auth_state_raw': state,
            'last_error': last_error,
            'is_authorized': state is not None and state['@type'] == 'authorizationStateReady',
            'is_ready': self._is_ready,
            'restore_error': self._restore_error,
            'me': me,
        }

    def get_me(self, timeout: float = 10.0) -> Optional[dict]:
        """
        主動獲取當前用戶信息。
        這在 authorizationStateReady 時可用。
        """
        try:
            me = self.client.request({'@type': 'getMe'}, timeout=timeout)
            with self._lock:
                self._me = me
            return me
        except Exception as exc:
            print(f'[USER {self.user_id}] getMe failed: {exc}')
            return None

    def get_chats(self, limit: int = 50) -> list[dict]:
        result = self.client.request({'@type': 'getChats', 'limit': limit}, timeout=30)
        chat_ids = result.get('chat_ids', [])
        chats = []

        for chat_id in chat_ids:
            with self._lock:
                chat = self._chat_cache.get(chat_id)

            need_fetch = (
                not chat
                or not chat.get('title')
                or not chat.get('type')
            )

            if need_fetch:
                full_chat = self.client.request({
                    '@type': 'getChat',
                    'chat_id': chat_id
                }, timeout=30)

                with self._lock:
                    self._chat_cache[chat_id] = full_chat
                    chat = full_chat
            chats.append({
                'id': chat.get('id'),
                'title': chat.get('title'),
                'type': chat.get('type', {}).get('@type'),
                'unread_count': chat.get('unread_count', 0),
                'last_message': parse_message_preview(chat.get('last_message')),
            })

        chats.sort(
            key=lambda c: (c.get('position') or {}).get('order', 0),
            reverse=True
        )

        return chats

    def get_messages(self, chat_id: int, limit: int = 50, from_message_id: str | int = 0) -> list[dict]:
        from_id = int(from_message_id or 0)

        result = self.client.request({
            '@type': 'getChatHistory',
            'chat_id': chat_id,
            'from_message_id': from_id,
            'offset': 0,
            'limit': limit,
            'only_local': False,
        }, timeout=30)

        messages = [parse_message(m) for m in result.get('messages', [])]

        # 很重要：避免 JS Number 精度問題
        for m in messages:
            if 'id' in m:
                m['id'] = str(m['id'])
            if 'chat_id' in m:
                m['chat_id'] = str(m['chat_id'])

        with self._lock:
            if from_id == 0:
                self._message_cache[chat_id] = messages
            else:
                self._message_cache.setdefault(chat_id, [])
                existing_ids = {str(m.get('id')) for m in self._message_cache[chat_id]}
                new_messages = [m for m in messages if str(m.get('id')) not in existing_ids]
                self._message_cache[chat_id] = new_messages + self._message_cache[chat_id]

        return messages

    def send_text(self, chat_id: int, text: str) -> dict:
        return self.client.request({
            '@type': 'sendMessage',
            'chat_id': chat_id,
            'input_message_content': {
                '@type': 'inputMessageText',
                'text': {
                    '@type': 'formattedText',
                    'text': text,
                },
            },
        }, timeout=30)

    def close(self) -> None:
        try:
            self.client.request({'@type': 'close'}, timeout=10)
        except Exception as exc:
            print(f'[USER {self.user_id}] close failed: {exc}')
        self.client.stop()

    def _normalize_folder_name(self, raw_name):
        if raw_name is None:
            return ''

        # string
        if isinstance(raw_name, str):
            raw_name = raw_name.strip()
            if not raw_name:
                return ''

            # JSON string
            if raw_name.startswith('{') and raw_name.endswith('}'):
                try:
                    return self._normalize_folder_name(json.loads(raw_name))
                except Exception:
                    return raw_name

            return raw_name

        # dict
        if isinstance(raw_name, dict):
            t = raw_name.get('@type')

            # chatFolderName
            if t == 'chatFolderName':
                return self._normalize_folder_name(
                    raw_name.get('name') or raw_name.get('text')
                )

            # formattedText
            if t == 'formattedText':
                return self._normalize_folder_name(raw_name.get('text'))

            # text object
            if t == 'text':
                return self._normalize_folder_name(raw_name.get('text'))

            # 常見 key
            for k in ('name', 'text', 'title', 'label', 'value'):
                if k in raw_name:
                    v = self._normalize_folder_name(raw_name[k])
                    if v:
                        return v

            # fallback：掃整個 dict
            for v in raw_name.values():
                name = self._normalize_folder_name(v)
                if name:
                    return name

            return ''

        # list
        if isinstance(raw_name, list):
            for v in raw_name:
                name = self._normalize_folder_name(v)
                if name:
                    return name
            return ''

        return ''
    
    def get_folders(self) -> list[dict]:
        with self._lock:
            folders = list(self._chat_folders)

        result = []
        for f in folders:
            folder_id = int(f.get('id', 0))
            folder_name = self._normalize_folder_name(f.get('name', ''))
            if not folder_name:
                folder_name = self._normalize_folder_name(f)
            folder_dict = {
                'id': folder_id,
                'name': folder_name or f"Folder {folder_id}",
                'icon': str((f.get('icon') or {}).get('@type', '')),
                'color_id': f.get('color_id'),
            }
            result.append(folder_dict)

        return result
    
    def get_folder_chats(self, folder_id: int) -> list[dict]:
        try:
            self.client.request({
                '@type': 'loadChats',
                'chat_list': {
                    '@type': 'chatListFolder',
                    'chat_folder_id': folder_id,
                },
                'limit': 100,
            }, timeout=30)
        except Exception as exc:
            print(f'[USER {self.user_id}] loadChats(folder={folder_id}) warning: {exc}')

        matched = []

        with self._lock:
            for chat in self._chat_cache.values():
                positions = chat.get('positions') or []

                for pos in positions:
                    lst = pos.get('list') or {}
                    if (
                        lst.get('@type') == 'chatListFolder'
                        and lst.get('chat_folder_id') == folder_id
                    ):
                        matched.append(chat)
                        break

        matched.sort(
            key=lambda c: next(
                (
                    p.get('order', 0)
                    for p in (c.get('positions') or [])
                    if (
                        ((p.get('list') or {}).get('@type') == 'chatListFolder')
                        and ((p.get('list') or {}).get('chat_folder_id') == folder_id)
                    )
                ),
                0
            ),
            reverse=True
        )

        return [
            {
                'chat_id': chat.get('id'),
                'title': chat.get('title'),
                'type': (chat.get('type') or {}).get('@type'),
                'last_message': parse_message_preview(chat.get('last_message')),
            }
            for chat in matched
        ]

    def get_group_chats(self, limit: int = 100) -> list[dict]:
        chats = self.get_chats(limit=limit)
        return [
            c for c in chats
            if c.get('type') in ['chatTypeBasicGroup', 'chatTypeSupergroup']
        ]
    
    def get_supergroups(self, limit: int = 100) -> list[dict]:
        chats = self.get_chats(limit=limit)
        result = []

        for c in chats:
            if c.get('type') == 'chatTypeSupergroup':
                chat_id = c.get('id')

                # 取 full chat（為了拿 supergroup_id / is_channel）
                try:
                    full_chat = self.client.request({
                        '@type': 'getChat',
                        'chat_id': chat_id
                    }, timeout=10)
                except Exception:
                    continue

                chat_type = full_chat.get('type', {})
                if chat_type.get('@type') != 'chatTypeSupergroup':
                    continue

                result.append({
                    'chat_id': chat_id,
                    'title': full_chat.get('title'),
                    'supergroup_id': chat_type.get('supergroup_id'),
                    'is_channel': bool(chat_type.get('is_channel')),
                })

        return result
    
    def get_supergroup_members_preview(self, chat_id: int, limit: int = 200) -> dict:
        return self.get_all_supergroup_members(
            chat_id=chat_id,
            max_pages=1,
            page_size=limit
        )
    
    def get_all_supergroup_members(self, chat_id: int, max_pages: int = 10, page_size: int = 200) -> dict:
        """
        抓取指定 supergroup / channel 的所有可取得 members（分頁）。
        
        chat_id: Telegram chat_id
        max_pages: 最多抓幾頁，避免無限循環
        page_size: 每頁大小，TDLib 單次上限通常為 200
        """
        if max_pages <= 0:
            raise ValueError('max_pages must be > 0')

        if page_size <= 0:
            raise ValueError('page_size must be > 0')

        if page_size > 200:
            page_size = 200

        # 先拿 chat → supergroup_id
        full_chat = self.client.request({
            '@type': 'getChat',
            'chat_id': chat_id
        }, timeout=10)

        chat_type = full_chat.get('type', {})
        if chat_type.get('@type') != 'chatTypeSupergroup':
            raise ValueError('Not a supergroup')

        supergroup_id = chat_type.get('supergroup_id')
        is_channel = bool(chat_type.get('is_channel'))

        all_members = []
        seen_user_ids = set()

        offset = 0
        fetched_pages = 0

        while fetched_pages < max_pages:
            result = self.client.request({
                '@type': 'getSupergroupMembers',
                'supergroup_id': supergroup_id,
                'filter': {
                    '@type': 'supergroupMembersFilterRecent'
                },
                'offset': offset,
                'limit': page_size
            }, timeout=20)

            print({
                "@type": "getSupergroupMembers",
                "supergroup_id": supergroup_id,
                "filter": {"@type": "supergroupMembersFilterRecent"},
                "offset": offset,
                "limit": page_size,
            })

            members = result.get('members', []) or []
            if not members:
                break

            print(f"offset={offset}, count={len(members)}")
            print([((m.get('member_id') or {}).get('user_id')) for m in members[:10]])
            print([((m.get('member_id') or {}).get('user_id')) for m in members[:10]])
            print([((m.get('member_id') or {}).get('user_id')) for m in members[-10:]])

            page_added = 0

            for m in members:
                member_id = m.get('member_id') or {}
                user_id = member_id.get('user_id')
                status = (m.get('status') or {}).get('@type')

                # 某些 member 可能不是 user，先跳過
                if not user_id:
                    continue

                if user_id in seen_user_ids:
                    continue

                seen_user_ids.add(user_id)
                all_members.append({
                    'user_id': user_id,
                    'status': status,
                })
                page_added += 1

            fetched_pages += 1

            # 如果這頁回傳數量不足 page_size，通常代表到底了
            if len(members) < page_size:
                break

            # 下一頁 offset 往後推
            offset += len(members)

            # 保險：如果這頁完全沒新增，避免奇怪情況卡住
            if page_added == 0:
                break

        return {
            'chat_id': chat_id,
            'title': full_chat.get('title'),
            'supergroup_id': supergroup_id,
            'is_channel': is_channel,
            'total': len(all_members),
            'page_size': page_size,
            'pages_fetched': fetched_pages,
            'members': all_members,
        }
    
    def create_private_chat(self, user_id: int) -> dict:
        """
        建立或取得 private chat（DM）
        """
        return self.client.request({
            '@type': 'createPrivateChat',
            'user_id': user_id,
            'force': True,
        }, timeout=20)

    def send_to_members(self, chat_id: int, text: str, max_count: int = 10) -> dict:
        """
        對 supergroup / channel 成員逐一發送私訊，並透過 user-level WebSocket 回報進度。
        """
        if not text or not text.strip():
            raise ValueError('text required')

        task_id = f"send_{int(time.time())}"

        preview = self.get_all_supergroup_members(
            chat_id=chat_id,
            max_pages=5,
            page_size=200,
        )

        members = preview.get('members', []) or []
        max_count = max(1, min(int(max_count), 100))
        targets = members[:max_count]

        success = 0
        failed = 0
        results = []

        self._broadcast(self.user_id, {
            'event': 'send_start',
            'task_id': task_id,
            'source_chat_id': chat_id,
            'source_title': preview.get('title'),
            'total': len(targets),
        })

        for idx, m in enumerate(targets):
            user_id = m.get('user_id')
            status = m.get('status')

            self._broadcast(self.user_id, {
                'event': 'send_progress',
                'task_id': task_id,
                'source_chat_id': chat_id,
                'current': idx + 1,
                'total': len(targets),
                'target_user_id': user_id,
                'status': status,
            })

            if not user_id:
                failed += 1
                item = {
                    'user_id': None,
                    'status': status,
                    'ok': False,
                    'error': 'missing user_id',
                }
                results.append(item)

                self._broadcast(self.user_id, {
                    'event': 'send_failed',
                    'task_id': task_id,
                    'source_chat_id': chat_id,
                    'current': idx + 1,
                    'total': len(targets),
                    'target_user_id': None,
                    'error': 'missing user_id',
                })
                continue

            try:
                # 1. 建立或取得 private chat
                private_chat = self.create_private_chat(user_id)
                private_chat_id = private_chat.get('id')

                if not private_chat_id:
                    raise Exception('no private_chat_id')

                # 2. 發送訊息
                self.send_text(chat_id=private_chat_id, text=text)

                success += 1
                item = {
                    'user_id': user_id,
                    'status': status,
                    'ok': True,
                    'private_chat_id': private_chat_id,
                }
                results.append(item)

                self._broadcast(self.user_id, {
                    'event': 'send_success',
                    'task_id': task_id,
                    'source_chat_id': chat_id,
                    'current': idx + 1,
                    'total': len(targets),
                    'target_user_id': user_id,
                    'private_chat_id': private_chat_id,
                    'success': success,
                    'failed': failed,
                })

            except Exception as e:
                failed += 1
                item = {
                    'user_id': user_id,
                    'status': status,
                    'ok': False,
                    'error': str(e),
                }
                results.append(item)

                self._broadcast(self.user_id, {
                    'event': 'send_failed',
                    'task_id': task_id,
                    'source_chat_id': chat_id,
                    'current': idx + 1,
                    'total': len(targets),
                    'target_user_id': user_id,
                    'error': str(e),
                    'success': success,
                    'failed': failed,
                })

            # Rate limit：每筆間隔 1 秒，不 retry
            if idx < len(targets) - 1:
                time.sleep(random.uniform(0.8, 1.2))

        summary = {
            'source_chat_id': chat_id,
            'source_title': preview.get('title'),
            'task_id': task_id,
            'targeted': len(targets),
            'success': success,
            'failed': failed,
            'results': results,
        }

        self._broadcast(self.user_id, {
            'event': 'send_complete',
            'task_id': task_id,
            'source_chat_id': chat_id,
            'source_title': preview.get('title'),
            'targeted': len(targets),
            'success': success,
            'failed': failed,
        })

        return summary

    def get_folder_chats_preview(self, folder_id: int, exclude_types: Optional[list[str]] = None) -> dict:
        """
        取得 folder 內的 chats 預覽，並支援過濾。
        exclude_types: 要排除的 chat type 列表，例如 ['chatTypeChannel', 'chatTypeBasicGroup']
        """
        targets = self.get_folder_chats(folder_id)
        
        if exclude_types is None:
            exclude_types = []
        
        filtered = []
        excluded = []
        
        for t in targets:
            if t.get('type') in exclude_types:
                excluded.append(t)
            else:
                filtered.append(t)
        
        return {
            'total': len(targets),
            'included': len(filtered),
            'excluded': len(excluded),
            'chats': filtered,
            'excluded_chats': excluded,
        }

    def send_to_folder(self, folder_id: int, text: str, exclude_types: Optional[list[str]] = None, retry_failed: bool = True) -> dict:
        """
        對 folder 內的所有 chats 發送訊息。
        
        exclude_types: 要排除的 chat type 列表
        retry_failed: 是否對失敗的 chats 進行重試
        """
        preview = self.get_folder_chats_preview(folder_id, exclude_types)
        targets = preview.get('chats', [])

        results = []
        success = 0
        failed = 0
        failed_chats = []

        # 第一次嘗試
        for t in targets:
            chat_id = t['chat_id']
            try:
                self.send_text(chat_id=chat_id, text=text)
                results.append({
                    'chat_id': chat_id,
                    'title': t.get('title'),
                    'type': t.get('type'),
                    'ok': True,
                })
                success += 1
            except Exception as e:
                results.append({
                    'chat_id': chat_id,
                    'title': t.get('title'),
                    'type': t.get('type'),
                    'ok': False,
                    'error': str(e),
                })
                failed += 1
                failed_chats.append((t, str(e)))

        # 重試失敗的 chats （最多重試一次）
        if retry_failed and failed_chats:
            retry_success = 0
            retry_failed_list = []
            
            for t, original_error in failed_chats:
                chat_id = t['chat_id']
                try:
                    self.send_text(chat_id=chat_id, text=text)
                    # 從結果中找到這個 chat 的記錄並更新
                    for r in results:
                        if r['chat_id'] == chat_id:
                            r['ok'] = True
                            r['error'] = None
                            r['retry_ok'] = True
                    success += 1
                    failed -= 1
                    retry_success += 1
                except Exception as e:
                    for r in results:
                        if r['chat_id'] == chat_id:
                            r['retry_ok'] = False
                            r['retry_error'] = str(e)
                    retry_failed_list.append((t, str(e)))

        return {
            'total': len(targets),
            'excluded': len(preview.get('excluded_chats', [])),
            'success': success,
            'failed': failed,
            'results': results,
            'failed_detail': [{'chat_id': t['chat_id'], 'title': t.get('title'), 'error': err} for t, err in failed_chats],
        }

    def download_file(self, file_id: int) -> dict:
        result = self.client.request({
            "@type": "downloadFile",
            "file_id": int(file_id),
            "priority": 32,
            "offset": 0,
            "limit": 0,
            "synchronous": True,
        }, timeout=120)

        return result

class TdSessionManager:
    def __init__(self):
        self._sessions: Dict[str, TdAuthSession] = {}
        self._lock = threading.Lock()

    def get_or_create(self, user_id: str) -> TdAuthSession:
        with self._lock:
            if user_id not in self._sessions:
                session = TdAuthSession(
                    user_id=user_id,
                    api_id=API_ID,
                    api_hash=API_HASH,
                    tdjson_path=None,
                )

                # 🔥 attach ws（避免新 session 沒綁）
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)

                from app.state import ws_manager
                session.attach_broadcast(
                    user_broadcast_fn=ws_manager.broadcast_to_user,
                    chat_broadcast_fn=ws_manager.broadcast_to_chat,
                    loop=loop,
                )

                self._sessions[user_id] = session

            return self._sessions[user_id]

    def get(self, user_id: str) -> Optional[TdAuthSession]:
        with self._lock:
            return self._sessions.get(user_id)
        
    def discover_existing_sessions(self) -> list[str]:
        if not TDLIB_DATA_ROOT.exists():
            return []

        user_ids: list[str] = []
        prefix = SESSION_RESTORE_SCAN_PREFIX

        for child in TDLIB_DATA_ROOT.iterdir():
            if not child.is_dir():
                continue
            if not child.name.startswith(prefix):
                continue

            user_id = child.name[len(prefix):].strip()
            if not user_id:
                continue
            if not user_id.isdigit():
                continue

            user_ids.append(user_id)

        return sorted(user_ids, key=int)

    def remove(self, user_id: str) -> None:
        with self._lock:
            session = self._sessions.pop(user_id, None)
        if session:
            session.close()

    def restore_session(self, user_id: str, timeout: float = SESSION_RESTORE_TIMEOUT) -> bool:
        session = self.get_or_create(user_id)
        ok = session.restore(timeout=timeout)

        if not ok:
            print(f'[RESTORE] user_{user_id} failed: {session.get_state().get("restore_error")}')
            self.discard(user_id)
            return False

        print(f'[RESTORE] user_{user_id} restored successfully')
        return True
    
    def restore_all_sessions(self, timeout: float = SESSION_RESTORE_TIMEOUT) -> dict:
        user_ids = self.discover_existing_sessions()

        restored: list[str] = []
        failed: list[str] = []

        for user_id in user_ids:
            try:
                ok = self.restore_session(user_id, timeout=timeout)
                if ok:
                    restored.append(user_id)
                else:
                    failed.append(user_id)
            except Exception as exc:
                print(f'[RESTORE] user_{user_id} exception: {exc}')
                failed.append(user_id)
                self.remove(user_id)

        return {
            'found': len(user_ids),
            'restored': restored,
            'failed': failed,
        }

    def discard(self, user_id: str) -> None:
        with self._lock:
            self._sessions.pop(user_id, None)