const params = new URLSearchParams(window.location.search);
const memberId = params.get("id");

const memberBasic = document.getElementById("member-basic");
const memberError = document.getElementById("member-error");
const loginKeyForm = document.getElementById("login-key-form");
const loginKeyInput = document.getElementById("login-key-input");
const loginKeyMessage = document.getElementById("login-key-message");
const generateLoginKeyBtn = document.getElementById("generate-login-key");

let currentMember = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function randomIndex(max) {
  const cryptoApi = globalThis.crypto || globalThis.msCrypto;

  if (cryptoApi?.getRandomValues) {
    const values = new Uint32Array(1);
    cryptoApi.getRandomValues(values);
    return values[0] % max;
  }

  return Math.floor(Math.random() * max);
}

function generateLoginKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let body = "";

  for (let i = 0; i < 12; i += 1) {
    body += alphabet[randomIndex(alphabet.length)];
  }

  return `TG-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

function setMessage(element, message, className = "") {
  element.textContent = message;
  element.className = className;
}

function renderMember(member) {
  memberBasic.innerHTML = `
    <p><strong>ID:</strong> ${member.id}</p>
    <p><strong>名稱：</strong> ${escapeHtml(member.name)}</p>
    <p><strong>登入金鑰：</strong> ${escapeHtml(member.username)}</p>
  `;
  loginKeyInput.value = member.username || "";
}

async function loadMember() {
  if (!memberId) {
    memberError.textContent = "缺少成員 ID。";
    return;
  }

  memberError.textContent = "";

  try {
    currentMember = await backendApi.getMember(memberId);
    renderMember(currentMember);
  } catch (error) {
    memberError.textContent = `成員載入失敗：${error.message}`;
  }
}

generateLoginKeyBtn.addEventListener("click", () => {
  loginKeyInput.value = generateLoginKey();
});

loginKeyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(loginKeyMessage, "");

  const loginKey = loginKeyInput.value.trim();

  try {
    currentMember = await backendApi.updateMemberLoginKey(memberId, loginKey);
    renderMember(currentMember);
    setMessage(loginKeyMessage, "登入金鑰已更新。", "success");
  } catch (error) {
    setMessage(loginKeyMessage, `更新登入金鑰失敗：${error.message}`, "error");
  }
});

loadMember();
