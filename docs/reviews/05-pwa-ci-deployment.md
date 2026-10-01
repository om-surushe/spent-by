# PWA, CI/CD, and deployment review

Diagram: [`../diagrams/pwa-deployment-flow.excalidraw`](../diagrams/pwa-deployment-flow.excalidraw).

## Current flow

1. Vite builds the React app into `dist`; Wrangler serves these static assets and invokes Worker code only for `/v1/*` and `/health`.
2. The PWA registers a network-first service worker. It pre-caches the app entry URL, manifest, and favicon, then caches successful `GET` responses at runtime.
3. Quality Gate checks run manually or when a pull request gets a specific label. Preview deployment is manually dispatched and can deploy a chosen Git ref.
4. A separate old workflow still auto-deploys `ui/tier1-pop-finance` to Cloudflare preview. Legacy releases deploy a different Node/SQLite app to a VM.

## Findings

### P0 — deployment is ambiguous today

- **Two preview deployment workflows target different source branches.** `cloudflare-preview.yml` auto-deploys `ui/tier1-pop-finance`; `deploy-preview.yml` manually deploys an arbitrary ref (default `main`). This is why the hosted Worker and local `main` diverged. Retire the old branch-triggered workflow and keep exactly one preview source of truth.
- **The current manual preview run is failing because the Cloudflare API token is invalid.** Replace the GitHub environment secret with a restricted, non-expiring deployment token after choosing the single workflow.

### P1 — make the expected path explicit

- **No checks run automatically for normal pushes/PRs.** Checks require a label or manual dispatch. That may be intentional, but `main` can receive broken code unnoticed. At minimum run build, worker type-check, and standards on pull requests targeting `main`.
- **The production custom domain currently serves the legacy VM app, not the new Worker.** Do not attach production deployment to `main` until DNS/domain cutover, remote D1 migrations, and production secrets are ready.
- **Worker deployment does not run D1 migrations.** This is tracked as a P0 in the Worker review; add it to the one surviving deployment workflow.

### P2 — PWA reliability and cleanup

- `skipWaiting()` immediately activates a new service worker and deletes all prior caches. If a user is offline during an upgrade, the new HTML can refer to assets that are not yet cached. Prefer a normal update prompt or pre-cache the built asset manifest before deleting the old cache.
- Service worker registration ignores failures. Log a non-sensitive diagnostic in development so broken offline behavior is visible.
- The manifest has one SVG icon. Add raster maskable icons before treating mobile installation as polished.
- CI uses both `npm ci` and `npm install`; use `npm ci` everywhere except the intentionally temporary Playwright browser-QA install.

## Smallest correct next change

Delete or disable the branch-triggered `cloudflare-preview.yml`. Keep `deploy-preview.yml`, change its installs to `npm ci`, add the remote D1 migration step, then replace the invalid GitHub token and deploy `main` deliberately.
