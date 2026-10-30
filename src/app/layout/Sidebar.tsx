import { NavLink } from 'react-router';
import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/uiStore';
import { LogoMark } from '../Logo';
import { mainNav, settingsNav, type NavItem } from '../navigation';

/**
 * Tablet: slim icon rail. Desktop: full sidebar with labels (collapsible to the rail).
 * Hidden on phones, which use the bottom bar instead.
 */
export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const openQuickAdd = useUiStore((s) => s.setQuickAddOpen);
  // Labels show only on desktop and only when not collapsed.
  const labelClass = collapsed ? 'sr-only' : 'sr-only lg:not-sr-only';

  return (
    <nav
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface px-3 py-5 md:flex',
        'w-20',
        !collapsed && 'lg:w-64 lg:px-4',
      )}
      aria-label="Main navigation"
    >
      <div
        className={cn(
          'mb-6 flex items-center justify-center gap-2.5',
          !collapsed && 'lg:justify-start lg:px-2',
        )}
      >
        <LogoMark className="size-9 shrink-0" />
        <span className={cn('font-display text-xl font-bold tracking-tight', labelClass)}>
          Jasminum
        </span>
      </div>

      <button
        type="button"
        onClick={() => openQuickAdd(true)}
        className="mb-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-on-primary shadow-soft-md transition-colors hover:bg-primary-hover"
        aria-label="Create new"
        title="Create new"
      >
        <Plus className="size-5" />
        <span className={labelClass}>New</span>
      </button>

      <div className="flex flex-1 flex-col gap-1">
        {mainNav.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} />
        ))}
      </div>

      <div className="flex flex-col gap-1 border-t border-line pt-3">
        <SidebarLink item={settingsNav} collapsed={collapsed} />
        <button
          type="button"
          onClick={toggle}
          className="hidden h-11 items-center gap-3 rounded-xl px-3 text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg lg:flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="mx-auto size-5 shrink-0" />
          ) : (
            <PanelLeftClose className="size-5 shrink-0" />
          )}
          <span className={labelClass}>Collapse</span>
        </button>
      </div>
    </nav>
  );
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  const labelClass = collapsed ? 'sr-only' : 'sr-only lg:not-sr-only';
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      title={item.label}
      className={({ isActive }) =>
        cn(
          'flex h-11 items-center justify-center gap-3 rounded-xl px-3 font-semibold transition-colors',
          !collapsed && 'lg:justify-start',
          isActive
            ? 'bg-primary-soft text-primary-soft-fg'
            : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
        )
      }
    >
      <Icon className="size-5 shrink-0" />
      <span className={labelClass}>{item.label}</span>
    </NavLink>
  );
}
