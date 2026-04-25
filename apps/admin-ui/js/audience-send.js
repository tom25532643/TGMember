const API_BASE = 'http://127.0.0.1:8000';
console.log("groups.js loaded");
const state = {
  sources: [],
  selectedSource: null,
  memberPreview: null,
};

const WS_BASE = 'ws://127.0.0.1:8000';

const sendProgressBoxEl = document.getElementById('sendProgressBox');
const sendStatusTextEl = document.getElementById('sendStatusText');
const sendProgressFillEl = document.getElementById('sendProgressFill');
const sendCurrentEl = document.getElementById('send-current');
const sendTotalEl = document.getElementById('send-total');
const sendSuccessEl = document.getElementById('send-success');
const sendFailedEl = document.getElementById('send-failed');
const sendLogEl = document.getElementById('sendLog');
const sendMaxCountInput = document.getElementById('sendMaxCount');

let ws = null;
let currentTaskId = null;
let sendState = { current: 0, total: 0, success: 0, failed: 0 };

const userIdInput = document.getElementById('userId');
const chatIdInput = document.getElementById('chatId');
const maxPagesInput = document.getElementById('maxPages');
const messageTextInput = document.getElementById('messageText');

const sourceListEl = document.getElementById('sourceList');
const memberListEl = document.getElementById('memberList');
const memberInfoBoxEl = document.getElementById('memberInfoBox');

const statTotalEl = document.getElementById('stat-total');
const statPagesEl = document.getElementById('stat-pages');
const statSourceTypeEl = document.getElementById('stat-source-type');

const errorMessageEl = document.getElementById('error-message');
const pageMessageEl = document.getElementById('page-message');

document.getElementById('loadSourcesBtn').addEventListener('click', loadSources);
document.getElementById('loadMembersBtn').addEventListener('click', loadMembers);
document.getElementById('sendMembersBtn').addEventListener('click', sendToMembers);

window.goIndex = function () {
  window.location.replace('index.html');
};

function showError(msg) {
  errorMessageEl.innerHTML = `<div class="error">${msg}</div>`;
}

function clearError() {
  errorMessageEl.innerHTML = '';
}

function showMessage(msg) {
  pageMessageEl.innerHTML = `<div class="info">${msg}</div>`;
}

function renderSources() {
  if (!state.sources.length) {
    sourceListEl.innerHTML = '沒有來源';
    return;
  }

  sourceListEl.innerHTML = state.sources.map(s => `
    <div class="source-item" data-id="${s.chat_id}">
      <div><b>${s.title}</b></div>
      <div>${s.is_channel ? 'Channel' : 'Group'}</div>
    </div>
  `).join('');

  document.querySelectorAll('.source-item').forEach(el => {
    el.onclick = () => {
      const id = Number(el.dataset.id);
      state.selectedSource = state.sources.find(s => s.chat_id === id);
      chatIdInput.value = id;
    };
  });
}

function renderMembers() {
  const data = state.memberPreview;
  if (!data) return;

  statTotalEl.textContent = data.total;
  statPagesEl.textContent = data.pages_fetched;
  statSourceTypeEl.textContent = data.is_channel ? 'Channel' : 'Group';

  memberInfoBoxEl.innerHTML = `
    來源: ${data.title}<br>
    Members: ${data.total}
  `;

  const members = data.members || [];

  memberListEl.innerHTML = members.map(m => `
    <div class="member-item">
      <div>User ${m.user_id}</div>
      <div>${m.status}</div>
    </div>
  `).join('');
}

async function loadSources() {
  clearError();

  const userId = userIdInput.value;
  if (!userId) return showError('請輸入 user_id');

  const res = await fetch(`${API_BASE}/supergroups/${userId}`);
  const data = await res.json();

  state.sources = data.data || [];
  renderSources();
}

async function loadMembers() {
  clearError();

  const userId = userIdInput.value;
  const chatId = chatIdInput.value;
  const maxPages = maxPagesInput.value;

  if (!userId || !chatId) return showError('缺少參數');

  const res = await fetch(
    `${API_BASE}/supergroups/${userId}/${chatId}/members/all?max_pages=${maxPages}`
  );

  const data = await res.json();

  state.memberPreview = data.data;
  renderMembers();
}

