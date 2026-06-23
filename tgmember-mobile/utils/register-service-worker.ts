import { Platform } from "react-native";

const SERVICE_WORKER_PATH = "/service-worker.js";
let hasReloadedForUpdate = false;

export function registerServiceWorker() {
  if (Platform.OS !== "web") return;
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(SERVICE_WORKER_PATH)
      .then((registration) => {
        registration.update().catch(() => {});

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (hasReloadedForUpdate) return;
          hasReloadedForUpdate = true;
          window.location.reload();
        });

        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        });
      })
      .catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
  });
}
