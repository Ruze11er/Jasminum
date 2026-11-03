/** Set once the welcome has shown in this tab, so reloads (e.g. after an update) skip it. */
export const WELCOME_SEEN_KEY = 'jasminum:welcome-seen';

/** Whether the splash will show on this load (read before it marks itself as seen). */
export function welcomeWillShow() {
  try {
    return sessionStorage.getItem(WELCOME_SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}
