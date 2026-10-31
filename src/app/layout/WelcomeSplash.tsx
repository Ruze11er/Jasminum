import { useEffect, useState, type CSSProperties } from 'react';
import { LogoMark } from '../Logo';
import './welcome.css';

/** Set once the welcome has shown in this tab, so reloads (e.g. after an update) skip it. */
export const WELCOME_SEEN_KEY = 'jasminum:welcome-seen';
export const WELCOME_TAGLINE = 'Your days, gently organized.';
export const WELCOME_SHOW_MS = 4000;
export const WELCOME_FADE_MS = 500;

function firstOpenThisSession() {
  try {
    return sessionStorage.getItem(WELCOME_SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}

// x (vw), size (px), duration (s), start offset (s), sideways drift (vw), spin (deg).
const PETALS: [number, number, number, number, number, number][] = [
  [6, 22, 7, 1, 6, 220],
  [15, 14, 9, 6, -4, -180],
  [24, 18, 8, 3.5, 5, 260],
  [34, 12, 10, 8, -6, -240],
  [45, 20, 7.5, 5, 4, 200],
  [55, 15, 9, 1.5, -5, -220],
  [64, 24, 8, 6.5, 6, 240],
  [73, 13, 10, 3, -4, -200],
  [82, 19, 7, 4.5, 5, 280],
  [92, 16, 9.5, 7.5, -6, -260],
];

function Petal({ style }: { style: CSSProperties }) {
  return (
    <svg viewBox="-60 -60 120 120" className="welcome-petal" style={style}>
      <g fill="var(--welcome-petal)">
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse key={deg} rx="15" ry="28" cy="-25" transform={`rotate(${deg})`} />
        ))}
      </g>
      <circle r="11" fill="var(--welcome-petal-center)" />
    </svg>
  );
}

/**
 * The welcome screen shown each time the app is opened: logo, name and tagline over a
 * moving background. It fades into the app on its own; a tap or key press skips it.
 * It's decoration only (hidden from screen readers), and the app loads behind it.
 */
export function WelcomeSplash() {
  const [phase, setPhase] = useState<'shown' | 'leaving' | 'gone'>(() =>
    firstOpenThisSession() ? 'shown' : 'gone',
  );

  useEffect(() => {
    if (phase === 'gone') return;
    try {
      sessionStorage.setItem(WELCOME_SEEN_KEY, '1');
    } catch {
      // Private mode: it shows again on reload, which is harmless.
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'leaving') {
      const t = setTimeout(() => setPhase('gone'), WELCOME_FADE_MS);
      return () => clearTimeout(t);
    }
    if (phase !== 'shown') return;
    const leave = () => setPhase('leaving');
    const t = setTimeout(leave, WELCOME_SHOW_MS);
    // Listen on window: when the app lock is on, this layer is made inert with the rest.
    window.addEventListener('pointerdown', leave);
    window.addEventListener('keydown', leave);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', leave);
      window.removeEventListener('keydown', leave);
    };
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div
      aria-hidden="true"
      data-testid="welcome"
      data-leaving={phase === 'leaving' || undefined}
      className="welcome fixed inset-0 z-[90] grid place-items-center overflow-hidden px-6"
    >
      <div className="welcome-blob welcome-blob-1" />
      <div className="welcome-blob welcome-blob-2" />
      <div className="welcome-blob welcome-blob-3" />
      <div className="welcome-blob welcome-blob-4" />
      {PETALS.map(([x, size, duration, offset, drift, spin]) => (
        <Petal
          key={x}
          style={
            {
              '--x': `${x}vw`,
              '--size': `${size}px`,
              '--duration': `${duration}s`,
              '--offset': `-${offset}s`,
              '--drift': `${drift}vw`,
              '--spin': `${spin}deg`,
            } as CSSProperties
          }
        />
      ))}

      <div className="relative flex flex-col items-center text-center">
        <div className="welcome-logo relative">
          <div className="welcome-halo absolute inset-0 rounded-[24%]" />
          <LogoMark className="relative size-24 rounded-[24%] shadow-soft-lg md:size-28" />
        </div>
        <p className="welcome-rise mt-7 font-display text-5xl font-bold tracking-tight text-primary-soft-fg md:text-6xl">
          Jasminum
        </p>
        <p className="welcome-rise welcome-rise-late mt-3 text-lg font-semibold text-fg md:text-xl">
          {WELCOME_TAGLINE}
        </p>
      </div>
    </div>
  );
}
