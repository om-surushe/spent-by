# Finance Vault architecture

The app is split by responsibility so the main files read like a map of the product instead of a collection of implementation details.

## Frontend structure

```text
src/
  components/
    ComponentName/
      ComponentName.tsx
      ComponentName.css
      ComponentName.stories.tsx
      helpers.ts          # only when the component has private pure helpers
      index.ts
  lib/                    # infrastructure/services
  stories/                # shared Storybook fixtures only
  styles/                 # global theme, base styles and reusable primitives
  utils/                  # helpers shared across multiple components
  App.tsx                 # composition and application-level state
  constants.ts
  types.ts
```

### Component folders

Each substantial UI component owns its implementation, component-specific CSS, stories and private helpers.

Examples:

- `components/TransactionForm/`
- `components/DashboardSidebar/`
- `components/Ledger/`
- `components/ReviewQueue/`
- `components/VaultSetup/`
- `components/UnlockVault/`

A component-specific style or helper should not be placed in a global file simply because another global file already exists.

### Shared frontend modules

- `src/App.tsx`
  - Application composition and root state.
  - Coordinates vault lifecycle, transactions, budgets, sync, import/export and screen-level state.
- `src/constants.ts`
  - Shared application defaults and browser-level constants.
- `src/types.ts`
  - Shared domain types and category/payment configuration.
- `src/utils/format.ts`
  - Formatting used by multiple components.
- `src/lib/db.ts`
  - Local persistence only.
- `src/lib/crypto.ts`
  - Encryption/decryption and recovery phrase derivation only.
- `src/lib/sync.ts`
  - Remote sync transport only.

## Styling conventions

Global/common styling belongs in `src/styles/`:

- `theme.css` - design tokens: colors, spacing, radius, typography and shared dimensions.
- `base.css` - browser reset, typography and base form elements.
- `layout.css` - generic reusable layout utilities only.
- `components.css` - genuinely shared UI primitives such as cards, buttons and badges.
- `index.css` - the single global style entrypoint.

Component-specific styling lives next to the component as `ComponentName.css` and is imported from the component.

Rules:

1. Do not use JSX `style={{ ... }}` for normal presentation.
2. Prefer semantic class names over presentation-oriented names.
3. Use CSS custom properties from `theme.css`; avoid repeating hard-coded app colors and spacing values.
4. Keep responsive behavior with the component when it is component-specific.
5. Keep only broadly reusable layout behavior in global styles.
6. Design mobile-first enough that components remain usable from 320px wide screens upward.

## Naming conventions

- React components and component folders: `PascalCase`.
- Component files: `ComponentName.tsx`, `ComponentName.css`, `ComponentName.stories.tsx`.
- Component prop types: `ComponentNameProps`.
- Shared utilities/helpers: `camelCase` functions in descriptive files.
- Constants: `UPPER_SNAKE_CASE` when truly constant across the application.
- CSS component classes: component-prefixed BEM-style names such as `ledger__row` and `dashboard-sidebar__category-card`.
- Boolean variables/functions should read as predicates where practical (`isLoading`, `hasError`, `canSync`).
- Avoid abbreviations unless they are established domain terms.

## Storybook

Storybook is configured under `.storybook/` and uses the same global theme as the application.

Run locally:

```bash
npm install
npm run storybook
```

Build Storybook intentionally:

```bash
npm run build-storybook
```

Stories should live beside the component. Shared mock data belongs in `src/stories/` rather than being duplicated between stories.

## Cloudflare Worker

- `worker/src/index.ts`
  - HTTP routing, rate-limit checks and top-level error handling only.
- `worker/src/http.ts`
  - HTTP response/body helpers.
- `worker/src/auth.ts`
  - Signed-request authentication and constant-time comparisons.
- `worker/src/store.ts`
  - D1 reads and snapshot mapping.
- `worker/src/vault-service.ts`
  - Vault creation, record validation and sync domain logic.
- `worker/src/types.ts`
  - Worker persistence/domain types.
- `worker/src/errors.ts`
  - `HttpError` shared across worker modules.

## Dependency direction

UI components receive data and callbacks from `App.tsx`; they do not talk directly to IndexedDB, crypto or the Worker.

`App.tsx` coordinates frontend service modules in `src/lib`.

The Worker entrypoint delegates authentication, persistence and vault-domain operations to dedicated modules.

## CI/CD philosophy

Pipelines should run because a meaningful event occurred, not simply because any file changed.

- Finance Vault CI is path-scoped to `next-app/**` and skips automatic runs while a pull request is still a draft.
- Legacy checks run only when legacy application files change.
- Superseded CI runs are cancelled to avoid spending compute on stale commits.
- Storybook validation is opt-in: run it manually or add the `run-storybook-checks` label to a PR.
- Preview deployment is manual and accepts an explicit ref.
- Production legacy deployment runs only on a published release or an intentional manual dispatch; it no longer deploys on every push to `main`.

## Where to add future features

- New visual section: create a component folder under `src/components`.
- Component-specific calculation/helper: keep it in that component folder.
- Pure logic reused by multiple components: place it under `src/utils`.
- Shared design token or primitive: place it under `src/styles`.
- Local persistence change: keep it in `src/lib/db.ts`.
- Encryption change: keep it in `src/lib/crypto.ts`.
- Sync protocol change: keep client transport in `src/lib/sync.ts` and server behavior in `worker/src`.
- New finance domain logic that becomes substantial: create a focused domain module rather than growing `App.tsx` again.

The goal is not maximum file count. Create a module when it owns a clear responsibility and has a clear reason to change.
