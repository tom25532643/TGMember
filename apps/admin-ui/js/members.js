const membersTableBody = document.getElementById("members-table-body");
const membersError = document.getElementById("members-error");
const createMemberForm = document.getElementById("create-member-form");
const createMemberMessage = document.getElementById("create-member-message");
const memberNameInput = document.getElementById("member-name");
const memberUsernameInput = document.getElementById("member-username");
const generateMemberKeyBtn = document.getElementById("generate-member-key");

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

function renderMembers(members) {
  membersTableBody.innerHTML = "";

  for (const member of members) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${member.id}</td>
      <td>${escapeHtml(member.name)}</td>
      <td>
        <form class="login-key-form" data-member-id="${member.id}">
          <input name="loginKey" type="text" value="${escapeHtml(member.username)}" required />
          <button type="submit">更新</button>
        </form>
      </td>
      <td><a href="./member-detail.html?id=${member.id}">檢視</a></td>
    `;
    membersTableBody.appendChild(tr);
  }
}

async function loadMembers() {
  membersError.textContent = "";
  try {
    const members = await backendApi.getMembers();
    renderMembers(members);
  } catch (error) {
    membersError.textContent = `成員載入失敗：${error.message}`;
  }
}

generateMemberKeyBtn.addEventListener("click", () => {
  memberUsernameInput.value = generateLoginKey();
});

createMemberForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(createMemberMessage, "");

  let loginKey = memberUsernameInput.value.trim();

  if (!loginKey) {
    loginKey = generateLoginKey();
    memberUsernameInput.value = loginKey;
  }

  const payload = {
    name: memberNameInput.value.trim(),
    username: loginKey,
  };

  try {
    await backendApi.createMember(payload);
    setMessage(createMemberMessage, "成員已建立，請把這組登入金鑰提供給使用者。", "success");
    createMemberForm.reset();
    await loadMembers();
  } catch (error) {
    setMessage(createMemberMessage, `建立成員失敗：${error.message}`, "error");
  }
});

membersTableBody.addEventListener("submit", async (event) => {
  const form = event.target.closest(".login-key-form");
  if (!form) return;

  event.preventDefault();
  membersError.textContent = "";

  const memberId = form.dataset.memberId;
  const loginKey = form.elements.loginKey.value.trim();

  try {
    await backendApi.updateMemberLoginKey(memberId, loginKey);
    membersError.className = "success";
    membersError.textContent = "登入金鑰已更新。";
    await loadMembers();
  } catch (error) {
    membersError.className = "error";
    membersError.textContent = `更新登入金鑰失敗：${error.message}`;
  }
});

loadMembers();
