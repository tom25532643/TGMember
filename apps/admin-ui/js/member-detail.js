import {
  getMember,
  getMemberTags,
  addMemberTag,
  getMemberNotes,
  addMemberNote,
  getMemberMessageLogs,
  createMemberMessageLog,
  sendMessageToMember,
} from "./api.js";

const params = new URLSearchParams(window.location.search);
const memberId = params.get("id");

const memberBasic = document.getElementById("member-basic");
const memberError = document.getElementById("member-error");

const tagsList = document.getElementById("tags-list");
const tagForm = document.getElementById("tag-form");
const tagInput = document.getElementById("tag-input");
const tagMessage = document.getElementById("tag-message");

const notesList = document.getElementById("notes-list");
const noteForm = document.getElementById("note-form");
const noteInput = document.getElementById("note-input");
const noteMessage = document.getElementById("note-message");

const logsList = document.getElementById("logs-list");
const logForm = document.getElementById("log-form");
const logDirection = document.getElementById("log-direction");
const logContent = document.getElementById("log-content");
const logStatus = document.getElementById("log-status");
const logMessage = document.getElementById("log-message");

const sendMessageForm = document.getElementById("send-message-form");
const sendMessageInput = document.getElementById("send-message-input");
const sendMessageResult = document.getElementById("send-message-result");

function renderList(container, items, emptyText) {
  container.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = emptyText;
    container.appendChild(li);
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    container.appendChild(li);
  }
}

function renderLogs(logs) {
  logsList.innerHTML = "";

  if (!logs.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "No message logs";
    logsList.appendChild(li);
    return;
  }

  for (const log of logs) {
    const li = document.createElement("li");
    li.textContent = `[${log.direction}] ${log.content} (${log.status})`;
    logsList.appendChild(li);
  }
}

async function loadMember() {
  if (!memberId) {
    memberError.textContent = "Missing member id.";
    return;
  }

  memberError.textContent = "";

  try {
    const member = await getMember(memberId);
    memberBasic.innerHTML = `
      <p><strong>ID:</strong> ${member.id}</p>
      <p><strong>Name:</strong> ${member.name}</p>
      <p><strong>Username:</strong> ${member.username}</p>
    `;
  } catch (error) {
    memberError.textContent = `Failed to load member: ${error.message}`;
  }
}

async function loadTags() {
  try {
    const tags = await getMemberTags(memberId);
    renderList(tagsList, tags, "No tags");
  } catch (error) {
    tagMessage.textContent = `Failed to load tags: ${error.message}`;
    tagMessage.className = "error";
  }
}

async function loadNotes() {
  try {
    const notes = await getMemberNotes(memberId);
    renderList(notesList, notes, "No notes");
  } catch (error) {
    noteMessage.textContent = `Failed to load notes: ${error.message}`;
    noteMessage.className = "error";
  }
}

async function loadLogs() {
  try {
    const logs = await getMemberMessageLogs(memberId);
    renderLogs(logs);
  } catch (error) {
    logMessage.textContent = `Failed to load logs: ${error.message}`;
    logMessage.className = "error";
  }
}

tagForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  tagMessage.textContent = "";
  tagMessage.className = "";

  try {
    await addMemberTag(memberId, { tag: tagInput.value.trim() });
    tagForm.reset();
    tagMessage.textContent = "Tag added.";
    tagMessage.className = "success";
    await loadTags();
  } catch (error) {
    tagMessage.textContent = `Failed to add tag: ${error.message}`;
    tagMessage.className = "error";
  }
});

noteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  noteMessage.textContent = "";
  noteMessage.className = "";

  try {
    await addMemberNote(memberId, { note: noteInput.value.trim() });
    noteForm.reset();
    noteMessage.textContent = "Note added.";
    noteMessage.className = "success";
    await loadNotes();
  } catch (error) {
    noteMessage.textContent = `Failed to add note: ${error.message}`;
    noteMessage.className = "error";
  }
});

logForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  logMessage.textContent = "";
  logMessage.className = "";

  try {
    await createMemberMessageLog(memberId, {
      direction: logDirection.value,
      content: logContent.value.trim(),
      status: logStatus.value,
    });
    logForm.reset();
    logMessage.textContent = "Message log added.";
    logMessage.className = "success";
    await loadLogs();
  } catch (error) {
    logMessage.textContent = `Failed to add message log: ${error.message}`;
    logMessage.className = "error";
  }
});

sendMessageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  sendMessageResult.textContent = "";
  sendMessageResult.className = "";

  try {
    const result = await sendMessageToMember(memberId, {
      content: sendMessageInput.value.trim(),
    });

    sendMessageForm.reset();
    sendMessageResult.textContent = `Message sent: ${result.result}`;
    sendMessageResult.className = "success";

    await loadLogs();
  } catch (error) {
    sendMessageResult.textContent = `Failed to send message: ${error.message}`;
    sendMessageResult.className = "error";

    await loadLogs();
  }
});

async function init() {
  await loadMember();
  await loadTags();
  await loadNotes();
  await loadLogs();
}

init();