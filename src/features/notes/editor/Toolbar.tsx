import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface Tool {
  label: string;
  /** Shown in the tooltip, e.g. "Ctrl+B". */
  keys?: string;
  icon: ReactNode;
  active?: (e: Editor) => boolean;
  run: (e: Editor) => void;
  disabled?: (e: Editor) => boolean;
}

const mod =
  typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform) ? '⌘' : 'Ctrl+';

const groups: Tool[][] = [
  [
    {
      label: 'Bold',
      keys: `${mod}B`,
      icon: <Bold />,
      active: (e) => e.isActive('bold'),
      run: (e) => e.chain().focus().toggleBold().run(),
    },
    {
      label: 'Italic',
      keys: `${mod}I`,
      icon: <Italic />,
      active: (e) => e.isActive('italic'),
      run: (e) => e.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Underline',
      keys: `${mod}U`,
      icon: <Underline />,
      active: (e) => e.isActive('underline'),
      run: (e) => e.chain().focus().toggleUnderline().run(),
    },
    {
      label: 'Strikethrough',
      icon: <Strikethrough />,
      active: (e) => e.isActive('strike'),
      run: (e) => e.chain().focus().toggleStrike().run(),
    },
  ],
  [
    {
      label: 'Heading',
      icon: <Heading2 />,
      active: (e) => e.isActive('heading', { level: 2 }),
      run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'Subheading',
      icon: <Heading3 />,
      active: (e) => e.isActive('heading', { level: 3 }),
      run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    },
  ],
  [
    {
      label: 'Bulleted list',
      icon: <List />,
      active: (e) => e.isActive('bulletList'),
      run: (e) => e.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Numbered list',
      icon: <ListOrdered />,
      active: (e) => e.isActive('orderedList'),
      run: (e) => e.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'Checklist',
      icon: <ListChecks />,
      active: (e) => e.isActive('taskList'),
      run: (e) => e.chain().focus().toggleTaskList().run(),
    },
    {
      label: 'Quote',
      icon: <Quote />,
      active: (e) => e.isActive('blockquote'),
      run: (e) => e.chain().focus().toggleBlockquote().run(),
    },
    {
      label: 'Code',
      icon: <Code />,
      active: (e) => e.isActive('codeBlock'),
      run: (e) => e.chain().focus().toggleCodeBlock().run(),
    },
  ],
  [
    {
      label: 'Undo',
      keys: `${mod}Z`,
      icon: <Undo2 />,
      run: (e) => e.chain().focus().undo().run(),
      disabled: (e) => !e.can().undo(),
    },
    {
      label: 'Redo',
      keys: `${mod}Shift+Z`,
      icon: <Redo2 />,
      run: (e) => e.chain().focus().redo().run(),
      disabled: (e) => !e.can().redo(),
    },
  ],
];

const tools = groups.flat();

/** Formatting buttons. One tab stop; arrow keys move between buttons (toolbar pattern). */
export function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      tools.map((t) => [t.active?.(e) ?? false, t.disabled?.(e) ?? false]),
  });
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusAt = (i: number) => refs.current[(i + tools.length) % tools.length]?.focus();

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const moves: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowLeft: i - 1,
      Home: 0,
      End: tools.length - 1,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    focusAt(moves[e.key]!);
  };

  let index = 0;
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5 rounded-xl bg-surface-muted p-1"
    >
      {groups.map((group, g) => (
        <div key={g} className={cn('flex gap-0.5', g > 0 && 'border-l border-line pl-0.5')}>
          {group.map((tool) => {
            const i = index++;
            const [active, disabled] = state[i] ?? [false, false];
            return (
              <button
                key={tool.label}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                tabIndex={i === 0 ? 0 : -1}
                aria-label={tool.label}
                title={tool.keys ? `${tool.label} (${tool.keys})` : tool.label}
                aria-pressed={tool.active ? active : undefined}
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()} // keep the text selection
                onClick={() => tool.run(editor)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  'flex size-9 items-center justify-center rounded-lg transition-colors disabled:opacity-40 max-md:size-10 [&>svg]:size-[18px]',
                  active
                    ? 'bg-surface text-primary-soft-fg shadow-soft-sm dark:bg-surface-raised dark:text-primary'
                    : 'text-fg-muted hover:bg-surface hover:text-fg',
                )}
              >
                {tool.icon}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
