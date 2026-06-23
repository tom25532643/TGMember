const TDLIB_BASE = window.TGMEMBER_CONFIG.TDLIB_BASE;
const BACKEND_BASE = window.TGMEMBER_CONFIG.BACKEND_BASE;

async function httpJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(JSON.stringify(data));
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
};

window.backendApi = {
  getMembers() {
    return httpJson(`${BACKEND_BASE}/members`);
  },

  getGroups() {
    return httpJson(`${BACKEND_BASE}/groups`);
  },
};
