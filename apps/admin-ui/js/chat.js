let currentChatId = null;
let currentUserId = null;
let currentChatTitle = "";
let ws = null;
let chatsCache = [];
let messageStore = {};

let loadingMessages = false;
let loadingOlder = false;
let loadingChats = false;
let sendingMessage = false;
let hasMore = true;
let oldestMessageId = null;
let chatLimit = 50;
const CHAT_LIMIT_STEP = 50;
const CHAT_LIMIT_MAX = 2000;
const MESSAGE_PAGE_SIZE = 50;
const AUTO_FILL_OLDER_MAX_PAGES = 5;

const API_BASE = window.TGMEMBER_CONFIG.TDLIB_BASE;
const WS_BASE = window.TGMEMBER_CONFIG.TDLIB_WS_BASE;

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

function updateChatCountText() {
  const text = document.getElementById("chatCountText");
  if (!text) return;

  text.textContent = `已載入 ${chatsCache.length} 個聊天室 / 上限 ${chatLimit}`;
}

function setLoadMoreChatsLoading(isLoading) {
  const btn = document.getElementById("loadMoreChatsBtn");
  if (!btn) return;

  btn.disabled = isLoading || chatLimit >= CHAT_LIMIT_MAX;
  btn.textContent = isLoading
    ? "載入中..."
    : chatLimit >= CHAT_LIMIT_MAX
      ? "已載入最大數量"
      : "載入更多聊天室";
}

function setSendLoading(isLoading) {
  const btn = document.getElementById("sendBtn");
  const input = document.getElementById("messageInput");

  if (btn) {
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "發送中..." : "送出";
  }

  if (input) {
    input.disabled = isLoading;
  }
}

function extractTextFromTdMessage(rawMessage, fallbackText = "") {
  const content = rawMessage?.content || {};
  const textObj = content.text || {};

  return (
    textObj.text ||
    rawMessage?.text ||
    fallbackText ||
    `[${content["@type"] || "message"}]`
  );
}

function normalizeSentMessage(rawMessage, fallbackText) {
  const contentType = rawMessage?.content?.["@type"] || "messageText";

  return {
    id: String(rawMessage?.id || `tmp-${Date.now()}`),
    chat_id: String(rawMessage?.chat_id || currentChatId),
    date: rawMessage?.date || Math.floor(Date.now() / 1000),
    sender_id: rawMessage?.sender_id || "me",
    is_outgoing: true,
    content_type: contentType,
    text: extractTextFromTdMessage(rawMessage, fallbackText),
  };
}

