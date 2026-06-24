let currentUserId = "";
let isBusy = false;

const screens = ["login", "phone", "code", "password"];

function qs(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  qs(id).textContent = text;
}

function getLoginKey() {
  return qs("loginKey").value.trim();
}

function mapAuthState(payload) {
  const state = payload?.auth_state || payload?.auth_state_raw?.["@type"];

  if (payload?.is_ready || payload?.is_authorized || state === "authorizationStateReady") {
    return "home";
  }

  if (state === "authorizationStateWaitPhoneNumber") return "phone";
  if (state === "authorizationStateWaitCode") return "code";
  if (state === "authorizationStateWaitPassword") return "password";

  return "phone";
}

function setScreen(screen) {
  screens.forEach((name) => {
    qs(`${name}Panel`).hidden = name !== screen;
  });
}

function setBusy(nextBusy) {
  isBusy = nextBusy;
  document.querySelectorAll("button").forEach((button) => {
    button.disabled = nextBusy;
  });
  setText("status", nextBusy ? "Checking..." : "");
}

function showError(message) {
  setText("error", message || "Something went wrong.");
}

function clearError() {
  setText("error", "");
}

function showMember(member) {
  if (!member) {
    setText("memberSummary", "");
    return;
  }

  const username = member.username ? `@${member.username}` : "no username";
  setText("memberSummary", `${member.name || "Member"} (${username}) - user_id ${member.id}`);
}

function goHome(userId) {
  localStorage.setItem("user_id", userId);
  window.location.href = "index.html";
}

async function lookupMember(loginKey) {
  if (typeof backendApi.lookupMemberByLoginKey === "function") {
    try {
      return await backendApi.lookupMemberByLoginKey(loginKey);
    } catch (err) {
      if (err.status !== 404 && err.status !== 422) {
        throw err;
      }
    }
  }

  if (typeof backendApi.getMember === "function") {
    try {
      return await backendApi.getMember(loginKey);
    } catch (err) {
      if (err.status !== 404 && err.status !== 422) {
        throw err;
      }
    }
  }

  const members = await backendApi.getMembers();
  const normalizedKey = loginKey.toLowerCase();

  return (
    members.find((member) => String(member.username || "").toLowerCase() === normalizedKey) ||
    null
  );
}

async function applyAuthState(userId) {
  const auth = await tdlibApi.getAuthState(userId);
  const payload = auth.data || auth;
  const screen = mapAuthState(payload);

  if (screen === "home") {
    goHome(userId);
    return;
  }

  setScreen(screen);
}

async function resolveLogin() {
  if (isBusy) return;

  const loginKey = getLoginKey();

  if (!loginKey) {
    showError("Enter a login key.");
    return;
  }

  setBusy(true);
  clearError();

  try {
    const member = await lookupMember(loginKey);

    if (!member) {
      currentUserId = "";
      showMember(null);
      showError("No such account. Please contact the developer.");
      setScreen("login");
      return;
    }

    currentUserId = String(member.id);
    showMember(member);

    try {
      await applyAuthState(currentUserId);
    } catch (err) {
      if (err.status !== 404) throw err;

      await tdlibApi.startAuth(currentUserId);
      await applyAuthState(currentUserId);
    }
  } catch (err) {
    showError(err.message || "Login failed.");
  } finally {
    setBusy(false);
  }
}

async function submitPhone() {
  if (isBusy || !currentUserId) return;

  setBusy(true);
  clearError();

  try {
    await tdlibApi.submitPhone(currentUserId, qs("phone").value.trim());
    await applyAuthState(currentUserId);
  } catch (err) {
    showError(err.message || "Phone submit failed.");
    setScreen("phone");
  } finally {
    setBusy(false);
  }
}

async function submitCode() {
  if (isBusy || !currentUserId) return;

  setBusy(true);
  clearError();

  try {
    await tdlibApi.submitCode(currentUserId, qs("code").value.trim());
    await applyAuthState(currentUserId);
  } catch (err) {
    showError(err.message || "Code submit failed.");
    setScreen("code");
  } finally {
    setBusy(false);
  }
}

async function submitPassword() {
  if (isBusy || !currentUserId) return;

  setBusy(true);
  clearError();

  try {
    await tdlibApi.submitPassword(currentUserId, qs("password").value);
    await applyAuthState(currentUserId);
  } catch (err) {
    showError(err.message || "Password submit failed.");
    setScreen("password");
  } finally {
    setBusy(false);
  }
}

function backToLogin() {
  setScreen("login");
}

qs("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  resolveLogin();
});

qs("phoneForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitPhone();
});

qs("codeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitCode();
});

qs("passwordForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitPassword();
});

document.querySelectorAll("[data-back-login]").forEach((button) => {
  button.addEventListener("click", backToLogin);
});

setScreen("login");
