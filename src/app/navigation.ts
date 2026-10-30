import {
  CalendarDays,
  House,
  Library,
  Lightbulb,
  ListChecks,
  NotebookPen,
  Settings,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the phone bottom bar (max 5). Others are reached from the header or Home. */
  inBottomBar: boolean;
}

export const mainNav: NavItem[] = [
  { to: '/', label: 'Home', icon: House, inBottomBar: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, inBottomBar: true },
  { to: '/tasks', label: 'Tasks', icon: ListChecks, inBottomBar: true },
  { to: '/notes', label: 'Notes', icon: NotebookPen, inBottomBar: true },
  { to: '/library', label: 'Library', icon: Library, inBottomBar: true },
  { to: '/insights', label: 'Insights', icon: Lightbulb, inBottomBar: false },
];

/** Desktop sidebar only; on phones the Trash is reached from Settings → Data. */
export const trashNav: NavItem = { to: '/trash', label: 'Trash', icon: Trash2, inBottomBar: false };

export const settingsNav: NavItem = {
  to: '/settings',
  label: 'Settings',
  icon: Settings,
  inBottomBar: false,
};
