import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from './router';

function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('App shell', () => {
  it('renders the home page with navigation', async () => {
    renderApp('/');
    expect(await screen.findByText('Quote of the day')).toBeInTheDocument();
    const navs = screen.getAllByRole('navigation', { name: 'Main navigation' });
    expect(navs.length).toBeGreaterThan(0);
    expect(within(navs[0]!).getByRole('link', { name: /Library/ })).toBeInTheDocument();
  });

  it('navigates between sections', async () => {
    const user = userEvent.setup();
    const router = renderApp('/');
    await screen.findByText('Quote of the day');
    const [nav] = screen.getAllByRole('navigation', { name: 'Main navigation' });
    await user.click(within(nav!).getByRole('link', { name: /Tasks/ }));
    expect(await screen.findByRole('heading', { name: 'Tasks', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tasks');
  });

  it('opens the quick-add sheet', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await screen.findByText('Quote of the day');
    await user.click(screen.getAllByRole('button', { name: 'Create new' })[0]!);
    expect(await screen.findByRole('dialog', { name: 'Create new' })).toBeInTheDocument();
  });

  it('switches theme from settings', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    await user.click(await screen.findByRole('radio', { name: 'Dark' }));
    expect(document.documentElement).toHaveClass('dark');
    await user.click(screen.getByRole('radio', { name: 'Light' }));
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('shows a friendly page for unknown routes', async () => {
    renderApp('/nope');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });
});
