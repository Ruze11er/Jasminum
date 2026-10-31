import { ChevronDown } from 'lucide-react';

/** Settings → Backup & data: how to move everything to a new phone or computer. */
export function TransferGuide() {
  return (
    <details className="group py-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-semibold">Move to a new device</span>
          <span className="block text-sm text-fg-muted">Four steps, no account needed.</span>
        </span>
        <ChevronDown
          className="size-5 shrink-0 text-fg-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
        <li>
          <strong>Back up on this device</strong> with <em>Back up now</em> above. Add a passphrase
          if the file will travel by email or a cloud drive.
        </li>
        <li>
          <strong>Send the file to the new device</strong>: AirDrop, Nearby Share, a USB cable, a
          cloud drive or an email to yourself.
        </li>
        <li>
          <strong>Open Jasminum on the new device</strong> and install it first. On iPhone and iPad,
          the home-screen app and Safari keep separate data, so restore in the one you'll use.
        </li>
        <li>
          <strong>Restore</strong>: Settings → <em>Restore from file</em>, pick the backup, then
          choose <em>Replace everything</em> on a fresh device.
        </li>
      </ol>
      <p className="mt-3 text-sm text-fg-muted">
        The old device keeps its own copy. The two don't sync, so changes on one won't show on the
        other.
      </p>
    </details>
  );
}
