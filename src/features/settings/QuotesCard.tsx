import { Quote } from 'lucide-react';
import { Card, CardHeader, toast } from '@/design-system';
import { setSetting, useSetting } from '@/data/repos/settings';
import { QUOTE_CATEGORIES, QUOTES } from '@/features/quotes/quotes';

/** Settings → Daily quote: which kinds of quotes appear on Home. */
export function QuotesCard() {
  const stored = useSetting('quoteCategories');
  // Nothing stored means every category.
  const enabled = stored.length ? stored : QUOTE_CATEGORIES.map((c) => c.id);

  const toggle = (id: string) => {
    const next = enabled.includes(id) ? enabled.filter((c) => c !== id) : [...enabled, id];
    if (!next.length) {
      toast({ tone: 'info', message: 'Keep at least one kind of quote.' });
      return;
    }
    void setSetting('quoteCategories', next.length === QUOTE_CATEGORIES.length ? [] : next);
  };

  return (
    <Card>
      <CardHeader title="Daily quote" icon={<Quote />} />
      <p className="mb-3 text-sm text-fg-muted">
        A new quote each day on Home, from the kinds you choose. All {QUOTES.length} are classic,
        public-domain words.
      </p>
      <div role="group" aria-label="Kinds of quotes" className="flex flex-wrap gap-1.5">
        {QUOTE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={enabled.includes(c.id)}
            onClick={() => toggle(c.id)}
            className="h-9 rounded-full px-3.5 text-sm font-semibold transition-colors aria-pressed:bg-primary aria-pressed:text-on-primary not-aria-pressed:bg-surface-muted not-aria-pressed:text-fg-muted max-md:h-11"
          >
            {c.label}
          </button>
        ))}
      </div>
    </Card>
  );
}
