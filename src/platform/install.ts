import { create } from 'zustand';
import { isAppleMobile, isInstalledApp } from './storage';

/**
 * Installing Jasminum as an app ("Add to Home Screen" / "Install app").
 * - Chrome, Edge and Android offer an install prompt the app can trigger with a button.
 * - iPhone and iPad have no prompt: the user installs from the Share menu.
 * - Elsewhere (e.g. Firefox on desktop) the browser's own menu is the only way.
 * Feature-detected: the prompt event either arrives or it doesn't.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  /** The browser's saved install prompt, if it offered one. */
  deferred: BeforeInstallPromptEvent | null;
  /** Set when the app is installed during this visit. */
  justInstalled: boolean;
}

export const useInstallState = create<InstallState>(() => ({
  deferred: null,
  justInstalled: false,
}));

let listening = false;

/** Call once at start-up: the prompt event can fire very early. */
export function listenForInstallPrompt() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep it for our own button instead of the browser's mini-bar
    useInstallState.setState({ deferred: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => {
    useInstallState.setState({ deferred: null, justInstalled: true });
  });
}

export type InstallMethod = 'installed' | 'prompt' | 'apple' | 'browser-menu';

/** How this device can install the app right now. */
export function installMethod(state: InstallState): InstallMethod {
  if (state.justInstalled || isInstalledApp()) return 'installed';
  if (state.deferred) return 'prompt';
  if (isAppleMobile()) return 'apple';
  return 'browser-menu';
}

export const useInstallMethod = () => useInstallState(installMethod);

/** Shows the browser's install prompt. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const deferred = useInstallState.getState().deferred;
  if (!deferred) return 'unavailable';
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  // A prompt can only be used once.
  useInstallState.setState({ deferred: null, justInstalled: outcome === 'accepted' });
  return outcome;
}
