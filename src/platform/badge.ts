/**
 * The number on the installed app's icon (Badging API: Chrome/Edge desktop, Android
 * home-screen apps on some launchers, iOS 16.4+ Home Screen apps with notification
 * permission). Feature-detected; does nothing where unsupported.
 */
type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

let last: number | null = null;

export async function setAppBadge(count: number): Promise<void> {
  if (typeof navigator === 'undefined' || count === last) return;
  const nav = navigator as BadgeNavigator;
  if (!nav.setAppBadge || !nav.clearAppBadge) return;
  last = count;
  try {
    if (count > 0) await nav.setAppBadge(count);
    else await nav.clearAppBadge();
  } catch {
    // Not allowed here (e.g. not installed): nothing to do.
  }
}

/** Test helper. */
export function resetBadgeForTests() {
  last = null;
}
