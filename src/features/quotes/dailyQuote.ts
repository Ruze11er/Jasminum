import { db } from '@/data/db';
import { getSetting, setSetting } from '@/data/repos/settings';
import type { LocalDate } from '@/data/types';
import { clock } from '@/lib/clock';
import { localDateOf } from '@/lib/dates';
import { QUOTES, quoteById, type Quote, type QuoteCategory } from './quotes';

/** Quotes shown recently are skipped, so the same one doesn't come back for ~2 months. */
export const AVOID_RECENT = 60;

/**
 * Picks a quote from the enabled categories, avoiding the recently shown ones. If every
 * enabled quote was shown recently, the one shown longest ago is used. `random` is
 * injected so tests can be exact.
 */
export function pickQuote(
  quotes: Quote[],
  opts: { categories: string[]; recent: string[]; random?: () => number },
): Quote {
  const enabled = opts.categories.length
    ? quotes.filter((q) => opts.categories.includes(q.category))
    : quotes;
  const pool = enabled.length ? enabled : quotes;
  const recent = new Set(opts.recent.slice(0, AVOID_RECENT));
  const fresh = pool.filter((q) => !recent.has(q.id));
  if (!fresh.length) {
    // All seen lately: take the one seen longest ago.
    const order = new Map(opts.recent.map((id, i) => [id, i]));
    return [...pool].sort((a, b) => (order.get(b.id) ?? -1) - (order.get(a.id) ?? -1))[0]!;
  }
  const r = (opts.random ?? Math.random)();
  return fresh[Math.min(fresh.length - 1, Math.floor(r * fresh.length))]!;
}

/**
 * Today's quote. The first call on each local day picks one and saves it; later calls
 * that day return the same quote (also across reloads). A new day picks a new one. If
 * today's quote's category was switched off, a new one is picked.
 * Runs in one transaction, so two screens opening at once agree on the same quote.
 */
export async function getDailyQuote(
  now = clock.now(),
  random: () => number = Math.random,
): Promise<{ quote: Quote; date: LocalDate }> {
  const today = localDateOf(now);
  return db.transaction('rw', db.settings, async () => {
    const [saved, categories, recent] = await Promise.all([
      getSetting('dailyQuote'),
      getSetting('quoteCategories'),
      getSetting('recentQuoteIds'),
    ]);
    const current = saved?.date === today ? quoteById(saved.quoteId) : undefined;
    const allowed = (q: Quote) => !categories.length || categories.includes(q.category);
    if (current && allowed(current)) return { quote: current, date: today };

    const quote = pickQuote(QUOTES, { categories, recent, random });
    await setSetting('dailyQuote', { date: today, quoteId: quote.id });
    await setSetting(
      'recentQuoteIds',
      [quote.id, ...recent.filter((id) => id !== quote.id)].slice(0, 120),
    );
    return { quote, date: today };
  });
}

export const isQuoteCategory = (c: string): c is QuoteCategory =>
  ['motivation', 'learning', 'calm', 'kindness', 'joy'].includes(c);
