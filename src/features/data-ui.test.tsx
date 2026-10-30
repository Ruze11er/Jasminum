import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { db } from '@/data/db';
import { categoriesRepo } from '@/data/repos/categories';
import { tagsRepo } from '@/data/repos/tags';

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('profile', () => {
  it('saves the name and greets the user on Home', async () => {
    const user = userEvent.setup();
    const router = renderApp('/settings');
    const input = await screen.findByLabelText('Your name');
    await user.type(input, '  Jasmine ');
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Name saved')).toBeInTheDocument();
    expect((await db.settings.get('profile'))?.value).toEqual({ displayName: 'Jasmine' });

    await router.navigate('/');
    expect(await screen.findByRole('heading', { level: 1, name: /, Jasmine/ })).toBeInTheDocument();
  });
});

describe('trash page', () => {
  it('shows an empty state', async () => {
    renderApp('/trash');
    expect(await screen.findByText('Trash is empty')).toBeInTheDocument();
  });

  it('restores and permanently deletes items', async () => {
    const user = userEvent.setup();
    const tag = await tagsRepo.ensure('Biology');
    const cat = await categoriesRepo.create({ name: 'Errands' });
    await tagsRepo.softDelete(tag.id);
    await categoriesRepo.softDelete(cat.id);

    renderApp('/trash');
    const list = await screen.findByRole('list', { name: 'Deleted items' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);

    // Restore the tag.
    const tagRow = (await screen.findByText('Biology')).closest('li')!;
    await user.click(within(tagRow).getByRole('button', { name: 'Restore' }));
    expect(await screen.findByText('Restored "Biology"')).toBeInTheDocument();
    expect((await db.tags.get(tag.id))?.deletedAt).toBeNull();

    // Delete the category forever (after confirming).
    await user.click(screen.getByRole('button', { name: 'Delete "Errands" forever' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete forever?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete forever' }));
    expect(await screen.findByText('Trash is empty')).toBeInTheDocument();
    expect(await db.categories.get(cat.id)).toBeUndefined();
  });
});

describe('settings storage card', () => {
  it('renders even when the browser reports nothing', async () => {
    renderApp('/settings');
    expect(
      await screen.findByText("This browser doesn't report storage usage."),
    ).toBeInTheDocument();
    expect(await screen.findByText(/File storage: standard \(IndexedDB\)/)).toBeInTheDocument();
  });
});
