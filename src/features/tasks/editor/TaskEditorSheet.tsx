import { useId, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2 } from 'lucide-react';
import { Button, Field, Input, SegmentedControl, Sheet, Textarea, toast } from '@/design-system';
import { db } from '@/data/db';
import { tagsRepo } from '@/data/repos/tags';
import { tasksRepo, type ChecklistDraft, type TaskInput } from '@/data/repos/tasks';
import type { Category, LocalDate, Priority, Tag, Task } from '@/data/types';
import { clock } from '@/lib/clock';
import { addLocalDays, localDateOf } from '@/lib/dates';
import { firstIssue } from '@/lib/validation';
import { useTaskEditor } from '../editorStore';
import { repeatFromRule, toRule, type RepeatState } from '../repeat';
import { deleteTask } from '../taskActions';
import { CategoryPicker } from './CategoryPicker';
import { ChecklistEditor } from './ChecklistEditor';
import { RepeatPicker } from './RepeatPicker';
import { TagInput } from './TagInput';
import { LinkedNotes } from '@/features/notes/LinkedNotes';

interface Draft {
  title: string;
  description: string;
  dueDate: LocalDate | '';
  dueTime: string;
  priority: Priority;
  categoryId: string | null;
  tagNames: string[];
  repeat: RepeatState;
  checklist: ChecklistDraft[];
}

interface Loaded {
  task: Task | null;
  draft: Draft;
  categories: Category[];
  tags: Tag[];
}

async function loadTask(
  taskId: string | null,
  defaults: Partial<TaskInput>,
): Promise<Loaded | null> {
  const [categories, tags] = await Promise.all([
    db.categories
      .orderBy('order')
      .filter((c) => !c.deletedAt)
      .toArray(),
    db.tags
      .orderBy('normalizedName')
      .filter((t) => !t.deletedAt)
      .toArray(),
  ]);
  if (!taskId) {
    return {
      task: null,
      categories,
      tags,
      draft: {
        title: defaults.title ?? '',
        description: '',
        dueDate: defaults.dueDate ?? '',
        dueTime: '',
        priority: (defaults.priority as Priority | undefined) ?? 0,
        categoryId: defaults.categoryId ?? null,
        tagNames: [],
        repeat: repeatFromRule(null),
        checklist: [],
      },
    };
  }
  const task = await db.tasks.get(taskId);
  if (!task) return null;
  const items = await tasksRepo.checklist(task.id);
  const tagById = new Map(tags.map((t) => [t.id, t.name]));
  return {
    task,
    categories,
    tags,
    draft: {
      title: task.title,
      description: task.description,
      dueDate: task.dueDate ?? '',
      dueTime: task.dueTime ?? '',
      priority: task.priority,
      categoryId: task.categoryId,
      tagNames: task.tagIds.map((id) => tagById.get(id)).filter((n): n is string => !!n),
      repeat: repeatFromRule(task.rrule),
      checklist: items.map((i) => ({ id: i.id, text: i.text, done: !!i.done })),
    },
  };
}

/** Create/edit form for a task, opened through `useTaskEditor`. Loaded lazily. */
export default function TaskEditorSheet() {
  const { open, taskId, defaults, session, close } = useTaskEditor();

  // Load once per opened task; the form keeps its own draft from then on.
  const result = useLiveQuery(
    async () => ({ session, data: await loadTask(taskId, defaults) }),
    [session, taskId, defaults],
  );
  // useLiveQuery keeps returning the previous open's result until the new one arrives.
  // Showing that would fill the form with the wrong task, so wait for this open's result.
  const loaded = result?.session === session ? result.data : undefined;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={taskId ? 'Edit task' : 'New task'}
      className="md:max-w-xl"
    >
      {loaded === null ? (
        <p className="py-6 text-center text-fg-muted">This task no longer exists.</p>
      ) : loaded ? (
        // A fresh form for every open, so no draft carries over.
        <TaskForm key={session} {...loaded} onDone={close} />
      ) : null}
    </Sheet>
  );
}

