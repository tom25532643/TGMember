import { getMembers, createMember } from "./api.js";

const membersTableBody = document.getElementById("members-table-body");
const membersError = document.getElementById("members-error");
const createMemberForm = document.getElementById("create-member-form");
const createMemberMessage = document.getElementById("create-member-message");
const memberNameInput = document.getElementById("member-name");
const memberUsernameInput = document.getElementById("member-username");

function renderMembers(members) {
  membersTableBody.innerHTML = "";

  for (const member of members) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${member.id}</td>
      <td>${member.name}</td>
      <td>${member.username}</td>
      <td><a href="./member-detail.html?id=${member.id}">View</a></td>
    `;
    membersTableBody.appendChild(tr);
  }
}

async function loadMembers() {
  membersError.textContent = "";
  try {
    const members = await getMembers();
    renderMembers(members);
  } catch (error) {
    membersError.textContent = `Failed to load members: ${error.message}`;
  }
}

createMemberForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  createMemberMessage.textContent = "";
  createMemberMessage.className = "";

  const payload = {
    name: memberNameInput.value.trim(),
    username: memberUsernameInput.value.trim(),
  };

  try {
    await createMember(payload);
    createMemberMessage.textContent = "Member created.";
    createMemberMessage.className = "success";
    createMemberForm.reset();
    await loadMembers();
  } catch (error) {
    createMemberMessage.textContent = `Failed to create member: ${error.message}`;
    createMemberMessage.className = "error";
  }
});

loadMembers();