async function sendToMembers() {
  clearError();

  const userId = userIdInput.value;
  const chatId = chatIdInput.value;
  const text = messageTextInput.value;
  const maxCount = Number(sendMaxCountInput?.value || 10);

  if (!userId || !chatId) return showError('缺少 user_id 或 chat_id');
  if (!text) return showError('請輸入訊息');

  resetSendProgress();
  document.getElementById('sendMembersBtn').disabled = true;

  try {
    await connectSendWebSocket(userId);

    const res = await fetch(
      `${API_BASE}/supergroups/${userId}/${chatId}/send`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          max_count: maxCount,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok || data.ok === false) {
      throw new Error(data.detail || '發送失敗');
    }

    showMessage('發送完成');
  } catch (e) {
    document.getElementById('sendMembersBtn').disabled = false;
    sendStatusTextEl.textContent = '發送失敗';
    appendSendLog(`發送失敗：${e.message || e}`);
    showError(e.message || String(e));
  }
}

function resetSendProgress() {
  currentTaskId = null;
  sendState = { current: 0, total: 0, success: 0, failed: 0 };

  sendProgressBoxEl.style.display = 'block';
  sendStatusTextEl.textContent = '準備發送...';
  sendProgressFillEl.style.width = '0%';
  sendCurrentEl.textContent = '0';
  sendTotalEl.textContent = '0';
  sendSuccessEl.textContent = '0';
  sendFailedEl.textContent = '0';
  sendLogEl.innerHTML = '<div class="placeholder">等待發送事件...</div>';
}

function updateSendStats() {
  const total = sendState.total || 0;
  const current = sendState.current || 0;
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  sendCurrentEl.textContent = current;
  sendTotalEl.textContent = total;
  sendSuccessEl.textContent = sendState.success;
  sendFailedEl.textContent = sendState.failed;
  sendProgressFillEl.style.width = `${percent}%`;
}

function appendSendLog(text) {
  const placeholder = sendLogEl.querySelector('.placeholder');
  if (placeholder) sendLogEl.innerHTML = '';

  const div = document.createElement('div');
  div.style.padding = '8px 10px';
  div.style.borderBottom = '1px solid #eee';
  div.textContent = text;
  sendLogEl.prepend(div);
}

function handleSendEvent(msg) {
  if (!msg || !msg.event) return;

  if (msg.task_id && currentTaskId && msg.task_id !== currentTaskId) {
    return;
  }

  if (msg.event === 'send_start') {
    currentTaskId = msg.task_id;
    sendState.total = msg.total || 0;
    sendStatusTextEl.textContent = `開始發送：${msg.source_title || msg.source_chat_id}`;
    appendSendLog(`開始發送，目標 ${sendState.total} 位 members`);
  }

  if (msg.event === 'send_progress') {
    sendState.current = msg.current || sendState.current;
    sendState.total = msg.total || sendState.total;
    sendStatusTextEl.textContent = `發送中：${sendState.current}/${sendState.total}`;
  }

  if (msg.event === 'send_success') {
    sendState.current = msg.current || sendState.current;
    sendState.success = msg.success ?? (sendState.success + 1);
    sendState.failed = msg.failed ?? sendState.failed;
    appendSendLog(`成功：User ${msg.target_user_id}`);
  }

  if (msg.event === 'send_failed') {
    sendState.current = msg.current || sendState.current;
    sendState.success = msg.success ?? sendState.success;
    sendState.failed = msg.failed ?? (sendState.failed + 1);
    appendSendLog(`失敗：User ${msg.target_user_id || '-'}，${msg.error || 'unknown'}`);
  }

  if (msg.event === 'send_complete') {
    sendState.current = msg.targeted || sendState.current;
    sendState.total = msg.targeted || sendState.total;
    sendState.success = msg.success || 0;
    sendState.failed = msg.failed || 0;
    sendStatusTextEl.textContent = `發送完成：成功 ${sendState.success}，失敗 ${sendState.failed}`;
    appendSendLog(`發送完成`);
    document.getElementById('sendMembersBtn').disabled = false;
  }

  updateSendStats();
}

function connectSendWebSocket(userId) {
  if (ws && ws.readyState === WebSocket.OPEN) return Promise.resolve(ws);

  return new Promise((resolve, reject) => {
    ws = new WebSocket(`${WS_BASE}/ws/${userId}`);

    ws.onopen = () => resolve(ws);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      handleSendEvent(msg);
    };

    ws.onerror = () => reject(new Error('WebSocket connection failed'));
  });
}