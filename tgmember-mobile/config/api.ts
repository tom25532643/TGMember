export const API_CONFIG = {
  TDLIB_BASE_URL: "https://tdlib.tgmembertools.com",

  CRM_BASE_URL: "https://api.tgmembertools.com",

  crmUserPath(userId: string) {
    return `/members/${userId}`;
  },
};
