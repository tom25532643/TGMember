import { requestJson } from "./client";

const CRM_BASE = "http://10.191.36.55:8001";

export async function getMember(userId: string) {
  const res = await fetch(`${CRM_BASE}/members/${userId}`);

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error("CRM member check failed");
  }

  return res.json();
}
