import { requestJson } from "./client";

const BASE = "http://10.191.36.55:8000";

export async function getAuthState(userId: string) {
  return requestJson(`${BASE}/auth/state/${userId}`);
}

export async function startSession(userId: string) {
  return requestJson(`${BASE}/auth/start`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function sendPhone(userId: string, phone: string) {
  return requestJson(`${BASE}/auth/phone`, {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      phone_number: phone,
    }),
  });
}

export async function sendCode(userId: string, code: string) {
  return requestJson(`${BASE}/auth/code`, {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      code,
    }),
  });
}

export async function sendPassword(userId: string, password: string) {
  return requestJson(`${BASE}/auth/password`, {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      password,
    }),
  });
}

export async function loadSupergroups(userId: string) {
  return requestJson(`${BASE}/supergroups/${userId}`);
}

export async function sendToSupergroupMembers(
  userId: string,
  chatId: string | number,
  text: string,
  maxCount: number,
) {
  return requestJson(`${BASE}/supergroups/${userId}/${chatId}/send`, {
    method: "POST",
    body: JSON.stringify({
      text,
      max_count: maxCount,
    }),
  });
}

export async function getAllMembers(userId: string, chatId: number) {
  return requestJson(`${BASE}/supergroups/${userId}/${chatId}/members/all`);
}

export async function sendToOneUser(
  userId: string,
  targetUserId: number,
  text: string,
) {
  return requestJson(`${BASE}/messages/${userId}/send`, {
    method: "POST",
    body: JSON.stringify({
      user_id: targetUserId,
      text,
    }),
  });
}

export async function sendMessage(
  userId: string,
  chatId: number,
  text: string,
) {
  return requestJson(`${BASE}/send`, {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      chat_id: chatId,
      text,
    }),
  });
}

export async function getFolders(userId: string) {
  return requestJson(`${BASE}/folders/${userId}`);
}

export async function getFolderChats(userId: string, folderId: number) {
  return requestJson(`${BASE}/folders/${userId}/${folderId}/chats`);
}

export async function sendFolder(
  userId: string,
  folderId: number,
  text: string,
) {
  return requestJson(`${BASE}/folders/${userId}/${folderId}/send`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
