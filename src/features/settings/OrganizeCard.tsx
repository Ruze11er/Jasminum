import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Shapes, X } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  Chip,
  Input,
  chipColors,
  toast,
  type ChipColor,
} from '@/design-system';
import { categoriesRepo } from '@/data/repos/categories';
import { tagsRepo } from '@/data/repos/tags';
import { firstIssue } from '@/lib/validation';

/** Add and remove categories and tags. Removing moves them to the Trash (with Undo). */
export function OrganizeCard() {
  const categories = useLiveQuery(() => categoriesRepo.listActive(), []);
  const tags = useLiveQuery(() => tagsRepo.listActive(), []);
  const [name, setName] = useState('');

  const addCategory = async () => {
    try {
      const palette = chipColors.filter((c) => c !== 'neutral');
      await categoriesRepo.create({
        name,
        color: palette[(categories?.length ?? 0) % palette.length],
        order: categories?.length ?? 0,
      });
      setName('');
    } catch (err) {
      toast({ tone: 'error', message: firstIssue(err) ?? "Couldn't add the category" });
    }
  };

  const remove = async (kind: 'category' | 'tag', id: string, label: string) => {
    const repo = kind === 'category' ? categoriesRepo : tagsRepo;
    await repo.softDelete(id);
    toast({
      message: `Removed "${label}"`,
      action: { label: 'Undo', onClick: () => void repo.restore(id) },
    });
  };

  return (
    <Card>
      <CardHeader title="Categories & tags" icon={<Shapes />} />
      <p className="mb-2 text-sm font-semibold">Categories</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {categories?.length === 0 && <p className="text-sm text-fg-muted">No categories yet.</p>}
        {categories?.map((c) => (
          <Chip
            key={c.id}
            color={c.color as ChipColor}
            onRemove={() => void remove('category', c.id, c.name)}
          >
            {c.name}
          </Chip>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void addCategory();
        }}
      >
        <label htmlFor="new-category" className="sr-only">
          New category name
        </label>
        <Input
          id="new-category"
          value={name}
          maxLength={30}
          placeholder="New category, e.g. School"
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={!name.trim()}>
          Add
        </Button>
      </form>

      <p className="mt-5 mb-2 text-sm font-semibold">Tags</p>
      <div className="flex flex-wrap gap-2">
        {tags?.length === 0 && (
          <p className="text-sm text-fg-muted">No tags yet. Add them to tasks with #name.</p>
        )}
        {tags?.map((t) => (
          <span
            key={t.id}
            className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-muted pr-1 pl-2.5 text-sm font-semibold text-fg-muted"
          >
            #{t.name}
            <button
              type="button"
              onClick={() => void remove('tag', t.id, t.name)}
              aria-label={`Remove tag ${t.name}`}
              className="flex size-5 items-center justify-center rounded-full hover:bg-black/10"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
    </Card>
  );
}
