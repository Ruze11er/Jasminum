import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox, Field, Input, SegmentedControl } from '@/design-system';

function Views() {
  const [v, setV] = useState<'day' | 'week' | 'month'>('day');
  return (
    <SegmentedControl
      label="View"
      value={v}
      onChange={setV}
      options={[
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
      ]}
    />
  );
}

describe('SegmentedControl', () => {
  it('selects on click and moves with arrow keys', async () => {
    const user = userEvent.setup();
    render(<Views />);
    expect(screen.getByRole('radio', { name: 'Day' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Week' }));
    expect(screen.getByRole('radio', { name: 'Week' })).toBeChecked();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Month' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Month' })).toHaveFocus();

    await user.keyboard('{ArrowRight}'); // wraps around
    expect(screen.getByRole('radio', { name: 'Day' })).toBeChecked();
  });
});

describe('Checkbox', () => {
  it('toggles via its label', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Read chapter 4" />);
    const box = screen.getByRole('checkbox', { name: 'Read chapter 4' });
    await user.click(screen.getByText('Read chapter 4'));
    expect(box).toBeChecked();
  });
});

describe('Field', () => {
  it('links label and error message to the input', () => {
    render(
      <Field label="Title" error="Please enter a title.">
        {(p) => <Input {...p} />}
      </Field>,
    );
    const input = screen.getByLabelText('Title');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Please enter a title.');
  });
});
