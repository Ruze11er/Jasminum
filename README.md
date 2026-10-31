# Jasminum

A cute, pink, offline-first personal organizer. It is an installable web app (PWA): open it in a browser, then use "Add to Home Screen" or "Install app". All data stays on your device.

## Commands

| Command                | What it does                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `npm run dev`          | Start the dev server at http://localhost:5173                                         |
| `npm run build`        | Production build into `dist/` (includes the offline service worker)                   |
| `npm run preview`      | Serve the production build locally (use this to test offline/install)                 |
| `npm test`             | Unit and component tests (Vitest)                                                     |
| `npm run e2e`          | End-to-end tests in Chromium, Firefox and WebKit, including offline mode (Playwright) |
| `npm run e2e:chromium` | The same tests in Chromium only (desktop and phone), for a quicker run                |
| `npm run lint`         | ESLint                                                                                |
| `npm run typecheck`    | TypeScript                                                                            |

The service worker only runs in the production build, so test offline behavior with `npm run build && npm run preview`, not `npm run dev`.

## Where things live

- `src/design-system/`: color tokens (`tokens.css`), theme handling and reusable components. Open `/design` in the app to see them all.
- `src/app/`: app shell, navigation and routes.
- `src/features/<feature>/`: one folder per section (tasks, calendar, notes, library, …).
- `e2e/`: Playwright tests.

## Deploying

Jasminum is a set of static files: `npm run build` puts everything in `dist/`. There is no server code, database or API to set up.

**Recommended: Cloudflare Pages or Netlify.** Both read the two deploy files in `public/` (copied into `dist/`):

- `_headers` sets the security headers (Content-Security-Policy, HTTPS only (HSTS), no framing, no referrer, locked-down permissions) and the caching rules. The policy is also copied into `index.html` at build time, so it applies even where headers can't be set.
- `_redirects` sends every app route (like `/notes/…`) to `index.html`.

Setup on either host:

1. Create a project from this GitHub repository.
2. Build command: `npm run build`. Output folder: `dist`. Node version: 24 (read from `.node-version`).
3. Add your custom domain in the host's domain settings. HTTPS is set up automatically, and the app needs it: service workers and installing only work over HTTPS.
4. Pick one address and keep it. Browsers keep each user's data per address, so `www.example.com` and `example.com` count as two separate apps, and moving to a new domain later leaves everyone's data behind (they'd need a backup to move it). Redirect every other form of the address to the one you chose, from the first day.

**GitHub Pages** isn't recommended for a public release: it ignores `_headers`, so there's no HSTS and no `frame-ancestors` (only the `<meta>` policy applies), and app routes need a copy of `index.html` saved as `404.html`.

After each deploy, open the live URL once online. The app then works offline, and existing users see "A new version is ready" instead of a surprise reload.
