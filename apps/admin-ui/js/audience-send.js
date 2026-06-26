const CONFIG = window.TGMEMBER_CONFIG || {};
const API_BASE = CONFIG.TDLIB_BASE || "http://127.0.0.1:8000";
const WS_BASE = CONFIG.TDLIB_WS_BASE || "ws://127.0.0.1:8000";

const state = {
  sources: [],
  selectedSource: null,
  memberPreview: null,
};

const sendProgressBoxEl = document.getElementById("sendProgressBox");
const sendStatusTextEl = document.getElementById("sendStatusText");
const sendProgressFillEl = document.getElementById("sendProgressFill");
const sendCurrentEl = document.getElementById("send-current");
const sendTotalEl = document.getElementById("send-total");
const sendSuccessEl = document.getElementById("send-success");
const sendFailedEl = document.getElementById("send-failed");
const sendLogEl = document.getElementById("sendLog");
const sendMaxCountInput = document.getElementById("sendMaxCount");

let ws = null;
let currentTaskId = null;
let sendState = { current: 0, total: 0, success: 0, failed: 0 };
let receivedSendComplete = false;

const userIdInput = document.getElementById("userId");
const chatIdInput = document.getElementById("chatId");
const maxPagesInput = document.getElementById("maxPages");
const messageTextInput = document.getElementById("messageText");
const sourceListEl = document.getElementById("sourceList");
const memberListEl = document.getElementById("memberList");
const memberInfoBoxEl = document.getElementById("memberInfoBox");
const statTotalEl = document.getElementById("stat-total");
const statPagesEl = document.getElementById("stat-pages");
const statSourceTypeEl = document.getElementById("stat-source-type");
const errorMessageEl = document.getElementById("error-message");
const pageMessageEl = document.getElementById("page-message");

window.goIndex = function () {
  window.location.replace("index.html");
};

document.getElementById("loadSourcesBtn").addEventListener("click", loadSources);
document.getElementById("loadMembersBtn").addEventListener("click", loadMembers);
document.getElementById("sendMembersBtn").addEventListener("click", sendToMembers);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showError(msg) {
  errorMessageEl.innerHTML = `<div class="error">${escapeHtml(msg)}</div>`;
}

function clearError() {
  errorMessageEl.innerHTML = "";
}

function showMessage(msg) {
  pageMessageEl.innerHTML = msg ? `<div class="info">${escapeHtml(msg)}</div>` : "";
}

function sourceTypeLabel(source) {
  return source?.is_channel ? "頻道" : "群組";
}

function renderSources() {
  if (!state.sources.length) {
    sourceListEl.innerHTML = '<div class="placeholder">沒有可載入的群組或頻道</div>';
    return;
  }

  sourceListEl.innerHTML = state.sources.map((source) => `
    <div class="source-item" data-id="${escapeHtml(source.chat_id)}">
      <div><b>${escapeHtml(source.title || source.chat_id)}</b></div>
      <div>${sourceTypeLabel(source)}</div>
    </div>
  `).join("");

  document.querySelectorAll(".source-item").forEach((el) => {
    el.onclick = () => {
      const id = Number(el.dataset.id);
      state.selectedSource = state.sources.find((source) => source.chat_id === id);
      chatIdInput.value = String(id);
    };
  });
}

function renderMembers() {
  const data = state.memberPreview;
  if (!data) return;

  statTotalEl.textContent = data.total || 0;
  statPagesEl.textContent = data.pages_fetched || 0;
  statSourceTypeEl.textContent = data.is_channel ? "頻道" : "群組";

  memberInfoBoxEl.hidden = false;
  memberInfoBoxEl.innerHTML = `
    聊天室：${escapeHtml(data.title || "-")}<br>
    成員數：${escapeHtml(data.total || 0)}
  `;

  const members = data.members || [];
  if (!members.length) {
    memberListEl.innerHTML = '<div class="placeholder">沒有取得成員。</div>';
    return;
  }

  memberListEl.innerHTML = members.map((member) => `
    <div class="member-item">
      <div>使用者 ${escapeHtml(member.user_id)}</div>
      <div>${escapeHtml(member.status || "-")}</div>
    </div>
  `).join("");
}

async function loadSources() {
  clearError();
  showMessage("");

  const userId = userIdInput.value.trim();
  if (!userId) return showError("請先輸入 User ID。");

  try {
    const res = await fetch(`${API_BASE}/supergroups/${encodeURIComponent(userId)}`);
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.detail || `HTTP ${res.status}`);

    state.sources = data.data || [];
    renderSources();
    showMessage(`已載入 ${state.sources.length} 個群組或頻道。`);
  } catch (error) {
    showError(`載入群組失敗：${error.message}`);
  }
}

async function loadMembers() {
  clearError();
  showMessage("");

  const userId = userIdInput.value.trim();
  const chatId = chatIdInput.value.trim();
  const maxPages = maxPagesInput.value.trim() || "10";

  if (!userId || !chatId) return showError("請輸入 User ID 並選擇群組。");

  try {
    const res = await fetch(`${API_BASE}/supergroups/${encodeURIComponent(userId)}/${encodeURIComponent(chatId)}/members/all?max_pages=${encodeURIComponent(maxPages)}`);
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.detail || `HTTP ${res.status}`);

    state.memberPreview = data.data;
    renderMembers();
    showMessage("成員載入完成。");
  } catch (error) {
    showError(`載入成員失敗：${error.message}`);
  }
}

