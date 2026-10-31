import { useEffect, useRef, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { Check, SquareCheckBig, X } from 'lucide-react';
import type { Selection } from '@/lib/useSelection';
import { cn } from '@/lib/cn';
import { Button, type ButtonProps } from './Button';
import { IconButton } from './IconButton';

/** Starts selection mode. Put it in the list's header; it gets the focus back on exit. */
export function SelectButton({
  selection,
  disabled,
  className,
}: {
  selection: Selection;
  disabled?: boolean;
  className?: string;
}) {
  const { bindTrigger, start } = selection;
  return (
    <Button
      ref={bindTrigger}
      variant="ghost"
      icon={<SquareCheckBig />}
      onClick={start}
      disabled={disabled}
      className={className}
    >
      Select
    </Button>
  );
}

/**
 * The bar shown while selecting: how many are selected, Select all, Cancel, and the bulk
 * actions. It stays at the top of the screen while the list scrolls.
 */
export function SelectionBar({
  selection,
  children,
}: {
  selection: Selection;
  /** The bulk actions (`BulkAction` buttons, a "Move to" select…). */
  children: ReactNode;
}) {
  const bar = useRef<HTMLDivElement>(null);
  // The Select button that opened it is gone, so the focus moves here.
  useEffect(() => bar.current?.focus(), []);
  return (
    <div
      ref={bar}
      role="region"
      aria-label="Selection"
      tabIndex={-1}
      className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-2xl border border-primary/40 bg-primary-soft p-1.5 text-primary-soft-fg shadow-soft-md outline-none md:top-3"
    >
      <IconButton
        label="Cancel selection"
        icon={<X />}
        onClick={selection.exit}
        className="text-primary-soft-fg hover:bg-surface/60 hover:text-primary-soft-fg"
      />
      <p aria-live="polite" className="font-semibold whitespace-nowrap">
        {selection.count} selected
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={selection.allSelected ? selection.clear : selection.selectAll}
        className="text-primary-soft-fg hover:bg-surface/60 hover:text-primary-soft-fg"
      >
        {selection.allSelected ? 'Select none' : 'Select all'}
      </Button>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">{children}</div>
    </div>
  );
}

/** A bulk action button. On phones only the icon shows (the name is still read out). */
export function BulkAction({
  icon,
  label,
  className,
  variant = 'secondary',
  ...props
}: Omit<ButtonProps, 'children'> & { icon: ReactNode; label: string }) {
  return (
    <Button
      size="sm"
      variant={variant}
      icon={icon}
      title={label}
      className={cn(
        variant === 'secondary' && 'bg-surface hover:bg-surface-muted',
        'max-sm:px-2.5',
        className,
      )}
      {...props}
    >
      <span className="max-sm:sr-only">{label}</span>
    </Button>
  );
}

/** The round check mark on a selectable item. Decoration: the item itself says it's selected. */
export function SelectCheck({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        checked
          ? 'border-primary bg-primary text-on-primary'
          : 'border-line-strong bg-surface text-transparent',
        className,
      )}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  );
}

/**
 * A list item that opens a page, or (in selection mode) selects itself. On computers a check
 * appears in its corner on hover, to start selecting without the Select button. Shift-click
 * selects a range. Links never wrap the check, so there are no nested controls.
 */
export function SelectableLink({
  selection,
  id,
  to,
  label,
  className,
  check = 'corner',
  linkProps,
  children,
}: {
  selection: Selection;
  id: string;
  to: string;
  /** The item's name, for the hover check ("Select …"). */
  label: string;
  className?: string;
  /** `corner`: a floating check on a card. `inline`: a check at the start of a row. */
  check?: 'corner' | 'inline';
  linkProps?: Omit<LinkProps, 'to' | 'className' | 'children'>;
  children: ReactNode;
}) {
  const selected = selection.isSelected(id);
  const toggle = (e: { shiftKey: boolean }) => selection.toggle(id, e.shiftKey);
  if (selection.active) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={toggle}
        className={cn(
          'relative w-full text-left',
          className,
          check === 'inline' && 'pl-12',
          selected &&
            (check === 'corner'
              ? 'border-primary bg-primary-soft/40 ring-2 ring-primary'
              : 'bg-primary-soft/60'),
        )}
      >
        <SelectCheck
          checked={selected}
          className={cn(
            'absolute',
            check === 'corner'
              ? '-top-2 -left-2 shadow-soft-sm'
              : 'top-1/2 left-4 -translate-y-1/2',
          )}
        />
        {children}
      </button>
    );
  }
  return (
    <div className="group/sel relative h-full">
      <Link to={to} className={className} {...linkProps}>
        {children}
      </Link>
      {check === 'corner' && (
        <button
          type="button"
          aria-label={`Select ${label}`}
          onClick={toggle}
          className="absolute -top-2 -left-2 z-10 hidden rounded-full opacity-0 transition-opacity group-hover/sel:opacity-100 focus-visible:opacity-100 [@media(hover:hover)]:flex"
        >
          <SelectCheck checked={false} className="shadow-soft-sm hover:border-primary" />
        </button>
      )}
    </div>
  );
}
