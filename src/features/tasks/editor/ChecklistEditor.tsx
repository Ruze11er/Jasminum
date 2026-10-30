import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Checkbox } from '@/design-system';
import type { ChecklistDraft } from '@/data/repos/tasks';

/** Editable checklist inside the task form. Changes are saved with the task. */
export function ChecklistEditor({
  items,
  onChange,
}: {
  items: ChecklistDraft[];
  onChange: (items: ChecklistDraft[]) => void;
}) {
  const [text, setText] = useState('');
  const newRef = useRef<HTMLInputElement>(null);
  const update = (index: number, patch: Partial<ChecklistDraft>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const add = () => {
    const value = text.trim();
    if (!value) return;
    onChange([...items, { text: value, done: false }]);
    setText('');
    newRef.current?.focus();
  };

  return (
    <div className="space-y-1.5">
      {items.length > 0 && (
        <ul className="space-y-1.5" aria-label="Checklist items">
          {items.map((item, i) => (
            <li key={item.id ?? `new-${i}`} className="flex items-center gap-2">
              <Checkbox
                checked={item.done}
                onChange={(e) => update(i, { done: e.target.checked })}
                aria-label={`Done: ${item.text || 'item'}`}
              />
              <input
                value={item.text}
                onChange={(e) => update(i, { text: e.target.value })}
                aria-label={`Checklist item ${i + 1}`}
                maxLength={300}
                className="h-10 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-fg outline-none hover:border-line focus:border-brand"
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label={`Remove ${item.text || 'item'}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-surface-muted max-md:size-11"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center text-fg-subtle" aria-hidden="true">
          <Plus className="size-4" />
        </span>
        <input
          ref={newRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="Add a checklist item"
          aria-label="New checklist item"
          maxLength={300}
          className="h-10 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-fg outline-none placeholder:text-fg-subtle focus:bg-surface-muted"
        />
      </div>
    </div>
  );
}
