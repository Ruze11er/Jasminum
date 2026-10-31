import { Link } from 'react-router';
import { CalendarHeart, ChevronRight, ListChecks } from 'lucide-react';
import { Card, CardHeader, EmptyState, ProgressRing } from '@/design-system';
import { useToday } from '@/lib/useToday';
import { TaskItem } from '@/features/tasks/components/TaskItem';
import { useTaskEditor } from '@/features/tasks/editorStore';
import { buildView, todayProgress } from '@/features/tasks/selectors';
import { useTasksData } from '@/features/tasks/useTasksData';

const MAX_SHOWN = 5;

/** Home's view of today: progress plus the first few overdue and due-today tasks. */
export function TodayCard() {
  const data = useTasksData();
  const openEdit = useTaskEditor((s) => s.openEdit);
  const today = useToday();
  if (!data) return <Card className="min-h-48" aria-busy="true" />;

  const { done, total } = todayProgress(data.tasks, today);
  const open = buildView('today', data.tasks, today)
    .filter((g) => g.key !== 'done-today')
    .flatMap((g) => g.tasks);
  const shown = open.slice(0, MAX_SHOWN);
  const overdue = open.filter((t) => t.dueDate! < today).length;

  return (
    <Card>
      <CardHeader
        title="Today"
        icon={<ListChecks />}
        action={
          <Link
            to="/tasks"
            className="flex items-center gap-0.5 text-sm font-bold text-link hover:underline"
          >
            All tasks
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        }
      />
      <div className="flex items-center gap-4 rounded-xl bg-surface-muted p-3">
        <ProgressRing
          value={total ? done / total : 0}
          size={56}
          stroke={6}
          label={`${done} of ${total} tasks done today`}
        >
          {done}/{total}
        </ProgressRing>
        <p className="text-sm text-fg-muted">
          {total === 0
            ? 'Nothing planned for today yet.'
            : done === total
              ? 'Everything for today is done. Well done!'
              : `${total - done} to go${overdue ? `, including ${overdue} overdue` : ''}.`}
        </p>
      </div>
      {shown.length === 0 ? (
        <EmptyState
          className="py-6"
          icon={<CalendarHeart />}
          title="A fresh, calm day"
          description="Tap + to add a task or event."
        />
      ) : (
        <>
          <ul className="-mx-4 mt-2 divide-y divide-line md:-mx-5" aria-label="Today's tasks">
            {shown.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                today={today}
                category={task.categoryId ? data.categoryById.get(task.categoryId) : undefined}
                tagById={data.tagById}
                checklist={data.checklistByTask.get(task.id)}
                onOpen={(t) => openEdit(t.id)}
                hideDate={task.dueDate === today}
              />
            ))}
          </ul>
          {open.length > MAX_SHOWN && (
            <Link
              to="/tasks"
              className="mt-2 block text-center text-sm font-bold text-link hover:underline"
            >
              {open.length - MAX_SHOWN} more
            </Link>
          )}
        </>
      )}
    </Card>
  );
}
