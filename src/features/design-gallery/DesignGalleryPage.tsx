import { useState, type ReactNode } from 'react';
import { BookOpen, Heart, Plus, Search, Star, Tag, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  Checkbox,
  Chip,
  chipColors,
  EmptyState,
  Field,
  IconButton,
  Input,
  LinkCard,
  PageHeader,
  ProgressRing,
  SegmentedControl,
  Sheet,
  Textarea,
} from '@/design-system';

const swatches = [
  ['pink-50', '#FFF5F8'],
  ['pink-100', '#FFE4EE'],
  ['pink-200', '#FFCCDD'],
  ['pink-300', '#FBA8C4'],
  ['pink-400', '#F47FA6'],
  ['pink-500', '#E85A8A'],
  ['pink-600', '#D13D72'],
  ['pink-700', '#B02A5B'],
  ['pink-800', '#8A1F47'],
  ['pink-900', '#5E1631'],
] as const;

const semantic = [
  'bg',
  'surface',
  'surface-muted',
  'line',
  'primary',
  'primary-soft',
  'success',
  'warning',
  'danger',
  'info',
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} />
      {children}
    </Card>
  );
}

/** Living reference of every design-system component, in the current theme. */
export default function DesignGalleryPage() {
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [progress, setProgress] = useState(0.6);

  return (
    <>
      <PageHeader title="Design system" subtitle="Soft pink, usability first." />
      <div className="space-y-5">
        <Section title="Brand pink">
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {swatches.map(([name, hex]) => (
              <div key={name} className="text-center text-xs">
                <div className="h-12 rounded-xl border border-line" style={{ background: hex }} />
                <p className="mt-1 font-semibold">{name.replace('pink-', '')}</p>
                <p className="text-fg-muted">{hex}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Theme tokens">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {semantic.map((t) => (
              <div key={t} className="flex items-center gap-2 text-sm">
                <span
                  className="size-8 rounded-lg border border-line"
                  style={{ background: `var(--${t})` }}
                />
                {t}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography">
          <h1 className="text-3xl">Display heading</h1>
          <h2 className="mt-2 text-xl">Section heading</h2>
          <p className="mt-2">Body text in Nunito, 16px, line height 1.5.</p>
          <p className="text-sm text-fg-muted">Secondary text, 14px.</p>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap gap-2">
            <Button icon={<Plus />}>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger" icon={<Trash2 />}>
              Delete
            </Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <IconButton label="Favorite" icon={<Heart />} />
            <IconButton label="Star" icon={<Star />} variant="soft" />
            <IconButton label="Add" icon={<Plus />} variant="primary" />
          </div>
        </Section>

        <Section title="Inputs">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Task title" hint="Keep it short and clear.">
              {(p) => <Input placeholder="Read chapter 4" {...p} />}
            </Field>
            <Field label="Search">
              {(p) => <Input leadingIcon={<Search />} placeholder="Search everything" {...p} />}
            </Field>
            <Field label="Title" error="Please enter a title.">
              {(p) => <Input {...p} />}
            </Field>
            <Field label="Description">
              {(p) => <Textarea placeholder="Optional details" {...p} />}
            </Field>
          </div>
        </Section>

        <Section title="Chips, checkboxes & controls">
          <div className="flex flex-wrap gap-2">
            {chipColors.map((c) => (
              <Chip key={c} color={c} icon={<Tag />}>
                {c}
              </Chip>
            ))}
            <Chip onRemove={() => undefined}>removable</Chip>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <Checkbox label="Finish slides for Monday" strikeWhenChecked />
            <Checkbox label="Already done" strikeWhenChecked defaultChecked />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <SegmentedControl
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
            />
            <button type="button" onClick={() => setProgress((p) => (p >= 1 ? 0 : p + 0.2))}>
              <ProgressRing value={progress} label={`${Math.round(progress * 100)}% complete`} />
            </button>
          </div>
        </Section>

        <div className="grid gap-5 md:grid-cols-3">
          <Card>Default card</Card>
          <Card tone="muted">Muted card</Card>
          <Card tone="pink">Pink card</Card>
        </div>

        <LinkCard>
          <CardHeader title="Link card" icon={<Heart />} to="/" />
          <p className="text-sm text-fg-muted">
            Click anywhere on the card to open Home. Its own buttons keep working:{' '}
            <Button size="sm" variant="ghost" onClick={() => setProgress(0)}>
              Reset progress
            </Button>
          </p>
        </LinkCard>

        <Section title="Empty state & sheet">
          <EmptyState
            icon={<BookOpen />}
            title="Nothing here yet"
            description="Empty states always offer one clear next step."
            action={<Button onClick={() => setSheetOpen(true)}>Open sheet</Button>}
          />
          <Sheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            title="Example sheet"
            description="Bottom sheet on phones, dialog on desktop."
          >
            <div className="space-y-4">
              <Field label="Name">{(p) => <Input placeholder="Type here" {...p} />}</Field>
              <Button fullWidth onClick={() => setSheetOpen(false)}>
                Save
              </Button>
            </div>
          </Sheet>
        </Section>
      </div>
    </>
  );
}
