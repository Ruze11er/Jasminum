import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import {
  CalendarCheck,
  CalendarClock,
  CheckCheck,
  Inbox,
  PartyPopper,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { Button, Card, EmptyState, PageHeader, SegmentedControl, Select } from '@/design-system';
import type { Priority } from '@/data/types';
import { clock } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { localDateOf } from '@/lib/dates';
import { QuickAddTask } from './components/QuickAddTask';
import { TaskItem } from './components/TaskItem';
import { useTaskEditor } from './editorStore';
import {
  buildView,
  defaultDueDate,
  isFiltering,
  noFilters,
  viewCounts,
  type GroupTone,
  type TaskFilters,
  type TaskView,
} from './selectors';
import { moveTasks } from './taskActions';
import { useTasksData } from './useTasksData';

const VIEWS: { value: TaskView; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Done' },
];

const EMPTY: Record<TaskView, { icon: ReactNode; title: string; text: string }> = {
  today: {
    icon: <PartyPopper />,
    title: 'All clear for today',
    text: 'Add a task above, or enjoy the free time.',
  },
  upcoming: {
    icon: <CalendarClock />,
    title: 'Nothing coming up',
    text: 'Tasks with future dates show up here.',
  },
  overdue: {
    icon: <CalendarCheck />,
    title: 'Nothing overdue',
    text: "You're all caught up. Nice work!",
  },
  all: { icon: <Inbox />, title: 'No tasks yet', text: 'Add your first task above.' },
  completed: {
    icon: <CheckCheck />,
    title: 'Nothing finished yet',
    text: 'Completed tasks are listed here.',
  },
};

const toneClass: Record<GroupTone, string> = {
  danger: 'text-danger',
  primary: 'text-link',
  muted: 'text-fg-muted',
  default: 'text-fg',
};

export default function TasksPage() {
  const data = useTasksData();
  const openNew = useTaskEditor((s) => s.openNew);
  const openEdit = useTaskEditor((s) => s.openEdit);
  // ?view=overdue (e.g. from an insight) picks the starting view.
  const [params] = useSearchParams();
  // The home-screen shortcut "New task" opens /tasks?new=1.
  const wantsNew = params.get('new') === '1';
  useEffect(() => {
    if (wantsNew) openNew({ dueDate: localDateOf(clock.now()) });
  }, [wantsNew, openNew]);
  const [view, setView] = useState<TaskView>(() => {
    const v = params.get('view');
    return v === 'today' || v === 'upcoming' || v === 'overdue' || v === 'all' || v === 'completed'
      ? v
      : 'today';
  });
  const [filters, setFilters] = useState<TaskFilters>(noFilters);
  const [showFilters, setShowFilters] = useState(false);
  const today = localDateOf(clock.now());

  const groups = useMemo(
    () => (data ? buildView(view, data.tasks, today, filters) : []),
    [data, view, today, filters],
  );
  const counts = useMemo(
    () => (data ? viewCounts(data.tasks, today, filters) : null),
    [data, today, filters],
  );
  const dueDate = defaultDueDate(view, today);

  return (
    <>
      <PageHeader
        title="Tasks"
        actions={
          <Button icon={<Plus />} onClick={() => openNew({ dueDate: dueDate ?? undefined })}>
            New task
          </Button>
        }
      />

      <div className="-mx-4 mb-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        <SegmentedControl
          label="Task view"
          value={view}
          onChange={setView}
          options={VIEWS.map((v) => ({
            value: v.value,
            label: (
              <>
                {v.label}
                {counts && v.value !== 'completed' && counts[v.value] > 0 && (
                  <span
                    className={cn(
                      'ml-0.5 min-w-5 rounded-full px-1.5 text-xs leading-5',
                      v.value === 'overdue'
                        ? 'bg-danger-soft text-danger'
                        : 'bg-primary-soft text-primary-soft-fg',
                    )}
                  >
                    {counts[v.value]}
                  </span>
                )}
              </>
            ),
          }))}
        />
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          {view !== 'completed' && (
            <div className="flex-1">
              <QuickAddTask dueDate={dueDate} categoryId={filters.categoryId} />
            </div>
          )}
          <Button
            variant={isFiltering(filters) ? 'secondary' : 'ghost'}
            icon={<SlidersHorizontal />}
            aria-expanded={showFilters}
            aria-controls="task-filters"
            onClick={() => setShowFilters((s) => !s)}
            className={cn('h-11', view === 'completed' && 'ml-auto')}
          >
            <span className="max-sm:sr-only">Filter</span>
          </Button>
        </div>
        {showFilters && data && (
          <div
            id="task-filters"
            className="grid gap-2 sm:grid-cols-3"
            role="group"
            aria-label="Filters"
          >
            <Select
              aria-label="Category"
              value={filters.categoryId ?? ''}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value || null })}
            >
              <option value="">All categories</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Tag"
              value={filters.tagId ?? ''}
              onChange={(e) => setFilters({ ...filters, tagId: e.target.value || null })}
            >
              <option value="">All tags</option>
              {data.tags.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Priority"
              value={filters.minPriority}
              onChange={(e) =>
                setFilters({ ...filters, minPriority: Number(e.target.value) as Priority })
              }
            >
              <option value={0}>Any priority</option>
              <option value={1}>Low and above</option>
              <option value={2}>Medium and above</option>
              <option value={3}>High only</option>
            </Select>
            {isFiltering(filters) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters(noFilters)}
                className="sm:col-span-3 sm:justify-self-start"
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>

      {!data ? null : groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={EMPTY[view].icon}
            title={isFiltering(filters) ? 'No matching tasks' : EMPTY[view].title}
            description={isFiltering(filters) ? 'Try clearing the filters.' : EMPTY[view].text}
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`group-${group.key}`}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <h2
                  id={`group-${group.key}`}
                  className={cn('flex-1 text-base', toneClass[group.tone])}
                >
                  {group.title}
                  <span className="ml-2 text-sm font-semibold text-fg-muted">
                    {group.tasks.length}
                  </span>
                </h2>
                {group.key === 'overdue' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void moveTasks(group.tasks, today)}
                  >
                    Move to today
                  </Button>
                )}
              </div>
              <Card className="p-0 md:p-0">
                <ul className="divide-y divide-line" aria-labelledby={`group-${group.key}`}>
                  {group.tasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      today={today}
                      category={
                        task.categoryId ? data.categoryById.get(task.categoryId) : undefined
                      }
                      tagById={data.tagById}
                      checklist={data.checklistByTask.get(task.id)}
                      onOpen={(t) => openEdit(t.id)}
                      hideDate={group.key === task.dueDate || group.key === 'today'}
                    />
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
