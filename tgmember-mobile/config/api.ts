export const API_CONFIG = {
  /**
   * TDLib Service handles Telegram auth state, sessions, groups, folders and messages.
   * Default local development port: 8000
   */
  TDLIB_BASE_URL:
    "https://boards-licensing-separated-examinations.trycloudflare.com",

  /**
   * CRM/FastAPI service validates whether the TGMember user account exists.
   * Default local development port: 8001
   */
  CRM_BASE_URL: "https://livecam-becoming-legs-compensation.trycloudflare.com",

  /**
   * Keep the user lookup path here to avoid scattering endpoint decisions.
   * Current agreed login flow: GET /members/{id}
   */
  crmUserPath(userId: string) {
    return `/members/${userId}`;
  },
};
