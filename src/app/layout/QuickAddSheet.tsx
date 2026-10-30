import { useNavigate } from 'react-router';
import { CalendarPlus, FileUp, ListPlus, SquarePen, type LucideIcon } from 'lucide-react';
import { Sheet } from '@/design-system';
import { useUiStore } from '@/stores/uiStore';
import { useTaskEditor } from '@/features/tasks/editorStore';
import { clock } from '@/lib/clock';
import { localDateOf } from '@/lib/dates';

const actions: { label: string; hint: string; icon: LucideIcon; to: string; tone: string }[] = [
  {
    label: 'Task',
    hint: 'Something to do',
    icon: ListPlus,
    to: '/tasks',
    tone: 'bg-primary-soft text-primary-soft-fg',
  },
  {
    label: 'Event',
    hint: 'Something scheduled',
    icon: CalendarPlus,
    to: '/calendar',
    tone: 'bg-lavender/45 text-lavender-fg dark:bg-lavender/20 dark:text-lavender',
  },
  {
    label: 'Note',
    hint: 'Write it down',
    icon: SquarePen,
    to: '/notes',
    tone: 'bg-mint/50 text-mint-fg dark:bg-mint/15 dark:text-mint',
  },
  {
    label: 'Import file',
    hint: 'PDF, slides, ebooks…',
    icon: FileUp,
    to: '/library',
    tone: 'bg-peach/55 text-peach-fg dark:bg-peach/15 dark:text-peach',
  },
];

/** The "+" menu. Each option will open its own create form as features land. */
export function QuickAddSheet() {
  const open = useUiStore((s) => s.quickAddOpen);
  const setOpen = useUiStore((s) => s.setQuickAddOpen);
  const navigate = useNavigate();
  const openTask = useTaskEditor((s) => s.openNew);

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Create new"
      description="What would you like to add?"
    >
      <div className="grid grid-cols-2 gap-3">
        {actions.map(({ label, hint, icon: Icon, to, tone }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              setOpen(false);
              if (label === 'Task') {
                // Open the task form right away, dated today.
                openTask({ dueDate: localDateOf(clock.now()) });
              } else {
                navigate(to);
              }
            }}
            className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-shadow hover:shadow-soft-md"
          >
            <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block font-bold">{label}</span>
              <span className="block text-sm text-fg-muted">{hint}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
