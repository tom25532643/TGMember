let currentChatId = null;
let currentUserId = null;
let currentChatTitle = "";
let ws = null;
let chatsCache = [];
let selfTelegramId = null;
let messageStore = {}; // chat_id -> messages[]


function goLogin() {
  window.location.replace("login.html");
}

function goIndex() {
  window.location.replace("index.html");
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatTime(unixTs) {
  if (!unixTs) return "";
  const d = new Date(unixTs * 1000);
  return d.toLocaleString();
}

function getMessagePreview(msg) {
  if (!msg) return "";
  return msg.text || `[${msg.content_type || "message"}]`;
}

function renderChats(chats) {
  const list = document.getElementById("chatList");
  list.innerHTML = "";

  for (const chat of chats || []) {
    const item = document.createElement("div");
    item.className =
      "chat-item" + (String(chat.id) === String(currentChatId) ? " active" : "");

    const title = escapeHtml(chat.title || `Chat ${chat.id}`);
    const preview = escapeHtml(getMessagePreview(chat.last_message));
    const unread = Number(chat.unread_count || 0);

    item.innerHTML = `
      <div style="font-weight:600; margin-bottom:4px;">
        ${title}
      </div>
      <div style="font-size:12px; color:#666; display:flex; justify-content:space-between; gap:8px;">
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">
          ${preview}
        </span>
        ${unread > 0 ? `<span style="color:#1677ff; font-weight:600;">${unread}</span>` : ""}
      </div>
    `;

    item.onclick = () =>
      loadMessages(currentUserId, chat.id, chat.title || `Chat ${chat.id}`);

    list.appendChild(item);
  }
}

function renderMessages(messages) {
  const box = document.getElementById("messageBox");

  const wasNearBottom =
    box.scrollHeight - box.scrollTop - box.clientHeight < 100;

  if (!messages || messages.length === 0) {
    box.innerHTML = `<div class="empty">No messages</div>`;
    return;
  }

  const list = messages; // 統一使用 old -> new

  box.innerHTML = list
    .map((msg) => {
      const isSelf = msg.is_outgoing === true;
      const cls = isSelf ? "self" : "other";
      const text = escapeHtml(msg.text || `[${msg.content_type}]`);
      const senderLabel = isSelf ? "Me" : escapeHtml(msg.sender_id ?? "-");

      return `
        <div class="bubble ${cls}" data-message-id="${escapeHtml(msg.id)}">
          <div>${text}</div>
          <div class="meta">
            ${senderLabel} · ${escapeHtml(formatTime(msg.date))}
          </div>
        </div>
      `;
    })
    .join("");

  if (wasNearBottom) {
    box.scrollTop = box.scrollHeight;
  }
}

function appendMessage(chatId, msg) {
  if (!messageStore[chatId]) {
    messageStore[chatId] = [];
  }

  const exists = messageStore[chatId].some((m) => String(m.id) === String(msg.id));
  if (exists) return;

  messageStore[chatId].push(msg);

  if (String(chatId) === String(currentChatId)) {
    renderMessages(messageStore[chatId]);
  }
}

function updateChatPreview(message) {
  let chat = chatsCache.find((c) => String(c.id) === String(message.chat_id));

  if (!chat) {
    chat = {
      id: message.chat_id,
      title: `Chat ${message.chat_id}`,
      type: "",
      unread_count: 0,
      last_message: null,
    };
    chatsCache.push(chat);
  }

  chat.last_message = {
    id: message.id,
    date: message.date,
    content_type: message.content_type,
    text: message.text,
    is_outgoing: message.is_outgoing,
    sender_id: message.sender_id,
  };

  if (String(message.chat_id) !== String(currentChatId) && !message.is_outgoing) {
    chat.unread_count = Number(chat.unread_count || 0) + 1;
  }

  if (String(message.chat_id) === String(currentChatId)) {
    chat.unread_count = 0;
  }

  chatsCache.sort((a, b) => {
    const da = a.last_message?.date || 0;
    const db = b.last_message?.date || 0;
    return db - da;
  });

  renderChats(chatsCache);
}

async function loadChats(userId) {
  const res = await tdlibApi.getChats(userId, 30);
  chatsCache = res.data || [];
  renderChats(chatsCache);
}

async function loadMessages(userId, chatId, chatTitle = "") {
  currentChatId = chatId;
  currentChatTitle = chatTitle || `Chat ${chatId}`;

  document.getElementById("chatTitle").textContent = currentChatTitle;

  const targetChat = chatsCache.find((c) => String(c.id) === String(chatId));
  if (targetChat) {
    targetChat.unread_count = 0;
  }

  renderChats(chatsCache);

  if (ws) {
    ws.close();
    ws = null;
  }

  connectWs(userId, chatId);

  const res = await fetch(`http://127.0.0.1:8000/messages/${userId}/${chatId}`);
  const data = await res.json();

  // API 目前多半是 new -> old，這裡轉成 old -> new
  const messages = (data.data || []).slice().reverse();

  messageStore[chatId] = messages;
  renderMessages(messages);
}

function connectWs(userId, chatId) {
  ws = new WebSocket(`ws://127.0.0.1:8000/ws/${userId}/${chatId}`);

  ws.onopen = () => {
    console.log("ws connected:", userId, chatId);
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.event === "new_message") {
      const message = msg.data;
      appendMessage(message.chat_id, message);
      updateChatPreview(message);
    }
  };

  ws.onclose = () => {
    console.log("ws closed:", userId, chatId);
  };

  ws.onerror = (err) => {
    console.error("ws error:", err);
  };
}

async function sendMessage() {
  if (!currentChatId) return;

  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  if (!text) return;

  await fetch("http://127.0.0.1:8000/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: currentUserId,
      chat_id: currentChatId,
      text,
    }),
  });

  input.value = "";
  // 不再 refresh，等 WS new_message 回來 append
}

async function init() {
  const userId = localStorage.getItem("user_id");
  console.log("selfTelegramId =", selfTelegramId);

  if (!userId) {
    goLogin();
    return;
  }

  currentUserId = userId;
  document.getElementById("userIdText").textContent = userId;

  const auth = await tdlibApi.getAuthState(userId);
  if (!auth.ok || auth.data.auth_state !== "authorizationStateReady") {
    localStorage.removeItem("user_id");
    goLogin();
    return;
  }

  selfTelegramId = auth.data.me?.id;
  console.log("selfTelegramId =", selfTelegramId);

  await loadChats(userId);

  document.getElementById("sendBtn").onclick = sendMessage;
  document.getElementById("backBtn").onclick = goIndex;

  document.getElementById("logoutBtn").onclick = async () => {
    try {
      await tdlibApi.closeSession(userId);
    } catch (err) {
      console.warn(err);
    }

    localStorage.removeItem("user_id");
    if (ws) {
      ws.close();
      ws = null;
    }
    goLogin();
  };
}

init();