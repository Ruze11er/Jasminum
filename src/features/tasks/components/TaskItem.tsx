import { useState, type ReactNode } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ListChecks,
  Repeat,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { Checkbox, Chip, type ChipColor } from '@/design-system';
import { tasksRepo } from '@/data/repos/tasks';
import type { Category, ChecklistItem, Tag, Task } from '@/data/types';
import { cn } from '@/lib/cn';
import { dayLabel, timeLabel } from '@/lib/dates';
import { useOptimisticFlag } from '@/lib/useOptimisticFlag';
import { useSwipe } from '@/lib/useSwipe';
import { deleteTask, toggleTaskDone } from '../taskActions';
import { PriorityBadge } from './PriorityBadge';

function Meta({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const [checked, toggle] = useOptimisticFlag(!!item.done);
  return (
    <li>
      <Checkbox
        label={item.text}
        strikeWhenChecked
        checked={checked}
        onChange={() => void toggle(() => tasksRepo.toggleChecklistItem(item.id))}
        className="text-sm"
      />
    </li>
  );
}

export interface TaskItemProps {
  task: Task;
  today: string;
  category?: Category;
  tagById: Map<string, Tag>;
  checklist?: ChecklistItem[];
  onOpen: (task: Task) => void;
  /** Hide the date when the group heading already shows it. */
  hideDate?: boolean;
}

export function TaskItem({
  task,
  today,
  category,
  tagById,
  checklist = [],
  onOpen,
  hideDate,
}: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [done, toggleDone] = useOptimisticFlag(task.status === 'done');
  const overdue = !done && task.dueDate !== null && task.dueDate < today;
  const doneCount = checklist.filter((i) => i.done).length;
  const tags = task.tagIds.map((id) => tagById.get(id)).filter((t): t is Tag => !!t);
  const checklistId = `checklist-${task.id}`;
  // Touch: swipe right to complete (or reopen), left to delete. The checkbox and the
  // form's Delete button do the same for everyone else.
  const swipe = useSwipe({
    onSwipeRight: () => void toggleDone(() => toggleTaskDone(task)),
    onSwipeLeft: () => void deleteTask(task),
  });
  const swiping = swipe.offset !== 0;

  return (
    <li className="group/task relative overflow-hidden">
      {swiping && (
        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-0 flex items-center px-5 text-sm font-bold',
            swipe.offset > 0
              ? 'justify-start bg-success-soft text-success'
              : 'justify-end bg-danger-soft text-danger',
          )}
        >
          <span
            className="flex items-center gap-1.5"
            style={{ opacity: 0.4 + swipe.progress * 0.6 }}
          >
            {swipe.offset > 0 ? (
              <>
                <Check className="size-5" /> {done ? 'Not done' : 'Done'}
              </>
            ) : (
              <>
                Delete <Trash2 className="size-5" />
              </>
            )}
          </span>
        </div>
      )}
      <div
        {...swipe.handlers}
        style={swiping ? { transform: `translateX(${swipe.offset}px)` } : undefined}
        className={cn(
          'relative flex touch-pan-y items-start gap-3 bg-surface px-4 py-3 md:px-5',
          !swiping && 'transition-transform duration-200',
        )}
      >
        <div className="pt-0.5">
          <Checkbox
            checked={done}
            onChange={() => void toggleDone(() => toggleTaskDone(task))}
            aria-label={`Complete: ${task.title}`}
          />
        </div>
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="min-w-0 flex-1 text-left"
          aria-label={`Edit task: ${task.title}`}
        >
          <span
            className={cn('block font-semibold break-words', done && 'text-fg-muted line-through')}
          >
            {task.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 empty:hidden">
            {task.dueDate && !hideDate && (
              <Meta
                icon={CalendarDays}
                className={
                  overdue ? 'text-danger' : task.dueDate === today ? 'text-link' : 'text-fg-muted'
                }
              >
                {dayLabel(task.dueDate, today)}
                {task.dueTime && ` · ${timeLabel(task.dueTime)}`}
              </Meta>
            )}
            {hideDate && task.dueTime && (
              <Meta icon={CalendarDays} className="text-fg-muted">
                {timeLabel(task.dueTime)}
              </Meta>
            )}
            {task.rrule && (
              <Meta icon={Repeat} className="text-fg-muted">
                <span className="sr-only">Repeats</span>
              </Meta>
            )}
            {checklist.length > 0 && (
              <Meta icon={ListChecks} className="text-fg-muted">
                {doneCount}/{checklist.length}
              </Meta>
            )}
            <PriorityBadge priority={task.priority} />
            {category && (
              <Chip color={category.color as ChipColor} className="h-6 text-xs">
                {category.name}
              </Chip>
            )}
            {tags.map((t) => (
              <Chip key={t.id} color="neutral" className="h-6 text-xs">
                #{t.name}
              </Chip>
            ))}
          </span>
        </button>
        {checklist.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-controls={checklistId}
            aria-label={`${expanded ? 'Hide' : 'Show'} checklist for ${task.title}`}
            className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-surface-muted max-md:size-11"
          >
            <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>
      {expanded && (
        <ul
          id={checklistId}
          aria-label={`Checklist for ${task.title}`}
          className="space-y-2 pb-3 pl-13 md:pl-14"
        >
          {checklist.map((item) => (
            <ChecklistRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </li>
  );
}
