import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button, Sheet, toast } from '@/design-system';
import { checkIntegrity, fixIntegrity, isClean, type IntegrityReport } from '@/data/integrity';
import { formatBytes } from '@/lib/format';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Runs the integrity check and offers to fix what it finds. */
export default function IntegrityDialog({ onClose }: { onClose: () => void }) {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [fixing, setFixing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void checkIntegrity().then((r) => !cancelled && setReport(r));
    return () => {
      cancelled = true;
    };
  }, []);

  const fix = async () => {
    if (!report) return;
    setFixing(true);
    try {
      const r = await fixIntegrity(report);
      const parts = [
        r.removedFiles && `freed ${formatBytes(r.freedBytes)}`,
        r.flaggedMissing &&
          plural(r.flaggedMissing, 'file marked as missing', 'files marked as missing'),
        r.removedLinks && plural(r.removedLinks, 'broken link removed', 'broken links removed'),
        r.removedChecklistItems &&
          plural(
            r.removedChecklistItems,
            'stray checklist item removed',
            'stray checklist items removed',
          ),
      ].filter(Boolean);
      toast({ message: `Fixed: ${parts.join(', ')}` });
      onClose();
    } finally {
      setFixing(false);
    }
  };

  const findings = report
    ? [
        report.orphanFiles.length > 0 &&
          `${plural(report.orphanFiles.length, 'stored file isn’t', 'stored files aren’t')} used by anything in your library (${formatBytes(report.orphanFiles.reduce((n, f) => n + f.size, 0))}). They can be removed.`,
        report.missingFiles.length > 0 &&
          `${plural(report.missingFiles.length, 'file is', 'files are')} missing their contents. They'll be marked so you can restore them from a backup or delete them.`,
        report.danglingLinks.length > 0 &&
          `${plural(report.danglingLinks.length, 'link points', 'links point')} to items that no longer exist.`,
        report.orphanChecklistItems.length > 0 &&
          `${plural(report.orphanChecklistItems.length, 'checklist item belongs', 'checklist items belong')} to tasks that no longer exist.`,
      ].filter((f): f is string => !!f)
    : [];

  return (
    <Sheet open onOpenChange={(o) => !o && !fixing && onClose()} title="Check for problems">
      <div className="space-y-4 pb-2">
        {!report ? (
          <p aria-live="polite" className="flex items-center gap-2 py-6 font-semibold">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            Checking your data…
          </p>
        ) : isClean(report) ? (
          <>
            <p className="flex items-center gap-2 rounded-xl bg-success-soft p-4 font-semibold">
              <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
              Everything looks good.
            </p>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </>
        ) : (
          <>
            <ul className="list-disc space-y-2 pl-5" aria-label="Problems found">
              {findings.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={fixing}>
                Not now
              </Button>
              <Button onClick={() => void fix()} disabled={fixing}>
                Fix problems
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
