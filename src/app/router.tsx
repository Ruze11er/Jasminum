import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { AppShell } from './layout/AppShell';
import { NotFoundPage, RouteError } from './RouteError';

/** Each page is its own chunk, so the first load stays small. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    // Shown for a split second while the first page's code loads.
    hydrateFallbackElement: <div className="min-h-dvh bg-bg" />,
    children: [
      { index: true, lazy: page(() => import('@/features/dashboard/HomePage')) },
      { path: 'calendar', lazy: page(() => import('@/features/calendar/CalendarPage')) },
      { path: 'tasks', lazy: page(() => import('@/features/tasks/TasksPage')) },
      { path: 'notes/:noteId?', lazy: page(() => import('@/features/notes/NotesPage')) },
      { path: 'library/:docId?', lazy: page(() => import('@/features/library/LibraryPage')) },
      { path: 'insights', lazy: page(() => import('@/features/insights/InsightsPage')) },
      { path: 'settings', lazy: page(() => import('@/features/settings/SettingsPage')) },
      { path: 'trash', lazy: page(() => import('@/features/trash/TrashPage')) },
      { path: 'design', lazy: page(() => import('@/features/design-gallery/DesignGalleryPage')) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
