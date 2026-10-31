import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { csvCell, tasksToCsv } from './csv';
import { noteToMarkdown, safeFileName, tiptapToMarkdown } from './markdown';

const text = (t: string, marks?: string[], attrs?: Record<string, unknown>) => ({
  type: 'text',
  text: t,
  ...(marks ? { marks: marks.map((m) => ({ type: m, ...(m === 'link' ? { attrs } : {}) })) } : {}),
});
const p = (...content: unknown[]) => ({ type: 'paragraph', content });

describe('notes to Markdown', () => {
  it('converts headings, marks, lists, checklists, quotes and code', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [text('Key ideas')] },
        p(text('Plants make '), text('sugar', ['bold']), text(' from '), text('light', ['italic'])),
        { type: 'bulletList', content: [{ type: 'listItem', content: [p(text('Chloroplasts'))] }] },
        {
          type: 'orderedList',
          attrs: { start: 3 },
          content: [{ type: 'listItem', content: [p(text('Third'))] }],
        },
        {
          type: 'taskList',
          content: [
            { type: 'taskItem', attrs: { checked: true }, content: [p(text('Read'))] },
            { type: 'taskItem', attrs: { checked: false }, content: [p(text('Ask'))] },
          ],
        },
        { type: 'blockquote', content: [p(text('Quoted'))] },
        { type: 'codeBlock', content: [{ type: 'text', text: 'x = 1' }] },
        p(
          text('site', ['link'], { href: 'https://example.com' }),
          text(' '),
          text('a_b', ['code']),
        ),
        p(text('bad', ['link'], { href: 'javascript:alert(1)' })),
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe(
      [
        '## Key ideas',
        'Plants make **sugar** from *light*',
        '- Chloroplasts',
        '3. Third',
        '- [x] Read\n- [ ] Ask',
        '> Quoted',
        '```\nx = 1\n```',
        '[site](https://example.com) `a_b`',
        'bad',
      ].join('\n\n'),
    );
  });

  it('escapes formatting characters and falls back to plain text', () => {
    expect(tiptapToMarkdown({ type: 'doc', content: [p(text('2*3 [x]'))] })).toBe('2\\*3 \\[x\\]');
    expect(tiptapToMarkdown(null)).toBe('');
    const note = {
      title: '',
      contentText: 'Shopping\nmilk',
      contentJson: null,
    } as Parameters<typeof noteToMarkdown>[0];
    expect(noteToMarkdown(note, ['home stuff'])).toBe(
      '# Shopping\n\nShopping\nmilk\n\n#home-stuff\n',
    );
  });

  it('makes safe file names', () => {
    expect(safeFileName('a/b:c*?.md')).toBe('a b c .md');
    expect(safeFileName('...')).toBe('Untitled');
  });
});

describe('tasks to CSV', () => {
  it('quotes values, blocks formulas and starts with a BOM for Excel', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a, "b"')).toBe('"a, ""b"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell(null)).toBe('');

    const task = {
      id: 't',
      title: 'Lab, report',
      status: 'todo',
      priority: 3,
      dueDate: '2026-11-05',
      dueTime: '09:00',
      categoryId: 'c',
      tagIds: ['g'],
      rrule: null,
      description: 'line1\nline2',
      createdAt: Date.UTC(2026, 10, 1),
      completedAt: null,
    } as unknown as Task;
    const csv = tasksToCsv(
      [task],
      new Map([['c', { name: 'School' }]]),
      new Map([['g', { name: 'bio' }]]),
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [header, row] = csv.slice(1).trimEnd().split('\r\n');
    expect(header).toBe(
      'Title,Status,Priority,Due date,Due time,Category,Tags,Repeats,Notes,Created,Completed',
    );
    expect(row).toBe(
      '"Lab, report",To do,High,2026-11-05,09:00,School,bio,,"line1\nline2",2026-11-01T00:00:00.000Z,',
    );
  });
});
