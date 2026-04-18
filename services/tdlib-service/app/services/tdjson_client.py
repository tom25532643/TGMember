import json
import os
import queue
import threading
import time
import uuid
from ctypes import CDLL, c_char_p, c_double, c_void_p
from pathlib import Path
from typing import Any, Callable, Optional

from app.core.config import BASE_DIR, TDJSON_DLL, TDLIB_LOG_VERBOSITY
from app.core.errors import TdLibError


class TdJson:
    def __init__(self, tdjson_path: Optional[str] = None):
        dll_path = Path(tdjson_path).resolve() if tdjson_path else TDJSON_DLL.resolve()

        print('Using DLL:', dll_path)
        print('DLL exists:', dll_path.exists())

        if not dll_path.exists():
            raise FileNotFoundError(f'tdjson.dll not found: {dll_path}')

        os.add_dll_directory(str(BASE_DIR))
        self.lib = CDLL(str(dll_path))

        self.lib.td_json_client_create.restype = c_void_p
        self.lib.td_json_client_send.argtypes = [c_void_p, c_char_p]
        self.lib.td_json_client_receive.argtypes = [c_void_p, c_double]
        self.lib.td_json_client_receive.restype = c_char_p
        self.lib.td_json_client_execute.argtypes = [c_void_p, c_char_p]
        self.lib.td_json_client_execute.restype = c_char_p

    def create_client(self):
        client = self.lib.td_json_client_create()
        if not client:
            raise RuntimeError('Failed to create TDLib client')
        return client

    def send(self, client, query: dict) -> None:
        data = json.dumps(query, ensure_ascii=False).encode('utf-8')
        self.lib.td_json_client_send(client, data)

    def receive(self, client, timeout: float = 1.0) -> Optional[dict]:
        result = self.lib.td_json_client_receive(client, timeout)
        if result:
            return json.loads(result.decode('utf-8'))
        return None

    def execute(self, query: dict) -> Optional[dict]:
        data = json.dumps(query, ensure_ascii=False).encode('utf-8')
        result = self.lib.td_json_client_execute(0, data)
        if result:
            return json.loads(result.decode('utf-8'))
        return None


class TdLibClient:
    def __init__(self, tdjson_path: Optional[str] = None, verbose: int = TDLIB_LOG_VERBOSITY):
        self.tdjson = TdJson(tdjson_path)
        self.client = self.tdjson.create_client()

        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self._pending: dict[str, queue.Queue] = {}
        self._update_handlers: list[Callable[[dict], None]] = []
        self._auth_state: Optional[dict] = None

        self.tdjson.execute({
            '@type': 'setLogVerbosityLevel',
            'new_verbosity_level': verbose,
        })

        print('TDLib client created.')

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._receive_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)

    def add_update_handler(self, handler: Callable[[dict], None]) -> None:
        self._update_handlers.append(handler)

    def send(self, query: dict) -> None:
        self.tdjson.send(self.client, query)

    def request(self, query: dict, timeout: float = 30.0) -> dict:
        extra_id = str(uuid.uuid4())
        payload = dict(query)
        payload['@extra'] = extra_id

        q: queue.Queue = queue.Queue(maxsize=1)
        with self._lock:
            self._pending[extra_id] = q

        self.send(payload)

        try:
            response = q.get(timeout=timeout)
        except queue.Empty:
            with self._lock:
                self._pending.pop(extra_id, None)
            raise TimeoutError(f"TDLib request timeout: {query.get('@type')}")

        if response.get('@type') == 'error':
            raise TdLibError(
                response.get('code', -1),
                response.get('message', 'Unknown TDLib error'),
            )
        return response

    def _handle_object(self, obj: dict) -> None:
        extra_id = obj.get('@extra')
        if extra_id:
            with self._lock:
                q = self._pending.pop(extra_id, None)
            if q:
                q.put(obj)
                return

        if obj.get('@type') == 'updateAuthorizationState':
            self._auth_state = obj['authorization_state']

        for handler in self._update_handlers:
            try:
                handler(obj)
            except Exception as exc:
                print(f'[WARN] update handler error: {exc}')

    def _receive_loop(self) -> None:
        while self._running:
            try:
                obj = self.tdjson.receive(self.client, 1.0)
                if obj:
                    self._handle_object(obj)
            except Exception as exc:
                print(f'[ERROR] receive loop exception: {exc}')
                time.sleep(0.2)

    @property
    def auth_state(self) -> Optional[dict]:
        return self._auth_state