function createMessageElement(msg) {
  console.log("render msg json:", JSON.stringify(msg, null, 2));
  const isSelf = msg.is_outgoing === true;
  const cls = isSelf ? "self" : "other";

  const div = document.createElement("div");
  div.className = `bubble ${cls}`;
  div.dataset.messageId = msg.id;

  let contentHtml = "";

  if (msg.media?.type === "photo") {
    contentHtml += `
    <img 
      class="chat-photo"
      src="${API_BASE}/files/${currentUserId}/${msg.media.file_id}"
      loading="lazy"
    />
  `;

    if (msg.text) {
      contentHtml += `<div>${escapeHtml(msg.text)}</div>`;
    }
  } else if (msg.media?.type === "video") {
    contentHtml += `
    <video 
      class="chat-video"
      src="${API_BASE}/files/${currentUserId}/${msg.media.file_id}"
      controls
      preload="metadata"
    ></video>
  `;

    if (msg.text) {
      contentHtml += `<div>${escapeHtml(msg.text)}</div>`;
    }
  } else {
    contentHtml += `<div>${escapeHtml(msg.text || `[${msg.content_type}]`)}</div>`;
  }

  div.innerHTML = `
    ${contentHtml}
    <div class="meta">
      ${isSelf ? "我" : msg.sender_id} 繚 ${formatTime(msg.date)}
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

async function autoFillOlderMessages() {
  const box = document.getElementById("messageBox");
  if (!box) return;

  let pagesLoaded = 0;

  while (
    hasMore &&
    pagesLoaded < AUTO_FILL_OLDER_MAX_PAGES &&
    box.scrollHeight <= box.clientHeight + 20
  ) {
    const loaded = await loadOlder(true);
    if (!loaded) break;

    pagesLoaded++;
    box.scrollTop = box.scrollHeight;
    await sleep(100);
  }
}

async function loadMessages(userId, chatId, chatTitle = "") {
  const key = String(chatId);

  if (loadingMessages) return;

  loadingMessages = true;
  hasMore = true;

  currentChatId = chatId;
  currentChatTitle = chatTitle || `聊天室 ${chatId}`;

  document.getElementById("chatTitle").textContent = currentChatTitle;

  const box = document.getElementById("messageBox");
  box.innerHTML = `<div class="empty">載入中...</div>`;

  renderChats(chatsCache);

  if (ws) {
    ws.close();
    ws = null;
  }

  try {
    const rawMessages = await fetchMessagesWithRetry(
      userId,
      chatId,
      MESSAGE_PAGE_SIZE,
    );

    messageStore[key] = [];
    const messages = mergeMessages(chatId, rawMessages);

    hasMore = rawMessages.length === MESSAGE_PAGE_SIZE;

    renderInitial(messages);
    await autoFillOlderMessages();

    connectWs(userId, chatId);
  } catch (err) {
    console.error("loadMessages error:", err);
    box.innerHTML = `<div class="empty">訊息載入失敗</div>`;
  } finally {
    loadingMessages = false;
  }
}

async function loadOlder(force = false) {
  if (loadingOlder || (!force && loadingMessages) || !hasMore) return false;

  const key = String(currentChatId);
  const current = messageStore[key] || [];

  if (current.length === 0) return false;

  loadingOlder = true;

  const box = document.getElementById("messageBox");
  const oldHeight = box.scrollHeight;
  const oldest = current[0];

  try {
    console.log("loadOlder triggered, from:", oldest.id);

    const res = await fetch(
      `${API_BASE}/messages/${currentUserId}/${currentChatId}?limit=${MESSAGE_PAGE_SIZE}&from_message_id=${oldest.id}`,
    );

    const data = await res.json();
    const rawOlder = data.data || [];

    if (rawOlder.length === 0) {
      hasMore = false;
      return false;
    }

    const beforeLength = current.length;
    const merged = mergeMessages(currentChatId, rawOlder);

    if (merged.length === beforeLength) {
      hasMore = false;
      return false;
    }

    renderInitial(merged);

    const newHeight = box.scrollHeight;
    box.scrollTop = newHeight - oldHeight;

    hasMore = rawOlder.length === MESSAGE_PAGE_SIZE;
    return true;
  } catch (err) {
    console.error("loadOlder error:", err);
    return false;
  } finally {
    loadingOlder = false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMessagesWithRetry(
  userId,
  chatId,
  limit = MESSAGE_PAGE_SIZE,
) {
  let lastData = [];

  for (let i = 0; i < 3; i++) {
    const res = await fetch(
      `${API_BASE}/messages/${userId}/${chatId}?limit=${limit}`,
    );

    const data = await res.json();
    const messages = data.data || [];

    console.log("initial messages count:", messages.length, "try:", i + 1);

    lastData = messages;

    if (messages.length > 1) {
      return messages;
    }

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

async function sendCurrentMessage() {
  if (sendingMessage) return;

  if (!currentUserId || !currentChatId) {
    alert("請先選擇聊天室。");
    return;
  }

  const input = document.getElementById("messageInput");
  const text = input?.value?.trim() || "";

  if (!text) return;

  sendingMessage = true;
  setSendLoading(true);

  try {
    const res = await fetch(`${API_BASE}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: currentUserId,
        chat_id: Number(currentChatId),
        text,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.ok === false) {
      const detail = data.detail || data.error || data;
      throw new Error(
        typeof detail === "string" ? detail : JSON.stringify(detail),
      );
    }

    if (input) {
      input.value = "";
      input.focus();
    }

    const sentMessage = normalizeSentMessage(data.data || {}, text);
    appendMessage(sentMessage);
  } catch (err) {
    console.error("sendCurrentMessage error:", err);
    alert(`發送失敗：${err.message || err}`);
  } finally {
    sendingMessage = false;
    setSendLoading(false);
  }
}

async function loadChats(userId, limit = chatLimit) {
  if (loadingChats) return;

  loadingChats = true;
  setLoadMoreChatsLoading(true);

  try {
    const res = await fetch(`${API_BASE}/chats/${userId}?limit=${limit}`);
    const data = await res.json();

    chatsCache = data.data || [];
    renderChats(chatsCache);
    updateChatCountText();
  } catch (err) {
    console.error("loadChats error:", err);
  } finally {
    loadingChats = false;
    setLoadMoreChatsLoading(false);
  }
}

async function loadMoreChats() {
  if (!currentUserId || loadingChats) return;

  chatLimit = Math.min(chatLimit + CHAT_LIMIT_STEP, CHAT_LIMIT_MAX);
  await loadChats(currentUserId, chatLimit);
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
    const unreadCount = Number(chat.unread_count || 0);
    const hasUnread = unreadCount > 0;

    item.className = "chat-item";
    if (String(currentChatId) === String(chat.id)) {
      item.classList.add("active");
    }
    item.style.padding = "10px";
    item.style.borderBottom = "1px solid #eee";
    item.style.cursor = "pointer";

    item.innerHTML = `
      <div class="chat-row" title="${escapeHtml(chat.title || `聊天室 ${chat.id}`)}">
        <span class="unread-dot${hasUnread ? "" : " hidden"}"></span>
        <div class="chat-title-text">
          ${escapeHtml(chat.title || `聊天室 ${chat.id}`)}
        </div>
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

  const userIdText = document.getElementById("userIdText");
  if (userIdText) {
    userIdText.textContent = userId;
  }

  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  const loadMoreChatsBtn = document.getElementById("loadMoreChatsBtn");
  if (loadMoreChatsBtn) {
    loadMoreChatsBtn.addEventListener("click", loadMoreChats);
  }

  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) {
    sendBtn.addEventListener("click", sendCurrentMessage);
  }

  const messageInput = document.getElementById("messageInput");
  if (messageInput) {
    messageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendCurrentMessage();
      }
    });
  }

  await loadChats(userId);

  const box = document.getElementById("messageBox");

  box.addEventListener("scroll", () => {
    if (box.scrollTop <= 20) {
      loadOlder();
    }
  });
}

init();
