import { cn } from '@/lib/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn('size-8', className)} aria-hidden="true">
      <rect width="512" height="512" rx="120" fill="#F47FA6" />
      <g transform="translate(256 262)" fill="#FFFFFF">
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse key={deg} rx="54" ry="104" cy="-92" transform={`rotate(${deg})`} />
        ))}
      </g>
      <circle cx="256" cy="262" r="44" fill="#FFE8A3" />
      <circle cx="256" cy="262" r="20" fill="#FBA8C4" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="font-display text-xl font-bold tracking-tight text-fg">Jasminum</span>
    </span>
  );
}
