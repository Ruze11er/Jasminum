import { Check, RotateCcw, Trash2 } from 'lucide-react';
import { BulkAction, Select, SelectionBar } from '@/design-system';
import type { Task } from '@/data/types';
import { addLocalDays } from '@/lib/dates';
import type { Selection } from '@/lib/useSelection';
import { completeTasks, deleteTasks, moveTasks, reopenTasks } from '../taskActions';

/** Bulk actions for selected tasks: done (or not done), move to a day, delete. */
export function TasksSelectionBar({
  selection,
  tasks,
  today,
}: {
  selection: Selection;
  /** Every task on screen; the selected ones are picked from these. */
  tasks: Task[];
  today: string;
}) {
  const picked = tasks.filter((t) => selection.ids.includes(t.id));
  const none = picked.length === 0;
  const allDone = !none && picked.every((t) => t.status === 'done');
  // Each action ends selection mode once it's done.
  const run = (action: Promise<unknown>) => void action.then(selection.exit);
  const days = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addLocalDays(today, 1) },
    { label: 'Next week', date: addLocalDays(today, 7) },
  ];
  return (
    <SelectionBar selection={selection}>
      {allDone ? (
        <BulkAction
          icon={<RotateCcw />}
          label="Not done"
          onClick={() => run(reopenTasks(picked))}
        />
      ) : (
        <BulkAction
          icon={<Check />}
          label="Done"
          disabled={none}
          onClick={() => run(completeTasks(picked))}
        />
      )}
      <Select
        aria-label="Move to day"
        value=""
        disabled={none}
        onChange={(e) => e.target.value && run(moveTasks(picked, e.target.value))}
        className="w-36 [&>select]:h-9 [&>select]:bg-surface [&>select]:text-sm max-md:[&>select]:h-11"
      >
        <option value="" disabled>
          Move to…
        </option>
        {days.map((d) => (
          <option key={d.label} value={d.date}>
            {d.label}
          </option>
        ))}
      </Select>
      <BulkAction
        icon={<Trash2 />}
        label="Delete"
        variant="danger"
        disabled={none}
        onClick={() => run(deleteTasks(picked))}
      />
    </SelectionBar>
  );
}
