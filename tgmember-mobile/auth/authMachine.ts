import { ApiError, requestJson } from "../api/client";
import { API_CONFIG } from "../config/api";
import { lookupMember } from "../api/crm";
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

export type ResolveScreenResult = {
  screen: Screen;
  userId: string;
  member: any;
};

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

async function startTdlibSession(userId: string) {
  return requestJson(`${API_CONFIG.TDLIB_BASE_URL}/auth/start`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function resolveScreen(loginKey: string): Promise<ResolveScreenResult> {
  const member = await lookupMember(loginKey);

  if (!member) {
    throw new Error("無此帳號，請聯絡開發人員協助開通");
  }

  const tdlibUserId = String(member.id);

  try {
    const res: any = await getAuthState(tdlibUserId);
    const payload = res.data || res;
    return {
      screen: mapState(payload),
      userId: tdlibUserId,
      member,
    };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      await startTdlibSession(tdlibUserId);
      return {
        screen: "phone",
        userId: tdlibUserId,
        member,
      };
    }
    throw e;
  }
}
