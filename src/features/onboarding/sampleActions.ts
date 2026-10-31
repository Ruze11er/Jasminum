import { toast } from '@/design-system';
import { firstIssue } from '@/lib/validation';

// The sample content is only needed when asked for, so it loads on first use.
const load = () => import('./sampleData');

export async function addSamples() {
  try {
    const { addSampleData } = await load();
    const added = await addSampleData();
    toast({
      tone: 'success',
      message: added
        ? 'Examples added. They have the “Sample” tag.'
        : 'The examples are already here',
    });
  } catch (err) {
    toast({ tone: 'error', message: firstIssue(err) ?? "Couldn't add the examples" });
  }
}

export async function removeSamples() {
  try {
    const { removeSampleData, restoreSampleData } = await load();
    const removed = await removeSampleData();
    if (!removed) return;
    toast({
      message: `${removed.count} ${removed.count === 1 ? 'example' : 'examples'} moved to Trash`,
      action: { label: 'Undo', onClick: () => void restoreSampleData(removed) },
    });
  } catch (err) {
    toast({ tone: 'error', message: firstIssue(err) ?? "Couldn't remove the examples" });
  }
}
