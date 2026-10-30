import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Input, toast } from '@/design-system';
import { tagsRepo } from '@/data/repos/tags';
import { tasksRepo } from '@/data/repos/tasks';
import type { LocalDate } from '@/data/types';
import { firstIssue } from '@/lib/validation';
import { parseQuickAdd } from '../quickAddParse';

/** One-line task entry at the top of the list. Enter saves; "#word" adds a tag. */
export function QuickAddTask({
  dueDate,
  categoryId,
}: {
  dueDate: LocalDate | null;
  categoryId?: string | null;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const { title, tagNames } = parseQuickAdd(value);
    if (!title || busy) return;
    setBusy(true);
    try {
      const tags = await Promise.all(tagNames.map((n) => tagsRepo.ensure(n)));
      await tasksRepo.create({
        title,
        dueDate,
        categoryId: categoryId ?? null,
        tagIds: tags.map((t) => t.id),
      });
      setValue('');
    } catch (err) {
      toast({ tone: 'error', message: firstIssue(err) ?? "Couldn't add the task" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label htmlFor="quick-add-task" className="sr-only">
        Add a task
      </label>
      <Input
        id="quick-add-task"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        leadingIcon={<Plus />}
        placeholder="Add a task… (use #tag for tags)"
        enterKeyHint="done"
        autoComplete="off"
        maxLength={300}
      />
    </form>
  );
}
