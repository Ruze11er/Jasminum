import { afterEach, describe, expect, it } from 'vitest';
import { getSetting, setSetting } from '@/data/repos/settings';
import { AVOID_RECENT, getDailyQuote, pickQuote } from './dailyQuote';
import { QUOTE_CATEGORIES, QUOTES, type Quote } from './quotes';

// Vitest runs each file in its own process, so changing TZ here is safe.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
  .process.env;
const originalTZ = env.TZ;
afterEach(() => {
  env.TZ = originalTZ;
});

/** Local wall-clock time in whatever time zone is current. */
const local = (y: number, m: number, d: number, h = 12, min = 0, s = 0) =>
  new Date(y, m - 1, d, h, min, s).getTime();

describe('the quote collection', () => {
  it('has unique ids, an author and a known category for every quote', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(QUOTES.map((q) => q.id)).size).toBe(QUOTES.length);
    const categories = new Set(QUOTE_CATEGORIES.map((c) => c.id));
    for (const q of QUOTES) {
      expect(q.text.trim()).toBe(q.text);
      expect(q.text.length).toBeGreaterThan(5);
      expect(q.author.length).toBeGreaterThan(2);
      expect(categories.has(q.category)).toBe(true);
    }
    for (const c of QUOTE_CATEGORIES) {
      expect(QUOTES.filter((q) => q.category === c.id).length).toBeGreaterThanOrEqual(15);
    }
  });
});

describe('picking a quote', () => {
  const pool: Quote[] = Array.from({ length: 100 }, (_, i) => ({
    id: `q${i}`,
    text: `Quote ${i}`,
    author: 'A',
    category: i < 50 ? 'calm' : 'joy',
  }));

  it('uses only the enabled categories', () => {
    for (const r of [0, 0.5, 0.999]) {
      expect(pickQuote(pool, { categories: ['joy'], recent: [], random: () => r }).category).toBe(
        'joy',
      );
    }
  });

  it(`skips the last ${AVOID_RECENT} shown`, () => {
    const recent = pool.slice(0, 60).map((q) => q.id); // q0–q59
    for (const r of [0, 0.3, 0.999]) {
      const q = pickQuote(pool, { categories: [], recent, random: () => r });
      expect(Number(q.id.slice(1))).toBeGreaterThanOrEqual(60);
    }
  });

  it('falls back to the one shown longest ago when everything was shown recently', () => {
    const recent = pool.filter((q) => q.category === 'calm').map((q) => q.id); // newest first
    const q = pickQuote(pool, { categories: ['calm'], recent, random: () => 0 });
    expect(q.id).toBe(recent.at(-1));
  });
});

describe('the daily quote', () => {
  it('stays the same all day and changes after midnight', async () => {
    const morning = await getDailyQuote(local(2026, 11, 4, 0, 0, 1), () => 0.1);
    for (const [time, r] of [
      [local(2026, 11, 4, 9, 30), 0.9],
      [local(2026, 11, 4, 18, 0), 0.5],
      [local(2026, 11, 4, 23, 59, 59), 0.99],
    ] as const) {
      expect((await getDailyQuote(time, () => r)).quote.id).toBe(morning.quote.id);
    }
    expect(morning.date).toBe('2026-11-04');

    // Even with the same random number, the next day gives a different quote:
    // yesterday's is now among the recently shown.
    const nextDay = await getDailyQuote(local(2026, 11, 5, 0, 0, 1), () => 0.1);
    expect(nextDay.date).toBe('2026-11-05');
    expect(nextDay.quote.id).not.toBe(morning.quote.id);
    expect((await getSetting('recentQuoteIds')).slice(0, 2)).toEqual([
      nextDay.quote.id,
      morning.quote.id,
    ]);
  });

  it('does not repeat a quote for two months', async () => {
    const seen: string[] = [];
    for (let day = 1; day <= AVOID_RECENT; day++) {
      seen.push((await getDailyQuote(local(2026, 1, day), () => 0)).quote.id);
    }
    expect(new Set(seen).size).toBe(AVOID_RECENT);
  });

  it('gives two screens opening at the same moment the same quote', async () => {
    const now = local(2026, 11, 4, 8);
    const [a, b] = await Promise.all([
      getDailyQuote(now, () => 0.2),
      getDailyQuote(now, () => 0.8),
    ]);
    expect(a.quote.id).toBe(b.quote.id);
  });

  it("picks again the same day if today's category is switched off", async () => {
    const first = await getDailyQuote(local(2026, 11, 4, 8), () => 0);
    const other = QUOTE_CATEGORIES.find((c) => c.id !== first.quote.category)!.id;
    await setSetting('quoteCategories', [other]);
    const second = await getDailyQuote(local(2026, 11, 4, 9), () => 0);
    expect(second.quote.category).toBe(other);
  });

  it('follows local days across a daylight-saving change', async () => {
    env.TZ = 'America/New_York'; // clocks go back on Sunday, Nov 1, 2026
    const early = await getDailyQuote(local(2026, 11, 1, 0, 30), () => 0.3);
    const late = await getDailyQuote(local(2026, 11, 1, 23, 30), () => 0.7); // 24 h later on the clock, 25 h in reality
    expect(late.quote.id).toBe(early.quote.id);
    const monday = await getDailyQuote(local(2026, 11, 2, 0, 0, 30), () => 0.3);
    expect(monday.date).toBe('2026-11-02');
    expect(monday.quote.id).not.toBe(early.quote.id);
  });

  it("uses the device's local day when travelling across time zones", async () => {
    const instant = Date.UTC(2026, 10, 4, 22, 0); // 23:00 in Berlin, 17:00 in New York, 07:00 next day in Tokyo
    env.TZ = 'Europe/Berlin';
    const berlin = await getDailyQuote(instant, () => 0.4);
    expect(berlin.date).toBe('2026-11-04');

    env.TZ = 'America/New_York';
    const newYork = await getDailyQuote(instant + 60_000, () => 0.9);
    expect(newYork).toEqual(berlin); // still Nov 4 there: same quote

    env.TZ = 'Asia/Tokyo';
    const tokyo = await getDailyQuote(instant + 120_000, () => 0.4);
    expect(tokyo.date).toBe('2026-11-05');
    expect(tokyo.quote.id).not.toBe(berlin.quote.id);
  });
});
