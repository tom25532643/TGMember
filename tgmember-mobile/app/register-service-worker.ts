import { Platform } from 'react-native';

const SERVICE_WORKER_PATH = '/service-worker.js';

export function registerServiceWorker() {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(SERVICE_WORKER_PATH)
      .catch((error) => {
        console.warn('Service worker registration failed:', error);
      });
  });
}
