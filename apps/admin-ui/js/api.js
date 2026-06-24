const TDLIB_BASE = window.TGMEMBER_CONFIG.TDLIB_BASE;
const BACKEND_BASE = window.TGMEMBER_CONFIG.BACKEND_BASE;

async function httpJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  let data = null;

  try {
    data = await res.json();
  } catch (err) {}

  if (!res.ok) {
    const error = new Error(
      data?.detail?.message || data?.detail || data?.message || `HTTP ${res.status}`,
    );
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

window.tdlibApi = {
  startAuth(userId) {
    return httpJson(`${TDLIB_BASE}/auth/start`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  },

  submitPhone(userId, phoneNumber) {
    return httpJson(`${TDLIB_BASE}/auth/phone`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, phone_number: phoneNumber }),
    });
  },

  submitCode(userId, code) {
    return httpJson(`${TDLIB_BASE}/auth/code`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, code }),
    });
  },

  submitPassword(userId, password) {
    return httpJson(`${TDLIB_BASE}/auth/password`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, password }),
    });
  },

  getAuthState(userId) {
    return httpJson(`${TDLIB_BASE}/auth/state/${encodeURIComponent(userId)}`);
  },

  closeSession(userId) {
    return httpJson(`${TDLIB_BASE}/auth/close/${encodeURIComponent(userId)}`, {
      method: "POST",
    });
  },

  getChats(userId, limit = 20) {
    return httpJson(
      `${TDLIB_BASE}/chats/${encodeURIComponent(userId)}?limit=${limit}`,
    );
  },

  getAdminSupergroups(userId) {
    return httpJson(`${TDLIB_BASE}/supergroups/${encodeURIComponent(userId)}/admin`);
  },

  getAllSupergroupMembers(userId, chatId, maxPages = 10) {
    return httpJson(
      `${TDLIB_BASE}/supergroups/${encodeURIComponent(userId)}/${encodeURIComponent(chatId)}/members/all?max_pages=${maxPages}`,
    );
  },
};

window.backendApi = {
  getMember(memberId) {
    return httpJson(`${BACKEND_BASE}/members/${encodeURIComponent(memberId)}`);
  },

  lookupMemberByLoginKey(loginKey) {
    return httpJson(`${BACKEND_BASE}/members/login-key/${encodeURIComponent(loginKey)}`);
  },

  getMembers() {
    return httpJson(`${BACKEND_BASE}/members`);
  },

  createMember(payload) {
    return httpJson(`${BACKEND_BASE}/members`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateMemberLoginKey(memberId, loginKey) {
    return httpJson(`${BACKEND_BASE}/members/${encodeURIComponent(memberId)}/login-key`, {
      method: "PUT",
      body: JSON.stringify({ login_key: loginKey }),
    });
  },

  getGroups() {
    return httpJson(`${BACKEND_BASE}/groups`);
  },

  getTelegramMemberExpirations(ownerUserId, chatId) {
    return httpJson(
      `${BACKEND_BASE}/telegram-member-expirations/${encodeURIComponent(ownerUserId)}/${encodeURIComponent(chatId)}`,
    );
  },

  syncTelegramMemberExpirations(ownerUserId, chatId, members) {
    return httpJson(`${BACKEND_BASE}/telegram-member-expirations/sync`, {
      method: "POST",
      body: JSON.stringify({
        owner_user_id: ownerUserId,
        chat_id: Number(chatId),
        members,
      }),
    });
  },

  updateTelegramMemberExpiration(ownerUserId, chatId, telegramUserId, expirationDate) {
    return httpJson(
      `${BACKEND_BASE}/telegram-member-expirations/${encodeURIComponent(ownerUserId)}/${encodeURIComponent(chatId)}/${encodeURIComponent(telegramUserId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ expiration_date: expirationDate }),
      },
    );
  },
};
