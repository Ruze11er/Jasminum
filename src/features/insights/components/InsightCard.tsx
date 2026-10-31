import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Info, Lightbulb, MoreHorizontal, Trophy, type LucideIcon } from 'lucide-react';
import { Button, IconButton, toast } from '@/design-system';
import { insightsRepo } from '@/data/repos/insights';
import { getSetting, setSetting } from '@/data/repos/settings';
import type { Insight } from '@/data/types';
import { cn } from '@/lib/cn';
import { runInsightAction } from '../actions';
import { RULES } from '../engine/rules';
import type { InsightAction, InsightTone } from '../engine/types';

interface Payload {
  tone: InsightTone;
  title: string;
  why: string;
  actions: InsightAction[];
}

const TONES: Record<InsightTone, { icon: LucideIcon; classes: string }> = {
  action: { icon: Lightbulb, classes: 'bg-primary-soft text-primary-soft-fg' },
  info: { icon: Info, classes: 'bg-info-soft text-info' },
  positive: { icon: Trophy, classes: 'bg-success-soft text-success' },
};

/**
 * One insight: an icon, the message, a "why" hint, up to two buttons, and a "More" menu
 * with Dismiss, Snooze 1 week and "Don't show this type".
 */
export function InsightCard({ insight }: { insight: Insight }) {
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const p = insight.payload as unknown as Payload;
  const tone = TONES[p.tone] ?? TONES.info;
  const Icon = tone.icon;
  const rule = RULES.find((r) => r.id === insight.ruleId);
  const menuId = `insight-menu-${insight.id}`;

  const act = async (action: InsightAction) => {
    setBusy(true);
    try {
      await runInsightAction(insight, action, navigate);
    } catch {
      toast({ tone: 'error', message: "That didn't work. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    await insightsRepo.dismiss(insight.id);
    toast({
      message: 'Insight dismissed',
      action: { label: 'Undo', onClick: () => void insightsRepo.reactivate(insight.id) },
    });
  };
  const snooze = async () => {
    await insightsRepo.snooze(insight.id);
    toast({
      message: "Snoozed. It'll come back in a week if it still applies.",
      action: { label: 'Undo', onClick: () => void insightsRepo.reactivate(insight.id) },
    });
  };
  const hideType = async () => {
    const prefs = await getSetting('insightPrefs');
    await setSetting('insightPrefs', {
      disabledRules: [...new Set([...prefs.disabledRules, insight.ruleId])],
    });
    await insightsRepo.removeRule(insight.ruleId);
    toast({
      message: `"${rule?.name ?? 'These'}" tips are off. Turn them back on in Settings.`,
      action: {
        label: 'Undo',
        onClick: async () => {
          const now = await getSetting('insightPrefs');
          await setSetting('insightPrefs', {
            disabledRules: now.disabledRules.filter((r) => r !== insight.ruleId),
          });
        },
      },
    });
  };

  return (
    <article
      aria-labelledby={`insight-${insight.id}`}
      className="rounded-2xl border border-line bg-surface p-4 shadow-soft-sm"
    >
      <div className="flex gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl [&>svg]:size-[18px]',
            tone.classes,
          )}
        >
          <Icon />
        </span>
        <div className="min-w-0 flex-1">
          <h3
            id={`insight-${insight.id}`}
            className="font-sans text-[0.95rem] font-bold break-words"
          >
            {p.title}
          </h3>
          <p className="mt-0.5 text-sm text-fg-muted">{p.why}</p>
        </div>
        <IconButton
          label={`More options for: ${p.title}`}
          icon={<MoreHorizontal />}
          aria-expanded={menu}
          aria-controls={menuId}
          onClick={() => setMenu((m) => !m)}
          className="-mt-1 -mr-1 size-9"
        />
      </div>

      {p.actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 pl-12">
          {p.actions.slice(0, 2).map((a, i) => (
            <Button
              key={a.label}
              size="sm"
              variant={i === 0 ? 'secondary' : 'ghost'}
              disabled={busy}
              onClick={() => void act(a)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}

      {menu && (
        <div
          id={menuId}
          role="group"
          aria-label="Insight options"
          className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3 pl-12"
        >
          <Button size="sm" variant="ghost" onClick={() => void dismiss()}>
            Dismiss
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void snooze()}>
            Snooze 1 week
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void hideType()}>
            Don't show this type
          </Button>
        </div>
      )}
    </article>
  );
}
