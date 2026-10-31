import type { HTMLAttributes, MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  tone?: 'default' | 'muted' | 'pink';
}

const tones = {
  default: 'bg-surface border-line',
  muted: 'bg-surface-muted border-transparent',
  pink: 'bg-primary-soft border-transparent text-primary-soft-fg',
};

export function Card({ interactive, tone = 'default', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 shadow-soft-sm md:p-5',
        tones[tone],
        interactive && 'cursor-pointer transition-shadow hover:shadow-soft-md',
        className,
      )}
      {...props}
    />
  );
}

/**
 * A card header. With `to`, the title is the card's link (use it inside a `LinkCard`) and a
 * small arrow shows the card opens a page.
 */
export function CardHeader({
  title,
  icon,
  action,
  to,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  to?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-center gap-2', className)}>
      {icon && (
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg [&>svg]:size-4">
          {icon}
        </span>
      )}
      <h2 className="flex-1 text-base">{to ? <CardLink to={to}>{title}</CardLink> : title}</h2>
      {action}
      {to && (
        <ChevronRight
          aria-hidden="true"
          className="size-5 text-fg-muted transition-transform group-hover/card:translate-x-0.5 group-hover/card:text-primary"
        />
      )}
    </div>
  );
}

/**
 * The link of a `LinkCard`, usually its title. Keyboard and screen-reader users reach the
 * page through it; the focus ring is drawn around the whole card.
 */
export function CardLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} data-card-link="" className={cn('focus-visible:outline-none', className)}>
      {children}
    </Link>
  );
}

// Clicks on these keep their own meaning instead of opening the card's page.
const OWN_CLICK =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="checkbox"], [contenteditable="true"]';

/**
 * A card that opens a page: a click anywhere on it follows its `CardLink`, except on the
 * card's own buttons, checkboxes and links. There's no link wrapped around the card, so
 * those controls stay valid and reachable.
 */
export function LinkCard({ className, onClick, ...props }: Omit<CardProps, 'interactive'>) {
  const follow = (e: MouseEvent<HTMLDivElement>) => {
    onClick?.(e);
    const card = e.currentTarget;
    const target = e.target as Element;
    // Clicks from portals (menus, dialogs) bubble through React but aren't on the card.
    if (e.defaultPrevented || !card.contains(target)) return;
    const own = target.closest(OWN_CLICK);
    if (own && card.contains(own)) return;
    // Selecting text shouldn't navigate away.
    if (window.getSelection()?.toString()) return;
    card.querySelector<HTMLAnchorElement>('a[data-card-link]')?.click();
  };
  return (
    <Card
      onClick={follow}
      className={cn(
        'group/card cursor-pointer transition-[border-color,box-shadow,transform] duration-200',
        'hover:-translate-y-0.5 hover:border-primary/70 hover:shadow-soft-lg hover:ring-1 hover:ring-primary/70 active:translate-y-0',
        'has-[[data-card-link]:focus-visible]:outline-3 has-[[data-card-link]:focus-visible]:outline-offset-2 has-[[data-card-link]:focus-visible]:outline-ring',
        className,
      )}
      {...props}
    />
  );
}
