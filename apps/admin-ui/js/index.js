function goLogin() {
  window.location.replace("login.html");
}

async function init() {
  const userId = localStorage.getItem("user_id");

  if (!userId) {
    goLogin();
    return;
  }

  document.getElementById("userIdText").textContent = userId;

  try {
    const auth = await tdlibApi.getAuthState(userId);
    const state = auth.data || {};

    if (!auth.ok || state.auth_state !== "authorizationStateReady") {
      localStorage.removeItem("user_id");
      goLogin();
      return;
    }

    document.getElementById("authStateText").textContent = state.auth_state;
  } catch (err) {
    document.getElementById("authStateText").textContent = "Auth check failed";
    return;
  }

  try {
    const members = await backendApi.getMembers();
    document.getElementById("membersBox").textContent = JSON.stringify(members, null, 2);
  } catch (err) {
    document.getElementById("membersBox").textContent = `Members load failed: ${err.message}`;
  }

  try {
    const groups = await backendApi.getGroups();
    document.getElementById("groupsBox").textContent = JSON.stringify(groups, null, 2);
  } catch (err) {
    document.getElementById("groupsBox").textContent = `Groups load failed: ${err.message}`;
  }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  const userId = localStorage.getItem("user_id");

  try {
    if (userId) {
      await tdlibApi.closeSession(userId);
    }
  } catch (err) {}

  localStorage.removeItem("user_id");
  goLogin();
});

init();