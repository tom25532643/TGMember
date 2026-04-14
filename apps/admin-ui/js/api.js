const API_BASE = "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function getMembers() {
  return request("/members");
}

export async function getMember(memberId) {
  return request(`/members/${memberId}`);
}

export async function createMember(payload) {
  return request("/members", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMemberTags(memberId) {
  return request(`/members/${memberId}/tags`);
}

export async function addMemberTag(memberId, payload) {
  return request(`/members/${memberId}/tags`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMemberNotes(memberId) {
  return request(`/members/${memberId}/notes`);
}

export async function addMemberNote(memberId, payload) {
  return request(`/members/${memberId}/notes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMemberMessageLogs(memberId) {
  return request(`/members/${memberId}/message-logs`);
}

export async function createMemberMessageLog(memberId, payload) {
  return request(`/members/${memberId}/message-logs`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getGroups() {
  return request("/groups");
}

export async function createGroup(payload) {
  return request("/groups", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getGroupMembers(groupId) {
  return request(`/groups/${groupId}/members`);
}

export async function addMemberToGroup(groupId, memberId) {
  return request(`/groups/${groupId}/members/${memberId}`, {
    method: "POST",
  });
}