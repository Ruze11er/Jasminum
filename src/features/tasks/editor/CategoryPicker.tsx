import { useState } from 'react';
import { Button, Input, Select, chipColors, toast } from '@/design-system';
import { categoriesRepo } from '@/data/repos/categories';
import type { Category } from '@/data/types';
import { firstIssue } from '@/lib/validation';

const NEW = '__new__';

/** Category dropdown with an inline "New category…" option. */
export function CategoryPicker({
  id,
  value,
  onChange,
  categories,
}: {
  id: string;
  value: string | null;
  onChange: (id: string | null) => void;
  categories: Category[];
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const create = async () => {
    try {
      // Rotate through the palette so new categories look different from each other.
      const color = chipColors.filter((c) => c !== 'neutral')[categories.length % 6];
      const cat = await categoriesRepo.create({ name, color, order: categories.length });
      onChange(cat.id);
      setCreating(false);
      setName('');
    } catch (err) {
      toast({ tone: 'error', message: firstIssue(err) ?? "Couldn't create the category" });
    }
  };

  if (creating) {
    return (
      <div className="flex gap-2">
        <Input
          id={id}
          autoFocus
          value={name}
          maxLength={30}
          placeholder="e.g. School, Work, Home"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void create();
            } else if (e.key === 'Escape') {
              e.stopPropagation();
              setCreating(false);
            }
          }}
        />
        <Button onClick={() => void create()} disabled={!name.trim()}>
          Add
        </Button>
        <Button variant="ghost" onClick={() => setCreating(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Select
      id={id}
      value={value ?? ''}
      onChange={(e) => {
        if (e.target.value === NEW) setCreating(true);
        else onChange(e.target.value || null);
      }}
    >
      <option value="">No category</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      <option value={NEW}>＋ New category…</option>
    </Select>
  );
}
