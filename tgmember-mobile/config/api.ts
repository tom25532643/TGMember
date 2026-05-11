export const API_CONFIG = {
  /**
   * TDLib Service handles Telegram auth state, sessions, groups, folders and messages.
   * Default local development port: 8000
   */
  TDLIB_BASE_URL: "http://10.191.36.55:8000",

  /**
   * CRM/FastAPI service validates whether the TGMember user account exists.
   * Default local development port: 8001
   */
  CRM_BASE_URL: "http://10.191.36.55:8001",

  /**
   * Keep the user lookup path here to avoid scattering /users vs /members decisions.
   * Current agreed login flow: GET /users/{id}
   */
  crmUserPath(userId: string) {
    return `/members/${userId}`;
  },
};
