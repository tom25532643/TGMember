import { Platform } from "react-native";

const VERSION_URL = "/version.json";
const STORAGE_KEY = "tgmember_pwa_version";
let checking = false;
let reloadStarted = false;

async function clearBrowserCaches() {
  if (typeof window === "undefined") return;

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
}

async function checkVersion() {
  if (checking || reloadStarted) return;
  checking = true;

  try {
    const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) return;

    const payload = await response.json();
    const nextVersion = String(payload.version || "");
    if (!nextVersion) return;

    const currentVersion = window.localStorage.getItem(STORAGE_KEY);
    if (!currentVersion) {
      window.localStorage.setItem(STORAGE_KEY, nextVersion);
      return;
    }

    if (currentVersion !== nextVersion) {
      window.localStorage.setItem(STORAGE_KEY, nextVersion);
      reloadStarted = true;
      await clearBrowserCaches();
      window.location.reload();
    }
  } catch (error) {
    console.warn("PWA version check failed:", error);
  } finally {
    checking = false;
  }
}

export function registerVersionCheck() {
  if (Platform.OS !== "web") return;
  if (typeof window === "undefined") return;

  window.addEventListener("load", () => {
    checkVersion();
  });

  window.addEventListener("focus", () => {
    checkVersion();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkVersion();
    }
  });
}
