const FOREVER_DATE = "2099-12-31";

const state = {
  groups: [],
  selectedGroup: null,
  members: [],
  records: new Map(),
  page: 1,
};

const userIdInput = document.getElementById("userIdInput");
const maxPagesInput = document.getElementById("maxPagesInput");
const loadGroupsBtn = document.getElementById("loadGroupsBtn");
const refreshMembersBtn = document.getElementById("refreshMembersBtn");
const groupList = document.getElementById("groupList");
const messageBox = document.getElementById("messageBox");
const memberTitle = document.getElementById("memberTitle");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const summary = document.getElementById("summary");
const tableWrap = document.getElementById("tableWrap");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageText = document.getElementById("pageText");

document.getElementById("backBtn").addEventListener("click", () => {
  window.location.href = "index.html";
});

loadGroupsBtn.addEventListener("click", loadGroups);
refreshMembersBtn.addEventListener("click", loadSelectedGroupMembers);
searchInput.addEventListener("input", () => {
  state.page = 1;
  renderMembers();
});
statusFilter.addEventListener("change", () => {
  state.page = 1;
  renderMembers();
});
pageSizeSelect.addEventListener("change", () => {
  state.page = 1;
  renderMembers();
});
prevPageBtn.addEventListener("click", () => {
  state.page = Math.max(1, state.page - 1);
  renderMembers();
});
nextPageBtn.addEventListener("click", () => {
  state.page += 1;
  renderMembers();
});

function init() {
  const userId = localStorage.getItem("user_id");
  if (userId) userIdInput.value = userId;
}

function setMessage(text, type = "info") {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`;
}

function clearMessage() {
  messageBox.textContent = "";
  messageBox.className = "message";
}

function getUserId() {
  return userIdInput.value.trim();
}

function todayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dateOnly(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addMonths(months) {
  const date = new Date();
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() !== day) date.setDate(0);
  return date.toISOString().slice(0, 10);
}

function getStatus(record) {
  const expiration = record?.expiration_date;
  if (!expiration) return "unset";
  if (expiration === FOREVER_DATE) return "forever";
  return dateOnly(expiration) < todayDateOnly() ? "expired" : "active";
}

function statusText(status) {
  return {
    all: "全部",
    unset: "未設定",
    active: "有效",
    expired: "已過期",
    forever: "永久",
  }[status] || status;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderGroups() {
  if (!state.groups.length) {
    groupList.innerHTML = '<div class="empty">沒有可管理的 supergroup 或頻道。</div>';
    return;
  }

  groupList.innerHTML = state.groups.map((group) => {
    const active = state.selectedGroup?.chat_id === group.chat_id ? " active" : "";
    const type = group.is_channel ? "頻道" : "群組";
    return `
      <div class="group-item${active}" data-chat-id="${escapeHtml(group.chat_id)}">
        <div class="group-title">${escapeHtml(group.title || group.chat_id)}</div>
        <div class="meta">${type} · ${escapeHtml(group.my_status || "admin")}</div>
        <div class="meta">${escapeHtml(group.chat_id)}</div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".group-item").forEach((item) => {
    item.addEventListener("click", async () => {
      const chatId = Number(item.dataset.chatId);
      state.selectedGroup = state.groups.find((group) => group.chat_id === chatId);
      state.page = 1;
      renderGroups();
      await loadSelectedGroupMembers();
    });
  });
}

function matchesStatusFilter(status, filter) {
  if (filter === "all") return true;
  if (filter === "active") return status === "active" || status === "forever";
  return status === filter;
}

function filteredMembers() {
  const query = searchInput.value.trim().toLowerCase();
  const filter = statusFilter.value;

  return state.members.filter((member) => {
    const record = state.records.get(String(member.user_id));
    const status = getStatus(record);
    const haystack = [member.display_name, member.username, member.user_id]
      .join(" ")
      .toLowerCase();

    return (!query || haystack.includes(query)) && matchesStatusFilter(status, filter);
  });
}

