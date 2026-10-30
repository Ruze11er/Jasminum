# Jasminum

A cute, pink, offline-first personal organizer. It is an installable web app (PWA): open it in a browser, then use "Add to Home Screen" or "Install app". All data stays on your device.

## Commands

| Command             | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `npm run dev`       | Start the dev server at http://localhost:5173                       |
| `npm run build`     | Production build into `dist/` (includes the offline service worker) |
| `npm run preview`   | Serve the production build locally (use this to test offline/install) |
| `npm test`          | Unit and component tests (Vitest)                                   |
| `npm run e2e`       | End-to-end tests in Chromium, including offline mode (Playwright)   |
| `npm run lint`      | ESLint                                                              |
| `npm run typecheck` | TypeScript                                                          |

The service worker only runs in the production build, so test offline behavior with `npm run build && npm run preview`, not `npm run dev`.

## Where things live

- `src/design-system/`: color tokens (`tokens.css`), theme handling and reusable components. Open `/design` in the app to see them all.
- `src/app/`: app shell, navigation and routes.
- `src/features/<feature>/`: one folder per section (tasks, calendar, notes, library, …).
- `e2e/`: Playwright tests.
