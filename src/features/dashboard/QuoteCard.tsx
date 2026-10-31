import { useEffect, useState } from 'react';
import { Quote as QuoteIcon } from 'lucide-react';
import { Card } from '@/design-system';
import { useSetting } from '@/data/repos/settings';
import { useToday } from '@/lib/useToday';
import { getDailyQuote } from '@/features/quotes/dailyQuote';
import type { Quote } from '@/features/quotes/quotes';

/** Today's quote. Picked once per local day; changes after midnight, even if Home stays open. */
export function QuoteCard() {
  const today = useToday();
  const categories = useSetting('quoteCategories');
  const [quote, setQuote] = useState<Quote | null>(null);
  const categoryKey = categories.join(',');

  useEffect(() => {
    let cancelled = false;
    void getDailyQuote().then(({ quote: q }) => !cancelled && setQuote(q));
    return () => {
      cancelled = true;
    };
  }, [today, categoryKey]);

  return (
    <Card tone="pink" className="relative overflow-hidden">
      <QuoteIcon
        className="absolute -top-1 -right-1 size-20 rotate-180 opacity-10"
        aria-hidden="true"
      />
      <h2 className="text-xs font-bold tracking-wider uppercase opacity-80">Quote of the day</h2>
      {quote ? (
        <figure className="mt-2">
          <blockquote className="font-display text-lg leading-snug font-semibold whitespace-pre-line md:text-xl">
            “{quote.text}”
          </blockquote>
          <figcaption className="mt-2 text-sm">
            — {quote.author}
            {quote.source && <span className="opacity-80">, {quote.source}</span>}
          </figcaption>
        </figure>
      ) : (
        <div aria-busy="true" aria-label="Loading quote" className="mt-2 h-14" />
      )}
    </Card>
  );
}
