import { API_CONFIG } from "../config/api";

const CRM_BASE = API_CONFIG.CRM_BASE_URL;

export async function getMember(userId: string) {
  const res = await fetch(`${CRM_BASE}${API_CONFIG.crmUserPath(userId)}`);

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error("CRM member check failed");
  }

  return res.json();
}

export async function lookupMember(loginKey: string) {
  const key = loginKey.trim();

  if (!key) {
    return null;
  }

  const directRes = await fetch(`${CRM_BASE}${API_CONFIG.crmUserPath(key)}`);

  if (directRes.ok) {
    return directRes.json();
  }

  if (directRes.status !== 404 && directRes.status !== 422) {
    throw new Error("CRM member check failed");
  }

  const listRes = await fetch(`${CRM_BASE}/members`);

  if (!listRes.ok) {
    throw new Error("CRM member list failed");
  }

  const members = await listRes.json();
  const normalizedKey = key.toLowerCase();

  return (
    members.find(
      (member: any) =>
        String(member.username || "").toLowerCase() === normalizedKey,
    ) || null
  );
}
export type TelegramMemberExpirationSyncItem = {
  telegram_user_id: number;
  display_name?: string | null;
  username?: string | null;
};

export async function getTelegramMemberExpirations(
  ownerUserId: string,
  chatId: string | number,
) {
  const res = await fetch(
    `${CRM_BASE}/telegram-member-expirations/${ownerUserId}/${chatId}`,
  );

  if (!res.ok) {
    throw new Error("Telegram member expiration load failed");
  }

  return res.json();
}

export async function syncTelegramMemberExpirations(
  ownerUserId: string,
  chatId: string | number,
  members: TelegramMemberExpirationSyncItem[],
) {
  const res = await fetch(`${CRM_BASE}/telegram-member-expirations/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      owner_user_id: ownerUserId,
      chat_id: Number(chatId),
      members,
    }),
  });

  if (!res.ok) {
    throw new Error("Telegram member expiration sync failed");
  }

  return res.json();
}

export async function updateTelegramMemberExpiration(
  ownerUserId: string,
  chatId: string | number,
  telegramUserId: string | number,
  expirationDate: string | null,
) {
  const res = await fetch(
    `${CRM_BASE}/telegram-member-expirations/${ownerUserId}/${chatId}/${telegramUserId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiration_date: expirationDate }),
    },
  );

  if (!res.ok) {
    throw new Error("Telegram member expiration update failed");
  }

  return res.json();
}

