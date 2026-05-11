import { ApiError } from "../api/client";
import { getMember } from "../api/crm";
import { getAuthState } from "../api/tdlib";

export type Screen =
  | "checking"
  | "login"
  | "session_missing"
  | "phone"
  | "code"
  | "password"
  | "home"
  | "audience"
  | "folder";

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
  const member = await getMember(userId);

  if (!member) {
    throw new Error("User does not exist. Please contact the developer.");
  }

  try {
    const res: any = await getAuthState(userId);
    const payload = res.data || res;
    return mapState(payload);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return "session_missing";
    }
    throw e;
  }
}