async function sendToMembers() {
  clearError();

  const userId = userIdInput.value.trim();
  const chatId = chatIdInput.value.trim();
  const text = messageTextInput.value.trim();
  const maxCount = Number(sendMaxCountInput?.value || 10);

  if (!userId || !chatId) return showError("請輸入 User ID 與 Chat ID。");
  if (!text) return showError("請輸入訊息內容。");

  resetSendProgress();
  document.getElementById("sendMembersBtn").disabled = true;

  try {
    await connectSendWebSocket(userId);

    const res = await fetch(`${API_BASE}/supergroups/${encodeURIComponent(userId)}/${encodeURIComponent(chatId)}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, max_count: maxCount }),
    });

    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.detail || "發送失敗");

    const result = data.data || {};
    if (!receivedSendComplete) applySendResult(result);
    showMessage(`發送完成：成功 ${sendState.success}，失敗 ${sendState.failed}。`);
  } catch (error) {
    document.getElementById("sendMembersBtn").disabled = false;
    sendStatusTextEl.textContent = "發送失敗";
    appendSendLog(`發送失敗：${error.message || error}`);
    showError(error.message || String(error));
  }
}

function resetSendProgress() {
  currentTaskId = null;
  receivedSendComplete = false;
  sendState = { current: 0, total: 0, success: 0, failed: 0 };

  sendProgressBoxEl.hidden = false;
  sendStatusTextEl.textContent = "準備發送...";
  sendProgressFillEl.style.width = "0%";
  sendCurrentEl.textContent = "0";
  sendTotalEl.textContent = "0";
  sendSuccessEl.textContent = "0";
  sendFailedEl.textContent = "0";
  sendLogEl.innerHTML = '<div class="placeholder">等待發送結果...</div>';
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
  const placeholder = sendLogEl.querySelector(".placeholder");
  if (placeholder) sendLogEl.innerHTML = "";

  const div = document.createElement("div");
  div.style.padding = "8px 10px";
  div.style.borderBottom = "1px solid #eee";
  div.textContent = text;
  sendLogEl.prepend(div);
}

function applySendResult(result) {
  sendState.total = result.targeted ?? result.total ?? sendState.total;
  sendState.current = result.targeted ?? result.total ?? sendState.current;
  sendState.success = result.success ?? sendState.success;
  sendState.failed = result.failed ?? sendState.failed;
  sendStatusTextEl.textContent = `發送完成：成功 ${sendState.success}，失敗 ${sendState.failed}`;
  appendSendLog(`總結：成功 ${sendState.success}，失敗 ${sendState.failed}`);

  const rows = result.results || [];
  for (const row of rows) {
    if (row.ok) {
      appendSendLog(`成功：user ${row.user_id}${row.private_chat_id ? `，私聊 ${row.private_chat_id}` : ""}`);
    } else {
      appendSendLog(`失敗：user ${row.user_id || "-"} - ${row.error || "未知錯誤"}`);
    }
  }

  document.getElementById("sendMembersBtn").disabled = false;
  updateSendStats();
}

function handleSendEvent(msg) {
  if (!msg || !msg.event) return;
  if (msg.task_id && currentTaskId && msg.task_id !== currentTaskId) return;

  if (msg.event === "send_start") {
    currentTaskId = msg.task_id;
    sendState.total = msg.total || 0;
    sendStatusTextEl.textContent = `開始發送：${msg.source_title || msg.source_chat_id || "-"}`;
    appendSendLog(`開始發送，目標 ${sendState.total} 位成員`);
  }

  if (msg.event === "send_progress") {
    sendState.current = msg.current || sendState.current;
    sendState.total = msg.total || sendState.total;
    sendStatusTextEl.textContent = `發送中：${sendState.current}/${sendState.total}`;
  }

  if (msg.event === "send_success") {
    sendState.current = msg.current || sendState.current;
    sendState.success = msg.success ?? (sendState.success + 1);
    sendState.failed = msg.failed ?? sendState.failed;
    appendSendLog(`成功：user ${msg.target_user_id}`);
  }

  if (msg.event === "send_failed") {
    sendState.current = msg.current || sendState.current;
    sendState.success = msg.success ?? sendState.success;
    sendState.failed = msg.failed ?? (sendState.failed + 1);
    appendSendLog(`失敗：user ${msg.target_user_id || "-"}，${msg.error || "未知錯誤"}`);
  }

  if (msg.event === "send_complete") {
    receivedSendComplete = true;
    sendState.current = msg.targeted || sendState.current;
    sendState.total = msg.targeted || sendState.total;
    sendState.success = msg.success || 0;
    sendState.failed = msg.failed || 0;
    sendStatusTextEl.textContent = `發送完成：成功 ${sendState.success}，失敗 ${sendState.failed}`;
    appendSendLog("發送完成");
    document.getElementById("sendMembersBtn").disabled = false;
  }

  updateSendStats();
}

function connectSendWebSocket(userId) {
  if (ws && ws.readyState === WebSocket.OPEN) return Promise.resolve(ws);

  return new Promise((resolve, reject) => {
    ws = new WebSocket(`${WS_BASE}/ws/${encodeURIComponent(userId)}`);
    ws.onopen = () => resolve(ws);
    ws.onmessage = (event) => handleSendEvent(JSON.parse(event.data));
    ws.onerror = () => reject(new Error("WebSocket 連線失敗"));
  });
}
