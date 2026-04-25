let currentChatId = null;
let currentUserId = null;
let currentChatTitle = "";
let ws = null;
let chatsCache = [];
let messageStore = {};

let loadingMessages = false;
let loadingOlder = false;
let hasMore = true;

const API_BASE = "http://127.0.0.1:8000";
const WS_BASE = "ws://127.0.0.1:8000";

console.log("chat.js FINAL version loaded");

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatTime(unixTs) {
  return new Date(unixTs * 1000).toLocaleString();
}

function createMessageElement(msg) {
  const isSelf = msg.is_outgoing === true;
  const cls = isSelf ? "self" : "other";
  const text = escapeHtml(msg.text || `[${msg.content_type}]`);

  const div = document.createElement("div");
  div.className = `bubble ${cls}`;
  div.dataset.messageId = msg.id;

  div.innerHTML = `
    <div>${text}</div>
    <div class="meta">
      ${isSelf ? "Me" : msg.sender_id} · ${formatTime(msg.date)}
    </div>
  `;

  return div;
}

function renderInitial(messages) {
  const box = document.getElementById("messageBox");
  box.innerHTML = "";

  for (const msg of messages) {
    box.appendChild(createMessageElement(msg));
  }

  box.scrollTop = box.scrollHeight;
}

function appendMessage(msg) {
  const key = String(msg.chat_id);

  if (!messageStore[key]) messageStore[key] = [];

  const beforeLength = messageStore[key].length;

  const merged = mergeMessages(key, [msg]);

  // 沒新增就不動
  if (merged.length === beforeLength) return;

  if (String(currentChatId) !== key) return;

  const box = document.getElementById("messageBox");
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 100;

  renderInitial(merged);

  if (nearBottom) {
    box.scrollTop = box.scrollHeight;
  }
}

function prependMessages(chatId, older) {
  const key = String(chatId);
  const box = document.getElementById("messageBox");

  const oldHeight = box.scrollHeight;

  const frag = document.createDocumentFragment();

  for (const msg of older) {
    frag.appendChild(createMessageElement(msg));
  }

  box.insertBefore(frag, box.firstChild);

  messageStore[key] = normalizeMessages([
    ...older,
    ...(messageStore[key] || []),
  ]);

  const newHeight = box.scrollHeight;
  box.scrollTop = newHeight - oldHeight;
}

async function loadMessages(userId, chatId, chatTitle = "") {
  const key = String(chatId);

  if (loadingMessages) return;

  loadingMessages = true;
  hasMore = true;

  currentChatId = chatId;
  currentChatTitle = chatTitle || `Chat ${chatId}`;

  document.getElementById("chatTitle").textContent = currentChatTitle;

  const box = document.getElementById("messageBox");
  box.innerHTML = `<div class="empty">Loading...</div>`;

  if (ws) {
    ws.close();
    ws = null;
  }

  try {
    // 1. 先載入歷史訊息
    const rawMessages = await fetchMessagesWithRetry(userId, chatId, 50);

    messageStore[key] = [];
    const messages = mergeMessages(chatId, rawMessages);

    hasMore = rawMessages.length === 50;

    renderInitial(messages);

    // 2. 先 render 歷史
    renderInitial(messages);

    // 3. 最後才開 WebSocket，避免初始化期間亂序
    connectWs(userId, chatId);
  } catch (err) {
    console.error("loadMessages error:", err);
    box.innerHTML = `<div class="empty">Load messages failed</div>`;
  } finally {
    loadingMessages = false;
  }
}

async function loadOlderMessages() {
  console.log("loadOlder triggered");

  if (loadingOlder || loadingMessages || !hasMore) return;

  const key = String(currentChatId);
  const current = messageStore[key] || [];

  if (current.length === 0) return;

  loadingOlder = true;

  const box = document.getElementById("messageBox");
  const oldHeight = box.scrollHeight;

  const oldest = current[0];

  try {
    const res = await fetch(
      `${API_BASE}/messages/${currentUserId}/${currentChatId}?limit=50&from_message_id=${oldest.id}`,
    );

    const data = await res.json();
    const rawOlder = data.data || [];

    if (rawOlder.length === 0) {
      hasMore = false;
      return;
    }

    const merged = mergeMessages(currentChatId, rawOlder);

    renderInitial(merged);

    const newHeight = box.scrollHeight;
    box.scrollTop = newHeight - oldHeight;

    hasMore = rawOlder.length === 50;
  } catch (err) {
    console.error("loadOlderMessages error:", err);
  } finally {
    loadingOlder = false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMessagesWithRetry(userId, chatId, limit = 50) {
  let lastData = [];

  for (let i = 0; i < 3; i++) {
    const res = await fetch(
      `${API_BASE}/messages/${userId}/${chatId}?limit=${limit}`,
    );

    const data = await res.json();
    const messages = data.data || [];

    console.log("initial messages count:", messages.length, "try:", i + 1);

    lastData = messages;

    // 正常拿到多筆，就直接用
    if (messages.length > 1) {
      return messages;
    }

    // 第一次只拿到 1 筆，等 TDLib 補資料
    await sleep(300);
  }

  return lastData;
}

function connectWs(userId, chatId) {
  ws = new WebSocket(`${WS_BASE}/ws/${userId}/${chatId}`);

  ws.onopen = () => {
    console.log("ws connected:", userId, chatId);
  };

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);

    if (msg.event === "new_message") {
      appendMessage(msg.data);
    }
  };
}

async function loadChats(userId) {
  const res = await fetch(`${API_BASE}/chats/${userId}?limit=50`);
  const data = await res.json();

  chatsCache = data.data || [];

  renderChats(chatsCache);
}

function renderChats(chats) {
  const list = document.getElementById("chatList");

  if (!list) {
    console.error("chatList element not found");
    return;
  }

  list.innerHTML = "";

  for (const chat of chats) {
    const item = document.createElement("div");

    item.className = "chat-item";
    item.style.padding = "10px";
    item.style.borderBottom = "1px solid #eee";
    item.style.cursor = "pointer";

    item.innerHTML = `
      <div style="font-weight:600;">
        ${escapeHtml(chat.title || `Chat ${chat.id}`)}
      </div>
    `;

    item.onclick = () => {
      loadMessages(currentUserId, chat.id, chat.title);
    };

    list.appendChild(item);
  }
}

function normalizeMessages(messages) {
  return (messages || []).slice().sort((a, b) => {
    if ((a.date || 0) !== (b.date || 0)) {
      return (a.date || 0) - (b.date || 0);
    }
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

function compareMessage(a, b) {
  const dateA = Number(a.date || 0);
  const dateB = Number(b.date || 0);

  if (dateA !== dateB) return dateA - dateB;

  const idA = BigInt(String(a.id || 0));
  const idB = BigInt(String(b.id || 0));

  if (idA < idB) return -1;
  if (idA > idB) return 1;
  return 0;
}

function mergeMessages(chatId, incoming) {
  const key = String(chatId);
  const map = new Map();

  for (const msg of messageStore[key] || []) {
    map.set(String(msg.id), msg);
  }

  for (const msg of incoming || []) {
    map.set(String(msg.id), msg);
  }

  messageStore[key] = [...map.values()].sort(compareMessage);
  return messageStore[key];
}

async function init() {
  const userId = localStorage.getItem("user_id");

  if (!userId) {
    location.href = "login.html";
    return;
  }

  currentUserId = userId;

  await loadChats(userId);

  const box = document.getElementById("messageBox");

  // 🔥 滑到頂自動載入
  box.addEventListener("scroll", () => {
    if (box.scrollTop <= 20) {
      loadOlderMessages();
    }
  });
}

init();
