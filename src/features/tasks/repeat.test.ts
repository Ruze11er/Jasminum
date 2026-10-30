import { describe, expect, it } from 'vitest';
import { parseRecurrence } from '@/lib/recurrence';
import { NO_REPEAT, presetLabels, repeatFromRule, toRule, type RepeatState } from './repeat';
import { parseQuickAdd } from './quickAddParse';

const FRIDAY = '2026-10-30';

describe('repeat picker mapping', () => {
  it.each<RepeatState['preset']>(['daily', 'weekdays', 'weekly', 'monthly', 'yearly'])(
    'round-trips the %s preset',
    (preset) => {
      const rule = toRule({ ...NO_REPEAT, preset }, FRIDAY);
      expect(rule).not.toBeNull();
      expect(repeatFromRule(rule).preset).toBe(preset);
    },
  );

  it('round-trips a custom rule', () => {
    const state: RepeatState = {
      preset: 'custom',
      interval: 2,
      unit: 'WEEKLY',
      byDay: ['TU', 'TH'],
      until: null,
    };
    const rule = toRule(state, FRIDAY);
    expect(parseRecurrence(rule!)).toMatchObject({
      freq: 'WEEKLY',
      interval: 2,
      byDay: ['TU', 'TH'],
    });
    expect(repeatFromRule(rule)).toEqual(state);
  });

  it('clamps custom intervals and drops weekdays for non-weekly units', () => {
    const rule = toRule(
      { preset: 'custom', interval: 500, unit: 'DAILY', byDay: ['MO'], until: null },
      FRIDAY,
    );
    expect(parseRecurrence(rule!)).toMatchObject({ freq: 'DAILY', interval: 99, byDay: [] });
  });

  it('needs a date', () => {
    expect(toRule({ ...NO_REPEAT, preset: 'daily' }, null)).toBeNull();
    expect(toRule(NO_REPEAT, FRIDAY)).toBeNull();
  });

  it('labels presets with the task date', () => {
    const labels = presetLabels(FRIDAY);
    expect(labels.weekly).toBe('Every week on Fri');
    expect(labels.monthly).toBe('Every month on the 30th');
    expect(labels.weekdays).toBe('Every weekday');
  });
});

describe('quick add parsing', () => {
  it('pulls #tags out of the title', () => {
    expect(parseQuickAdd('Revise #biology chapter 3 #exam-prep')).toEqual({
      title: 'Revise chapter 3',
      tagNames: ['biology', 'exam-prep'],
    });
    expect(parseQuickAdd('Fix issue#4')).toEqual({ title: 'Fix issue#4', tagNames: [] });
    expect(parseQuickAdd('   ')).toEqual({ title: '', tagNames: [] });
  });
});
