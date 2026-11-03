import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ShieldCheck } from 'lucide-react';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg">{title}</h2>
      <div className="space-y-2 text-fg">{children}</div>
    </section>
  );
}

/** The one-paragraph promise at the top of the policy. */
export function PolicySummary() {
  return (
    <p className="flex items-start gap-3 rounded-xl bg-primary-soft p-4 font-semibold text-primary-soft-fg">
      <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      Jasminum collects nothing. Your tasks, notes, events and files stay in this browser on this
      device. There are no accounts, no analytics, no ads and no trackers.
    </p>
  );
}

/**
 * The privacy policy, shared by the Privacy page and the first-run agreement screen.
 * `links: false` shows page names as plain text (the agreement screen covers the app).
 */
export function PolicySections({ links = true }: { links?: boolean }) {
  const trash = links ? (
    <Link to="/trash" className="font-semibold text-link underline">
      Trash
    </Link>
  ) : (
    <strong>Trash</strong>
  );

  return (
    <>
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
          Nothing about you. Once loaded, Jasminum works fully offline and makes no requests of its
          own. The only traffic is your browser downloading the app itself (and later updates) from
          the website, like any web page. The hosting provider may keep standard technical logs of
          those downloads (such as IP address and time), which we don't use.
        </p>
        <p>
          If you open a link from one of your notes, it opens in your browser like any other link,
          and that website's own privacy policy applies.
        </p>
      </Section>

      <Section title="Permissions">
        <p>
          Notifications (for reminders), persistent storage and the app badge are only used on this
          device, and only if you allow them. You can turn them off in your browser settings at any
          time.
        </p>
      </Section>

      <Section title="Backups and exports">
        <p>
          Backup files are created on your device and saved wherever you choose. If you protect a
          backup with a passphrase, it's encrypted (AES-256) and can't be opened without it. Exports
          (Markdown, CSV) are plain, readable files.
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
          Deleted items go to the {trash} and are erased for good after 30 days, or straight away if
          you empty it. Before a restore, the app keeps a safety copy of your data so the restore
          can be undone. That copy is erased after 7 days, or as soon as you erase something for
          good. To erase everything, use{' '}
          <strong>Settings → Backup &amp; data → Delete everything</strong>, or clear this site's
          data in your browser settings. Make a backup first if you might want it back.
        </p>
      </Section>

      <Section title="Children">
        <p>Jasminum doesn't knowingly collect data from anyone. It doesn't collect data at all.</p>
      </Section>

      <Section title="Your agreement">
        <p>
          The first time you open Jasminum, you're asked to agree to this policy. Only the fact that
          you agreed, the policy version and the date are saved, in this browser on this device.
          Deleting everything also removes it, so you'll be asked again.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes, the date at the top changes too, and you'll be asked to read and
          agree to the new version. The promise that your data stays on your device won't change.
        </p>
      </Section>
    </>
  );
}
