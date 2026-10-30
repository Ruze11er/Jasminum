import type { ReactNode } from 'react';

/** Circular progress indicator. `value` is 0–1. */
export function ProgressRing({
  value,
  size = 72,
  stroke = 8,
  label,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  /** Accessible description, e.g. "3 of 5 tasks done". */
  label: string;
  children?: ReactNode;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <div
      role="img"
      aria-label={label}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-primary-soft"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className="stroke-brand transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
        {children ?? `${Math.round(clamped * 100)}%`}
      </div>
    </div>
  );
}
