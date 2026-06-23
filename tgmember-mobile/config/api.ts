declare const process: {
  env?: Record<string, string | undefined>;
};

type ApiTarget = "production" | "local" | "nas";

type ApiPreset = {
  TDLIB_BASE_URL: string;
  CRM_BASE_URL: string;
};

const env = process.env || {};
const productionPreset: ApiPreset = {
  TDLIB_BASE_URL: "https://tdlib.tgmembertools.com",
  CRM_BASE_URL: "https://api.tgmembertools.com",
};

function normalizeTarget(value: string | undefined): ApiTarget {
  if (value === "local" || value === "nas" || value === "production") {
    return value;
  }

  return "production";
}

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

function getNasPreset(): ApiPreset {
  const host = env.EXPO_PUBLIC_NAS_HOST;

  if (!host) {
    return productionPreset;
  }

  const normalizedHost = host.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  return {
    TDLIB_BASE_URL: `http://${normalizedHost}:8000`,
    CRM_BASE_URL: `http://${normalizedHost}:8001`,
  };
}

function getPreset(target: ApiTarget): ApiPreset {
  if (target === "local") {
    return {
      TDLIB_BASE_URL: "http://127.0.0.1:8000",
      CRM_BASE_URL: "http://127.0.0.1:8001",
    };
  }

  if (target === "nas") {
    return getNasPreset();
  }

  return productionPreset;
}

const target = normalizeTarget(env.EXPO_PUBLIC_API_TARGET);
const preset = getPreset(target);

export const API_CONFIG = {
  TARGET: target,
  TDLIB_BASE_URL: trimTrailingSlash(
    env.EXPO_PUBLIC_TDLIB_BASE_URL || preset.TDLIB_BASE_URL,
  ),
  CRM_BASE_URL: trimTrailingSlash(
    env.EXPO_PUBLIC_CRM_BASE_URL || preset.CRM_BASE_URL,
  ),

  crmUserPath(userId: string) {
    return `/members/${encodeURIComponent(userId)}`;
  },
};