# Worker, D1, and sync-boundary review

Diagram: [`../diagrams/worker-sync-boundary.excalidraw`](../diagrams/worker-sync-boundary.excalidraw).

## End-to-end request flow

1. The browser derives its vault ID and HMAC token from the recovery phrase. It encrypts records before sending them.
2. Every API request supplies the vault ID, SHA-256 token hash, device ID, request ID, timestamp, and HMAC over method/path/timestamp/request-ID/body.
3. The Worker rejects a foreign browser origin, oversized body, over-limit IP/vault, malformed authentication, stale timestamp, bad signature, and replayed request ID.
4. D1 stores the token hash, encrypted records with IVs, record timestamps/device IDs, and recent request IDs. Sync is a D1 batch: record merge, quota guard, metadata update, and replay-ID cleanup occur together.
5. A snapshot returns ciphertext records only. The browser alone decrypts them.

## Findings

### Must fix before schema changes are deployed

- **Deploy does not apply D1 migrations.** Preview deployment runs `wrangler deploy`, but no workflow step runs `wrangler d1 migrations apply … --remote`. A future schema change can deploy Worker code against an old database. Add an explicit migration step before Worker deploy for each environment.
- **No Worker integration tests.** The route/auth/merge logic is security-sensitive and has no test suite. At minimum cover authentication rejection, replay rejection, quota rollback, newer-record merge, tie-break merge, and tombstone merge.

### Operational/security decisions

- **Preview creation is open.** `ALLOW_VAULT_CREATE` is correctly `0` in production, but preview permits it. This is acceptable for personal testing; do not change production to `1` until Turnstile is actually verified.
- **The production CORS origin still points to the legacy custom-domain app.** When the new Worker becomes the custom-domain app, update `CORS_ORIGIN` during that rollout. If UI and API are served from the same Worker origin, it is mostly a defensive browser restriction rather than an application dependency.
- **The current auth construction is sensible.** The token is not stored server-side; D1 has only its hash. HMAC covers the body and route, and the server compares hashes in constant time.
- **Replay IDs retain only 100 requests.** Within the five-minute timestamp window, an old request could eventually be replayed after 100 later requests. It cannot overwrite newer data because record merge is monotonic; treat this as a resource/idempotency limit, not a plaintext or account-access vulnerability.

### Reliability/performance later

- Tombstones and request IDs are retained indefinitely/within the rolling 100 set. Tombstones are necessary for offline correctness; a compacting protocol is the eventual scaling route.
- Deploy workflows mix `npm ci` and `npm install`. Use `npm ci` in all CI jobs for deterministic lockfile installs.
- Observability is useful, but keep payloads and recovery-related headers out of application logs.

## Smallest correct next change

Add a `migrate-preview` / `migrate-production` script and run it immediately before the matching Worker deployment. Then add one Worker test file for the auth and merge boundary—no new backend framework needed.
