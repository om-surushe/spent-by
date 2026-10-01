# Vault lifecycle review

Diagram: [`../diagrams/vault-lifecycle.excalidraw`](../diagrams/vault-lifecycle.excalidraw) (open at [Excalidraw](https://excalidraw.com) with **Open**).

## What happens end to end

1. **Create** — the browser creates a 24-word recovery phrase, derives a deterministic vault ID, authentication token, and AES-256-GCM key using HKDF-SHA-256, then creates the local IndexedDB vault. When online it registers the vault with the Worker.
2. **Save locally** — each transaction is encrypted individually with a new 12-byte AES-GCM IV and stored in IndexedDB. The server never receives plaintext transaction fields.
3. **Sync** — the browser HMAC-signs a full encrypted record snapshot. The Worker validates the origin, request size, HMAC, token hash, timestamp, replay ID, and rate limits before D1 atomically merges records and enforces the vault quota.
4. **Resolve conflicts** — the newest `updatedAt` wins; equal timestamps use `deviceId` as a deterministic tie-breaker. Deleted records remain encrypted tombstones so offline devices cannot resurrect them.
5. **Lock / recover** — the phrase is held in memory and `sessionStorage` only while unlocked. Locking removes it. Recovery derives the same vault ID/token/key from the phrase, fetches ciphertext, and decrypts it locally.

## What Cloudflare can and cannot see

Cloudflare can see vault and device identifiers, encrypted record sizes, timestamps, IP/request frequency, and ciphertext. It cannot read transaction amounts, merchants, categories, notes, or payment methods.

## Review findings

### Must address before public registration

- **Creation abuse protection is not complete.** The Worker allows creation while `ALLOW_VAULT_CREATE=1`; its code accepts a Turnstile token field but does not verify it. Keep public creation disabled or add real Turnstile verification before exposing it publicly.
- **There are no automated vault/Worker tests.** Add small tests for phrase derivation stability, wrong-phrase rejection, encrypt/decrypt round trips, signature rejection, replay rejection, and merge/tombstone behavior before changing this protocol.

### Accept deliberately, but document in the product

- **No phrase means no recovery.** This is the intended zero-knowledge property. The new-vault flow is the correct fallback.
- **The phrase lives in `sessionStorage` while unlocked.** This supports reloads in one browser session but means an XSS compromise could steal it. Keep a strict CSP, avoid third-party scripts, and lock the vault when finished.
- **Conflict resolution depends on device clocks.** A badly wrong device clock can win a conflict. This is acceptable for a small personal ledger; server-assigned ordering would reveal more and add complexity.

### Later, when usage grows

- Sync sends/returns the complete encrypted snapshot. It is simple and correct for a 1 MiB vault, but delta sync is the next scaling improvement.
- `App.tsx` currently owns vault UI and orchestration. Move lifecycle operations into a small `vaultService` only after the tests above exist; do not split it just for folder structure.
