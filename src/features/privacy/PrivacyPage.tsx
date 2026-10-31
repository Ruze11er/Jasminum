import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ShieldCheck } from 'lucide-react';
import { Card, PageHeader } from '@/design-system';

const UPDATED = 'October 31, 2026';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg">{title}</h2>
      <div className="space-y-2 text-fg">{children}</div>
    </section>
  );
}

/** The privacy promise, in plain words. Linked from Settings and the welcome card. */
export default function PrivacyPage() {
  return (
    <>
      <PageHeader title="Privacy" subtitle={`Last updated ${UPDATED}`} />
      <Card className="space-y-6">
        <p className="flex items-start gap-3 rounded-xl bg-primary-soft p-4 font-semibold text-primary-soft-fg">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          Jasminum collects nothing. Your tasks, notes, events and files stay in this browser on
          this device. There are no accounts, no analytics, no ads and no trackers.
        </p>

        <Section title="Where your data lives">
          <p>
            Everything you add is stored by your browser on this device (in IndexedDB and the Origin
            Private File System). It never leaves the device unless you export a backup or share a
            file yourself. Nobody else, including the people who make Jasminum, can see it.
          </p>
          <p>
            Each browser keeps its own copy. On iPhone and iPad, the Home Screen app and Safari tabs
            have separate storage.
          </p>
        </Section>

        <Section title="What the app sends over the internet">
          <p>
            Nothing about you. Once loaded, Jasminum works fully offline and makes no requests of
            its own. The only traffic is your browser downloading the app itself (and later updates)
            from the website, like any web page. The hosting provider may keep standard technical
            logs of those downloads (such as IP address and time), which we don't use.
          </p>
        </Section>

        <Section title="Permissions">
          <p>
            Notifications (for reminders), persistent storage and the app badge are only used on
            this device, and only if you allow them. You can turn them off in your browser settings
            at any time.
          </p>
        </Section>

        <Section title="Backups and exports">
          <p>
            Backup files are created on your device and saved wherever you choose. If you protect a
            backup with a passphrase, it's encrypted (AES-256) and can't be opened without it.
            Exports (Markdown, CSV) are plain, readable files.
          </p>
        </Section>

        <Section title="App lock">
          <p>
            The optional PIN lock is a privacy screen against people using your device. Only a
            scrambled (hashed) form of the PIN is stored. It doesn't encrypt your data.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            Deleted items go to the{' '}
            <Link to="/trash" className="font-semibold text-link underline">
              Trash
            </Link>{' '}
            and are erased for good after 30 days, or straight away if you empty it. Before a
            restore, the app keeps a safety copy of your data so the restore can be undone. That
            copy is erased after 7 days, or as soon as you erase something for good. To erase
            everything, use <strong>Settings → Backup &amp; data → Delete everything</strong>, or
            clear this site's data in your browser settings. Make a backup first if you might want
            it back.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Jasminum doesn't knowingly collect data from anyone. It doesn't collect data at all.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If this page changes, the date at the top changes too. The promise that your data stays
            on your device won't.
          </p>
        </Section>
      </Card>
    </>
  );
}
