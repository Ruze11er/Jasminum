import { Card, PageHeader } from '@/design-system';
import { PolicySections, PolicySummary } from './PolicyContent';
import { policyUpdatedLabel } from './version';

/** The privacy policy, in plain words. Linked from Settings and the welcome card. */
export default function PrivacyPage() {
  return (
    <>
      <PageHeader title="Privacy Policy" subtitle={`Last updated ${policyUpdatedLabel()}`} />
      <Card className="space-y-6">
        <PolicySummary />
        <PolicySections />
      </Card>
    </>
  );
}
