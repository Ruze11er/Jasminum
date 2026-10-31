import { useSyncExternalStore } from 'react';

/** true while a CSS media query matches, e.g. `useMediaQuery('(min-width: 768px)')`. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind's `md` breakpoint: tablets and desktops. */
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)');

/** Tailwind's `xl` breakpoint: wide enough for a second sidebar next to the app's own. */
export const useIsWide = () => useMediaQuery('(min-width: 1280px)');
