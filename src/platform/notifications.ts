/**
 * System notifications for reminders. Web apps can only show them while the app is open
 * (no push server), and the user must allow them first. Every function degrades
 * gracefully when the API is missing.
 */

export type NotificationStatus = NotificationPermission | 'unsupported';

const supported = () => typeof window !== 'undefined' && 'Notification' in window;

export function notificationStatus(): NotificationStatus {
  return supported() ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission(): Promise<NotificationStatus> {
  if (!supported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Shows a system notification if allowed. Prefers the service worker, because some
 * browsers (Android Chrome) don't allow `new Notification()` from a page.
 */
export async function showSystemNotification(title: string, body: string, tag: string) {
  if (notificationStatus() !== 'granted') return false;
  const options: NotificationOptions = { body, tag, icon: '/pwa-192x192.png' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
