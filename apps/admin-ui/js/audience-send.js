const API_BASE = 'http://127.0.0.1:8000';
console.log("groups.js loaded");
const state = {
  sources: [],
  selectedSource: null,
  memberPreview: null,
};

const userIdInput = document.getElementById('userId');
const chatIdInput = document.getElementById('chatId');
const maxPagesInput = document.getElementById('maxPages');
const messageTextInput = document.getElementById('messageText');

const sourceListEl = document.getElementById('sourceList');
const memberListEl = document.getElementById('memberList');
const memberInfoBoxEl = document.getElementById('memberInfoBox');

const statTotalEl = document.getElementById('stat-total');
const statPagesEl = document.getElementById('stat-pages');
const statSourceTypeEl = document.getElementById('stat-source-type');

const errorMessageEl = document.getElementById('error-message');
const pageMessageEl = document.getElementById('page-message');

document.getElementById('loadSourcesBtn').addEventListener('click', loadSources);
document.getElementById('loadMembersBtn').addEventListener('click', loadMembers);
document.getElementById('sendMembersBtn').addEventListener('click', sendToMembers);

window.goIndex = function () {
  window.location.replace('index.html');
};

function showError(msg) {
  errorMessageEl.innerHTML = `<div class="error">${msg}</div>`;
}

function clearError() {
  errorMessageEl.innerHTML = '';
}

function showMessage(msg) {
  pageMessageEl.innerHTML = `<div class="info">${msg}</div>`;
}

function renderSources() {
  if (!state.sources.length) {
    sourceListEl.innerHTML = '沒有來源';
    return;
  }

  sourceListEl.innerHTML = state.sources.map(s => `
    <div class="source-item" data-id="${s.chat_id}">
      <div><b>${s.title}</b></div>
      <div>${s.is_channel ? 'Channel' : 'Group'}</div>
    </div>
  `).join('');

  document.querySelectorAll('.source-item').forEach(el => {
    el.onclick = () => {
      const id = Number(el.dataset.id);
      state.selectedSource = state.sources.find(s => s.chat_id === id);
      chatIdInput.value = id;
    };
  });
}

function renderMembers() {
  const data = state.memberPreview;
  if (!data) return;

  statTotalEl.textContent = data.total;
  statPagesEl.textContent = data.pages_fetched;
  statSourceTypeEl.textContent = data.is_channel ? 'Channel' : 'Group';

  memberInfoBoxEl.innerHTML = `
    來源: ${data.title}<br>
    Members: ${data.total}
  `;

  const members = data.members || [];

  memberListEl.innerHTML = members.map(m => `
    <div class="member-item">
      <div>User ${m.user_id}</div>
      <div>${m.status}</div>
    </div>
  `).join('');
}

async function loadSources() {
  clearError();

  const userId = userIdInput.value;
  if (!userId) return showError('請輸入 user_id');

  const res = await fetch(`${API_BASE}/supergroups/${userId}`);
  const data = await res.json();

  state.sources = data.data || [];
  renderSources();
}

async function loadMembers() {
  clearError();

  const userId = userIdInput.value;
  const chatId = chatIdInput.value;
  const maxPages = maxPagesInput.value;

  if (!userId || !chatId) return showError('缺少參數');

  const res = await fetch(
    `${API_BASE}/supergroups/${userId}/${chatId}/members/all?max_pages=${maxPages}`
  );

  const data = await res.json();

  state.memberPreview = data.data;
  renderMembers();
}

async function sendToMembers() {
  clearError();

  const userId = userIdInput.value;
  const chatId = chatIdInput.value;
  const text = messageTextInput.value;

  if (!text) return showError('請輸入訊息');

  const res = await fetch(
    `${API_BASE}/supergroups/${userId}/${chatId}/send`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }
  );

  if (res.status === 404) {
    showMessage('send API 還沒實作');
    return;
  }

  const data = await res.json();
  showMessage('發送完成');
}