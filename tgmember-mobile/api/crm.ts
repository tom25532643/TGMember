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

export async function getMemberByLoginKey(loginKey: string) {
  const key = loginKey.trim();

  if (!key) {
    return null;
  }

  const res = await fetch(`${CRM_BASE}/members/login-key/${encodeURIComponent(key)}`);

  if (res.status === 404 || res.status === 422) {
    return null;
  }

  if (!res.ok) {
    throw new Error("CRM member check failed");
  }

  return res.json();
}

export async function updateMemberLoginKey(userId: string, loginKey: string) {
  const res = await fetch(`${CRM_BASE}/members/${encodeURIComponent(userId)}/login-key`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login_key: loginKey.trim() }),
  });

  if (!res.ok) {
    let data: any = null;
    try {
      data = await res.json();
    } catch {}
    throw new Error(data?.detail || data?.message || "Login Key update failed");
  }

  return res.json();
}

export async function lookupMember(loginKey: string) {
  const key = loginKey.trim();

  if (!key) {
    return null;
  }

  return getMemberByLoginKey(key);
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

