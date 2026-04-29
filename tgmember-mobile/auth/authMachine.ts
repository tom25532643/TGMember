import { ApiError } from "../api/client";
import { getMember } from "../api/crm";
import { getAuthState } from "../api/tdlib";

export type Screen =
  | "checking"
  | "login"
  | "create_session"
  | "phone"
  | "code"
  | "password"
  | "home";

function mapState(payload: any): Screen {
  const state = payload.auth_state || payload.auth_state_raw?.["@type"];

  if (
    payload.is_ready ||
    payload.is_authorized ||
    state === "authorizationStateReady"
  ) {
    return "home";
  }

  if (state === "authorizationStateWaitPhoneNumber") return "phone";
  if (state === "authorizationStateWaitCode") return "code";
  if (state === "authorizationStateWaitPassword") return "password";

  return "phone";
}

export async function resolveScreen(userId: string): Promise<Screen> {
  // 1️⃣ CRM check
  await getMember(userId);

  // 2️⃣ TDLib
  try {
    const res: any = await getAuthState(userId);
    const payload = res.data || res;
    return mapState(payload);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return "create_session";
    }
    throw e;
  }
}
