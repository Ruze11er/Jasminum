import { Lightbulb } from 'lucide-react';
import { Card, CardHeader, Checkbox } from '@/design-system';
import { insightsRepo } from '@/data/repos/insights';
import { setSetting, useSetting } from '@/data/repos/settings';
import { RULES } from '@/features/insights/engine/rules';

/** Settings → Insights: switch each kind of tip on or off. */
export function InsightsSettingsCard() {
  const prefs = useSetting('insightPrefs');
  const toggle = async (id: string, on: boolean) => {
    const disabledRules = on
      ? prefs.disabledRules.filter((r) => r !== id)
      : [...new Set([...prefs.disabledRules, id])];
    await setSetting('insightPrefs', { disabledRules });
    if (!on) await insightsRepo.removeRule(id);
  };

  return (
    <Card>
      <CardHeader title="Insights" icon={<Lightbulb />} />
      <p className="mb-3 text-sm text-fg-muted">
        Choose which tips appear on Home and the Insights page. They're worked out on this device
        from your own data.
      </p>
      <fieldset>
        <legend className="sr-only">Kinds of tips</legend>
        <ul className="grid gap-x-6 gap-y-3 md:grid-cols-2">
          {RULES.map((r) => (
            <li key={r.id}>
              <Checkbox
                checked={!prefs.disabledRules.includes(r.id)}
                onChange={(e) => void toggle(r.id, e.target.checked)}
                label={
                  <span>
                    <span className="block font-semibold">{r.name}</span>
                    <span className="block text-sm text-fg-muted">{r.description}</span>
                  </span>
                }
                className="items-start"
              />
            </li>
          ))}
        </ul>
      </fieldset>
    </Card>
  );
}
