import { Link, NavLink } from 'react-router';
import { Plus, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/uiStore';
import { Wordmark } from '../Logo';
import { mainNav, settingsNav } from '../navigation';

/** Phone-only top bar: logo on the left; Search, Insights and Settings on the right. */
export function MobileHeader() {
  const openSearch = useUiStore((s) => s.setPaletteOpen);
  const extras = [mainNav.find((n) => n.to === '/insights')!, settingsNav];
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md md:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link to="/" aria-label="Jasminum home">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => openSearch(true)}
            aria-label="Search"
            title="Search"
            className="flex size-11 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-muted"
          >
            <Search className="size-5" />
          </button>
          {extras.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              title={label}
              className={({ isActive }) =>
                cn(
                  'flex size-11 items-center justify-center rounded-full transition-colors',
                  isActive
                    ? 'bg-primary-soft text-primary-soft-fg'
                    : 'text-fg-muted hover:bg-surface-muted',
                )
              }
            >
              <Icon className="size-5" />
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  );
}

/** Phone-only bottom tab bar with the five main sections. */
export function BottomNav() {
  const items = mainNav.filter((n) => n.inBottomBar);
  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'group flex h-16 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-bold transition-colors',
                  isActive ? 'text-primary-soft-fg dark:text-primary' : 'text-fg-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-8 w-14 items-center justify-center rounded-full transition-colors',
                      isActive && 'bg-primary-soft',
                    )}
                  >
                    <Icon className="size-5" strokeWidth={isActive ? 2.4 : 2} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Floating "+" button above the bottom bar on phones. */
export function QuickAddFab() {
  const open = useUiStore((s) => s.setQuickAddOpen);
  return (
    <button
      type="button"
      onClick={() => open(true)}
      aria-label="Create new"
      className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-soft-lg transition-transform active:scale-95 md:hidden"
    >
      <Plus className="size-7" strokeWidth={2.4} />
    </button>
  );
}