function renderMembers() {
  if (!state.selectedGroup) {
    tableWrap.innerHTML = '<div class="empty">請先選擇群組</div>';
    summary.textContent = "請先選擇群組";
    pageText.textContent = "第 1 / 1 頁";
    return;
  }

  const members = filteredMembers();
  const pageSize = Number(pageSizeSelect.value);
  const totalPages = Math.max(1, Math.ceil(members.length / pageSize));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * pageSize;
  const pageMembers = members.slice(start, start + pageSize);

  memberTitle.textContent = `成員 - ${state.selectedGroup.title || state.selectedGroup.chat_id}`;
  summary.textContent = `共 ${state.members.length} 位成員，篩選後 ${members.length} 位。加入時間目前無法取得。`;
  pageText.textContent = `第 ${state.page} / ${totalPages} 頁`;
  prevPageBtn.disabled = state.page <= 1;
  nextPageBtn.disabled = state.page >= totalPages;

  if (!pageMembers.length) {
    tableWrap.innerHTML = '<div class="empty">沒有符合篩選條件的成員。</div>';
    return;
  }

  tableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>成員</th>
          <th>User ID</th>
          <th>加入時間</th>
          <th>到期日</th>
          <th>狀態</th>
          <th>設定</th>
        </tr>
      </thead>
      <tbody>
        ${pageMembers.map(renderMemberRow).join("")}
      </tbody>
    </table>
  `;

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      await updateExpiration(button.dataset.userId, button.dataset.action);
    });
  });
}

function renderMemberRow(member) {
  const record = state.records.get(String(member.user_id));
  const status = getStatus(record);
  const username = member.username ? `@${member.username}` : "沒有 username";
  const expiration = record?.expiration_date || "未設定";

  return `
    <tr>
      <td>
        <div class="member-name">${escapeHtml(member.display_name || member.user_id)}</div>
        <div class="muted">${escapeHtml(username)}</div>
      </td>
      <td>${escapeHtml(member.user_id)}</td>
      <td>未知</td>
      <td>${escapeHtml(expiration)}</td>
      <td><span class="status ${status}">${statusText(status)}</span></td>
      <td>
        <div class="actions">
          <button class="secondary" data-user-id="${escapeHtml(member.user_id)}" data-action="one-month">1 個月</button>
          <button class="secondary" data-user-id="${escapeHtml(member.user_id)}" data-action="three-months">3 個月</button>
          <button class="secondary" data-user-id="${escapeHtml(member.user_id)}" data-action="forever">永久</button>
          <button class="danger" data-user-id="${escapeHtml(member.user_id)}" data-action="clear">清除</button>
        </div>
      </td>
    </tr>
  `;
}

async function loadGroups() {
  const userId = getUserId();
  if (!userId) {
    setMessage("請輸入 TDLib 使用者 ID。", "error");
    return;
  }

  clearMessage();
  loadGroupsBtn.disabled = true;

  try {
    const result = await window.tdlibApi.getAdminSupergroups(userId);
    state.groups = result.data || [];
    state.selectedGroup = null;
    state.members = [];
    state.records = new Map();
    refreshMembersBtn.disabled = true;
    renderGroups();
    renderMembers();
    setMessage(`已載入 ${state.groups.length} 個可管理群組。`);
  } catch (error) {
    setMessage(`載入群組失敗：${error.message}`, "error");
  } finally {
    loadGroupsBtn.disabled = false;
  }
}

async function loadSelectedGroupMembers() {
  const userId = getUserId();
  const group = state.selectedGroup;
  if (!userId || !group) return;

  clearMessage();
  refreshMembersBtn.disabled = true;

  try {
    const maxPages = Number(maxPagesInput.value || 10);
    const result = await window.tdlibApi.getAllSupergroupMembers(userId, group.chat_id, maxPages);
    const members = result.data?.members || [];
    state.members = members;

    const syncItems = members.map((member) => ({
      telegram_user_id: Number(member.user_id),
      display_name: member.display_name || null,
      username: member.username || null,
    }));
    const records = await window.backendApi.syncTelegramMemberExpirations(userId, group.chat_id, syncItems);
    state.records = new Map(records.map((record) => [String(record.telegram_user_id), record]));
    state.page = 1;
    refreshMembersBtn.disabled = false;
    renderMembers();
    setMessage(`已同步 ${members.length} 位成員。`);
  } catch (error) {
    setMessage(`同步成員失敗：${error.message}`, "error");
  } finally {
    refreshMembersBtn.disabled = !state.selectedGroup;
  }
}

async function updateExpiration(userId, action) {
  const ownerUserId = getUserId();
  const group = state.selectedGroup;
  if (!ownerUserId || !group) return;

  const expirationDate = {
    "one-month": addMonths(1),
    "three-months": addMonths(3),
    forever: FOREVER_DATE,
    clear: null,
  }[action];

  try {
    const record = await window.backendApi.updateTelegramMemberExpiration(
      ownerUserId,
      group.chat_id,
      userId,
      expirationDate,
    );
    state.records.set(String(record.telegram_user_id), record);
    renderMembers();
    setMessage("效期已更新。");
  } catch (error) {
    setMessage(`更新效期失敗：${error.message}`, "error");
  }
}

init();
