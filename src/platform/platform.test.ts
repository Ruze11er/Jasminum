import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetBadgeForTests, setAppBadge } from './badge';
import { installMethod, listenForInstallPrompt, promptInstall, useInstallState } from './install';

const setUserAgent = (ua: string, touchPoints = 0) => {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touchPoints, configurable: true });
};
const realUA = navigator.userAgent;

afterEach(() => {
  setUserAgent(realUA);
  useInstallState.setState({ deferred: null, justInstalled: false });
  delete (navigator as unknown as Record<string, unknown>).setAppBadge;
  delete (navigator as unknown as Record<string, unknown>).clearAppBadge;
  resetBadgeForTests();
});

describe('installing', () => {
  it('uses the browser prompt when one was offered', async () => {
    listenForInstallPrompt();
    const prompt = vi.fn(async () => undefined);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); // kept for our own button
    expect(installMethod(useInstallState.getState())).toBe('prompt');

    expect(await promptInstall()).toBe('accepted');
    expect(prompt).toHaveBeenCalled();
    expect(installMethod(useInstallState.getState())).toBe('installed');
    expect(await promptInstall()).toBe('unavailable'); // a prompt is single-use
  });

  it('shows Share-menu steps on iPhone and iPad, and the browser menu elsewhere', () => {
    const state = { deferred: null, justInstalled: false };
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1');
    expect(installMethod(state)).toBe('apple');
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', 5); // iPadOS
    expect(installMethod(state)).toBe('apple');
    setUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0');
    expect(installMethod(state)).toBe('browser-menu');
  });

  it('knows when the app was just installed', () => {
    window.dispatchEvent(new Event('appinstalled'));
    expect(installMethod(useInstallState.getState())).toBe('installed');
  });
});

describe('app badge', () => {
  it('sets and clears the badge where supported, without repeating itself', async () => {
    const set = vi.fn(async () => undefined);
    const clear = vi.fn(async () => undefined);
    Object.assign(navigator, { setAppBadge: set, clearAppBadge: clear });
    await setAppBadge(3);
    await setAppBadge(3);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(3);
    await setAppBadge(0);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('does nothing where badges are not supported', async () => {
    await expect(setAppBadge(2)).resolves.toBeUndefined();
  });
});
