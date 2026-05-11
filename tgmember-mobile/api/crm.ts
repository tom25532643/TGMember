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
