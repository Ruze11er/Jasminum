import { useId, useState } from 'react';
import { Chip } from '@/design-system';
import { normalizeTagName } from '@/data/repos/tags';
import { cn } from '@/lib/cn';

/**
 * Tag chips plus a text box. Enter or comma adds a tag; Backspace in an empty box removes
 * the last one. Existing tags are suggested as you type.
 */
export function TagInput({
  value,
  onChange,
  suggestions,
  id,
}: {
  value: string[];
  onChange: (names: string[]) => void;
  suggestions: string[];
  id?: string;
}) {
  const [text, setText] = useState('');
  const listId = useId();
  const has = (name: string) =>
    value.some((v) => normalizeTagName(v).key === normalizeTagName(name).key);

  const add = (raw: string) => {
    const name = normalizeTagName(raw).display;
    if (name && !has(name)) onChange([...value, name]);
    setText('');
  };

  return (
    <div
      className={cn(
        'flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border-[1.5px] border-line bg-surface px-2 py-1.5',
        'focus-within:border-brand focus-within:ring-[3px] focus-within:ring-ring',
      )}
    >
      {value.map((name) => (
        <Chip key={name} color="pink" onRemove={() => onChange(value.filter((v) => v !== name))}>
          #{name}
        </Chip>
      ))}
      <input
        id={id}
        value={text}
        list={listId}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(',')) add(v.slice(0, -1));
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(text);
          } else if (e.key === 'Backspace' && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => text && add(text)}
        placeholder={value.length ? 'Add another…' : 'Type a tag and press Enter'}
        className="h-8 min-w-32 flex-1 bg-transparent px-1.5 text-fg outline-none placeholder:text-fg-subtle"
        autoComplete="off"
        maxLength={40}
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !has(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}
