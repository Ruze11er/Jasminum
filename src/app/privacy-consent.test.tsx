import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { clock } from '@/lib/clock';
import {
  hasAcceptedPolicy,
  PRIVACY_ACCEPTED_KEY,
  readAcceptance,
  writeAcceptance,
} from '@/features/privacy/consent';
import { PRIVACY_POLICY_VERSION } from '@/features/privacy/version';
import { WELCOME_SEEN_KEY } from './layout/WelcomeSplash';
import { routes } from './router';

const NOW = new Date('2026-11-03T09:00:00').getTime();

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const consent = () => screen.findByRole('dialog', { name: 'Welcome to Jasminum' });

beforeEach(() => {
  clock.set(NOW);
  // src/test/setup.ts agrees for every other test; these start as a first visit.
  localStorage.removeItem(PRIVACY_ACCEPTED_KEY);
});

describe('privacy agreement on first open', () => {
  it('shows the policy and needs the box ticked before "I agree"', async () => {
    const user = userEvent.setup();
    renderApp();
    const dialog = await consent();
    const policy = within(dialog).getByRole('region', { name: 'Privacy Policy' });
    expect(within(policy).getByRole('heading', { name: 'Where your data lives' })).toBeVisible();
    expect(within(policy).getByText(/Last updated November 3, 2026/)).toBeVisible();

    const agree = within(dialog).getByRole('button', { name: 'I agree' });
    expect(agree).toBeDisabled();
    await user.click(
      within(dialog).getByRole('checkbox', {
        name: 'I have read and agree to the Privacy Policy',
      }),
    );
    expect(agree).toBeEnabled();
    await user.click(agree);

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Welcome to Jasminum' })).toBeNull(),
    );
    expect(readAcceptance()).toEqual({ version: PRIVACY_POLICY_VERSION, at: NOW });
    expect(await screen.findByText('Quote of the day')).toBeInTheDocument();
  });

  it("doesn't ask again once agreed", async () => {
    writeAcceptance(NOW);
    renderApp();
    expect(await screen.findByText('Quote of the day')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Welcome to Jasminum' })).toBeNull();
  });

  it('asks again when the policy has changed, or the saved value is damaged', () => {
    localStorage.setItem(PRIVACY_ACCEPTED_KEY, JSON.stringify({ version: '2020-01-01', at: NOW }));
    expect(hasAcceptedPolicy()).toBe(false);
    for (const bad of ['not json', '"yes"', '{"version":1}', 'null']) {
      localStorage.setItem(PRIVACY_ACCEPTED_KEY, bad);
      expect(hasAcceptedPolicy()).toBe(false);
    }
    writeAcceptance(NOW);
    expect(hasAcceptedPolicy()).toBe(true);
  });

  it('lets this tab in when the policy is accepted in another tab', async () => {
    renderApp();
    await consent();
    writeAcceptance(NOW);
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: PRIVACY_ACCEPTED_KEY }));
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Welcome to Jasminum' })).toBeNull(),
    );
  });

  it('waits under the welcome splash, so a tap to skip it lands nowhere', async () => {
    sessionStorage.removeItem(WELCOME_SEEN_KEY);
    renderApp();
    const dialog = await consent();
    expect(screen.getByTestId('welcome')).toBeInTheDocument();
    expect(dialog).toHaveAttribute('inert');

    fireEvent.keyDown(window, { key: ' ' }); // skips the splash
    await waitFor(() => expect(screen.queryByTestId('welcome')).toBeNull());
    await waitFor(() => expect(dialog).not.toHaveAttribute('inert'));
    expect(within(dialog).getByRole('region', { name: 'Privacy Policy' })).toHaveFocus();
  });

  it('keeps the policy readable from Settings afterwards', async () => {
    writeAcceptance(NOW);
    renderApp('/privacy');
    expect(await screen.findByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeVisible();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Trash' })).toHaveAttribute(
      'href',
      '/trash',
    );
    expect(screen.getByRole('heading', { name: 'Your agreement' })).toBeVisible();
  });
});
