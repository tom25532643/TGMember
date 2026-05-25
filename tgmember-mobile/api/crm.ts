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
