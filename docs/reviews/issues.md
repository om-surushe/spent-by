# Review issue ledger

This is the single prioritized list from completed reviews. It does not include intentional trade-offs as bugs.

## P0 — resolve before public use

1. **Public vault creation is not bot-protected** — the Worker accepts creation while `ALLOW_VAULT_CREATE=1`, but the supplied Turnstile token is not verified. Keep creation disabled publicly or verify Turnstile server-side.  
   _Source: [01 Vault lifecycle](01-vault-lifecycle.md)_
2. **Money uses unrestricted JavaScript numbers** — transaction and budget inputs accept fractional, extreme, and non-finite values. Store integer paise/cents; normalize all UI and import input at the boundary.  
   _Sources: [02 Money data](02-money-data.md), [03 Dashboard preferences](03-dashboard-preferences.md)_
3. **Imports can partially save** — earlier rows are written before a later malformed row is rejected. Validate/normalize the full file first, then persist in one IndexedDB transaction.  
   _Source: [02 Money data](02-money-data.md)_
4. **No core protocol tests** — vault derivation, encryption, sync authentication/replay, merge/tombstone, money normalization, and import atomicity have no automated coverage.  
   _Sources: [01 Vault lifecycle](01-vault-lifecycle.md), [02 Money data](02-money-data.md), [04 Worker/D1 sync](04-worker-d1-sync.md)_
5. **Worker deploy does not apply D1 migrations** — a future Worker release can run against an old remote schema. Run the matching remote migration immediately before deployment.  
   _Source: [04 Worker/D1 sync](04-worker-d1-sync.md)_
6. **Preview deployment has two competing sources of truth** — one workflow automatically deploys `ui/tier1-pop-finance`, while another manually deploys any ref. Remove the branch-triggered workflow before treating preview as `main`.  
   _Source: [05 PWA / CI / deployment](05-pwa-ci-deployment.md)_
7. **The current GitHub Cloudflare token is invalid** — replace it with a restricted deployment token after consolidating the workflow.  
   _Source: [05 PWA / CI / deployment](05-pwa-ci-deployment.md)_

## P1 — decide deliberately

8. **No recovery without the phrase** — intentional zero-knowledge behavior. Passkeys need a designed key-wrapping/recovery protocol; they cannot recover the existing vault by themselves.
9. **Phrase in `sessionStorage` while unlocked** — supports reload in one tab session, but an XSS attack could read it. Require a strict CSP and no third-party scripts.
10. **Clock-based sync conflict rule** — `updatedAt` can be wrong on a device with a bad clock. Acceptable for a personal vault; document it.
11. **Custom categories do not have matching budgets** — categories are dynamic but budget keys are fixed. Keep categories fixed or make budgets dynamic; do not leave a half-model.
12. **Category rename/delete does not migrate old transactions** — historic records retain their old category text and can disappear from current totals.
13. **Plain transaction export is sensitive** — clearly warn before downloading it. Encrypted vault backup is the safe portable alternative.

## P2 — remove drift before it grows

14. **Two transaction-entry UIs** — legacy `TransactionForm` overlaps Pop Finance `QuickAddTransaction`.
15. **Two dashboard/style systems** — Pop UI is rendered from `App.tsx`; older dashboard/component CSS remains in the repository.
16. **Full-snapshot sync** — correct under the current 1 MB ceiling, but delta sync is the scaling path.
17. **Device preferences are local only** — dashboard layout, labels, sources, and categories are unsynced `localStorage` values. This is fine now; make it explicit in the product.
18. **Service worker caches every successful GET** — fine with today’s static/read-only GET surface; switch to an allowlist if authenticated GET API routes are added.
