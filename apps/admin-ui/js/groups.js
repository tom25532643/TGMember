import { getGroups, createGroup } from "./api.js";

const groupsTableBody = document.getElementById("groups-table-body");
const groupsError = document.getElementById("groups-error");
const createGroupForm = document.getElementById("create-group-form");
const createGroupMessage = document.getElementById("create-group-message");
const groupNameInput = document.getElementById("group-name");

function renderGroups(groups) {
  groupsTableBody.innerHTML = "";

  for (const group of groups) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${group.id}</td>
      <td>${group.name}</td>
      <td><a href="./group-detail.html?id=${group.id}">View</a></td>
    `;
    groupsTableBody.appendChild(tr);
  }
}

async function loadGroups() {
  groupsError.textContent = "";
  try {
    const groups = await getGroups();
    renderGroups(groups);
  } catch (error) {
    groupsError.textContent = `Failed to load groups: ${error.message}`;
  }
}

createGroupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  createGroupMessage.textContent = "";
  createGroupMessage.className = "";

  try {
    await createGroup({ name: groupNameInput.value.trim() });
    createGroupForm.reset();
    createGroupMessage.textContent = "Group created.";
    createGroupMessage.className = "success";
    await loadGroups();
  } catch (error) {
    createGroupMessage.textContent = `Failed to create group: ${error.message}`;
    createGroupMessage.className = "error";
  }
});

loadGroups();