function TaskForm({
  task,
  draft: initial,
  categories,
  tags,
  onDone,
}: Loaded & { onDone: () => void }) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const today = localDateOf(clock.now());
  const ids = {
    date: useId(),
    time: useId(),
    category: useId(),
    tags: useId(),
    repeat: useId(),
  };

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      // A repeating task needs a start date; default to today.
      const dueDate = draft.dueDate || (draft.repeat.preset !== 'none' ? today : null);
      const tagIds = (await Promise.all(draft.tagNames.map((n) => tagsRepo.ensure(n)))).map(
        (t) => t.id,
      );
      const input: TaskInput = {
        title: draft.title,
        description: draft.description,
        dueDate,
        dueTime: dueDate && draft.dueTime ? draft.dueTime : null,
        priority: draft.priority,
        categoryId: draft.categoryId,
        tagIds,
        rrule: toRule(draft.repeat, dueDate),
      };
      const saved = task ? await tasksRepo.update(task.id, input) : await tasksRepo.create(input);
      await tasksRepo.saveChecklist(saved.id, draft.checklist);
      toast({ message: task ? 'Task saved' : 'Task added' });
      onDone();
    } catch (err) {
      setError(firstIssue(err) ?? "Couldn't save the task. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const dateChips: [string, LocalDate | ''][] = [
    ['Today', today],
    ['Tomorrow', addLocalDays(today, 1)],
    ['Next week', addLocalDays(today, 7)],
    ['No date', ''],
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-5"
    >
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger"
        >
          {error}
        </p>
      )}

      <Field label="Title">
        {(p) => (
          <Input
            {...p}
            autoFocus={!task}
            value={draft.title}
            maxLength={200}
            placeholder="What do you need to do?"
            onChange={(e) => set('title', e.target.value)}
          />
        )}
      </Field>

      <Section label="Date" htmlFor={ids.date}>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {dateChips.map(([label, value]) => (
            <button
              key={label}
              type="button"
              aria-pressed={draft.dueDate === value}
              onClick={() => set('dueDate', value)}
              className="h-8 rounded-full px-3 text-sm font-semibold transition-colors aria-pressed:bg-primary aria-pressed:text-on-primary not-aria-pressed:bg-surface-muted not-aria-pressed:text-fg-muted max-md:h-10"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            id={ids.date}
            type="date"
            value={draft.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
          />
          <div>
            <label htmlFor={ids.time} className="sr-only">
              Time (optional)
            </label>
            <Input
              id={ids.time}
              type="time"
              value={draft.dueTime}
              disabled={!draft.dueDate}
              onChange={(e) => set('dueTime', e.target.value)}
              aria-describedby={`${ids.time}-hint`}
            />
            <span id={`${ids.time}-hint`} className="sr-only">
              Optional time
            </span>
          </div>
        </div>
      </Section>

      <Section label="Priority">
        <SegmentedControl<string>
          label="Priority"
          value={String(draft.priority)}
          onChange={(v) => set('priority', Number(v) as Priority)}
          options={[
            { value: '0', label: 'None' },
            { value: '1', label: 'Low' },
            { value: '2', label: 'Medium' },
            { value: '3', label: 'High' },
          ]}
        />
      </Section>

      <div className="grid gap-5 md:grid-cols-2">
        <Section label="Category" htmlFor={ids.category}>
          <CategoryPicker
            id={ids.category}
            value={draft.categoryId}
            onChange={(v) => set('categoryId', v)}
            categories={categories}
          />
        </Section>
        <Section label="Repeat" htmlFor={ids.repeat}>
          <RepeatPicker
            id={ids.repeat}
            value={draft.repeat}
            onChange={(v) => set('repeat', v)}
            dueDate={draft.dueDate || null}
          />
        </Section>
      </div>

      <Section label="Tags" htmlFor={ids.tags}>
        <TagInput
          id={ids.tags}
          value={draft.tagNames}
          onChange={(v) => set('tagNames', v)}
          suggestions={tags.map((t) => t.name)}
        />
      </Section>

      <Section label="Checklist">
        <ChecklistEditor items={draft.checklist} onChange={(v) => set('checklist', v)} />
      </Section>

      <Field label="Notes">
        {(p) => (
          <Textarea
            {...p}
            value={draft.description}
            maxLength={5000}
            placeholder="Details, links, anything helpful"
            onChange={(e) => set('description', e.target.value)}
          />
        )}
      </Field>

      {task && <LinkedNotes item={{ type: 'task', id: task.id }} onOpen={onDone} />}

      {/* Sticky so Save is always reachable in a long form. */}
      <div className="sticky -bottom-4 z-10 -mx-5 flex flex-wrap items-center gap-2 border-t border-line bg-surface-raised px-5 pt-3 pb-4 md:-bottom-6 md:-mx-6 md:px-6 md:pb-6">
        {task && (
          <Button
            variant="ghost"
            icon={<Trash2 />}
            className="text-danger hover:text-danger"
            onClick={() => {
              onDone();
              void deleteTask(task);
            }}
          >
            Delete
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {task ? 'Save' : 'Add task'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Section({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const Tag = htmlFor ? 'label' : 'p';
  return (
    <div>
      <Tag {...(htmlFor ? { htmlFor } : {})} className="mb-1.5 block text-sm font-semibold">
        {label}
      </Tag>
      {children}
    </div>
  );
}
