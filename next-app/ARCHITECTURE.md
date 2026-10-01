# Finance Vault architecture

The app is intentionally split by responsibility so the main files read like a map of the product instead of a collection of implementation details.

## Frontend

- `src/App.tsx`
  - Composition/root state only.
  - Coordinates vault lifecycle, transactions, budgets, sync, import/export and screen-level state.
- `src/components/VaultSetup.tsx`
  - New-vault creation and cloud recovery UI.
- `src/components/UnlockVault.tsx`
  - Existing local vault unlock UI.
- `src/components/TransactionForm.tsx`
  - Transaction create/edit form plus import/export actions.
- `src/components/DashboardSidebar.tsx`
  - Summary cards, monthly category totals, sync controls and budget settings.
- `src/components/Ledger.tsx`
  - Search/filter controls and transaction list.
- `src/components/ReviewQueue.tsx`
  - Transactions flagged for manual review.
- `src/constants.ts`
  - Shared defaults and browser-level constants.
- `src/utils/format.ts`
  - Display-only formatting helpers.
- `src/lib/db.ts`
  - Local persistence only.
- `src/lib/crypto.ts`
  - Encryption/decryption and recovery phrase derivation only.
- `src/lib/sync.ts`
  - Remote sync transport only.
- `src/types.ts`
  - Shared domain types and category/payment configuration.

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

`App.tsx` coordinates the frontend service modules in `src/lib`.

The Worker entrypoint delegates authentication, persistence and vault-domain operations to dedicated modules.

## Where to add future features

- New visual section: add a component under `src/components`.
- Pure formatting/calculation: add a helper under `src/utils`.
- Local persistence change: keep it in `src/lib/db.ts`.
- Encryption change: keep it in `src/lib/crypto.ts`.
- Sync protocol change: keep client transport in `src/lib/sync.ts` and server behavior in `worker/src`.
- New finance domain logic that becomes substantial: create a focused module rather than growing `App.tsx` again.

The goal is not maximum file count. A module should exist when it has one clear reason to change.
