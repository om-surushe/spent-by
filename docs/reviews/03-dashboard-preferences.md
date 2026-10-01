# Dashboard, settings, and preference review

Diagram: [`../diagrams/dashboard-preferences.excalidraw`](../diagrams/dashboard-preferences.excalidraw).

## End-to-end flow

1. `App.tsx` decrypts active transaction records and derives visible records, month choices, monthly totals, category totals, review records, and budget progress with `useMemo`.
2. A single encrypted `settings` record stores the four fixed monthly budgets. It follows the normal encrypted sync path.
3. Home section order/visibility, sources, custom categories, subcategories, and label choices live in `localStorage`. They apply immediately but remain only on this browser.
4. The service worker is network-first: it caches successful `GET` responses and falls back to cache when offline. It never caches writes.

## Findings

### Fix with the money-data work

- **Budget inputs repeat the unrestricted-number problem.** `Number(event.target.value)` accepts fractional, extreme, and non-finite values. Budgets need the same integer-smallest-unit normalization as transactions.
- **Custom categories and fixed budgets conflict.** The UI lets users add arbitrary categories, but `BudgetSettings` and category total typing are fixed to Needs/Wants/Family/Miscellaneous. A custom category can be recorded but cannot receive a budget. Choose one model: fixed categories, or a dynamic `Record<string, integer>` budget map.
- **Category rename/delete does not migrate historical transactions.** Existing transactions retain their old category string. The dashboard can silently stop including them in the selected current-category totals.

### Keep deliberately local for now

- Dashboard layout, labels, sources, categories, and subcategories are non-financial device preferences. Keeping them out of encrypted sync is a good minimal choice until cross-device preference sync is explicitly wanted.
- Those local preferences are readable by any script that runs on the origin. Do not place transaction data or recovery material there.

### Cleanup later

- The Pop dashboard is rendered directly from `App.tsx`, while an older `DashboardSidebar` module and stylesheet remain. Once the desired dashboard is stable, keep the used implementation and delete the other one.
- The service worker caches every successful `GET`. That is fine now because sync writes use non-GET requests; add an explicit allowlist if the Worker later exposes authenticated read endpoints.

## Smallest correct next change

Use the planned `normalizeMoneyInput()` for budgets too. Keep categories fixed until money movements and budget semantics are designed; dynamic labels alone are enough for the current product.
