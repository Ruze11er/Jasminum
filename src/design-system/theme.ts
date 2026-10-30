import { useEffect } from 'react';
import { useUiStore, type ThemePreference } from '@/stores/uiStore';

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function resolveTheme(pref: ThemePreference, systemDark: boolean): 'light' | 'dark' {
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return pref;
}

function applyTheme(pref: ThemePreference) {
  const resolved = resolveTheme(pref, darkQuery().matches);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  // Keep the browser/OS chrome (status bar, title bar) in step with the theme.
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((m) => (m.content = resolved === 'dark' ? '#1E1519' : '#FFF5F8'));
}

/** Keeps the <html> theme class in sync with the saved preference and the OS setting. */
export function useThemeSync() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = darkQuery();
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);
}
