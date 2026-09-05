# Architecture

## Goal

Finance Vault should feel like a normal personal finance app while keeping plaintext financial data on the user's devices. Cloud infrastructure exists for encrypted backup and multi-device synchronization, not for server-side analytics.

## System

1. The React PWA stores encrypted records in IndexedDB through Dexie.
2. A 24-word recovery phrase is normalized and expanded with HKDF into domain-separated material for vault identity, request authentication, and AES-256-GCM encryption.
3. The browser signs every cloud request with HMAC-SHA-256.
4. A Cloudflare Worker validates origin, timestamp, signature, rate limits, payload shape, and replay ID.
5. Cloudflare D1 stores vault metadata and encrypted records. A batched transaction applies deterministic last-write-wins merges and quota checks atomically.

## Trust model

The server can observe ciphertext sizes, vault identifiers, device identifiers, timestamps, IP metadata, and request frequency. It cannot directly read transaction amounts, descriptions, categories, payment methods, or notes.

The recovery phrase is the root secret. Losing it means losing access; exposing it means exposing the vault. The phrase is held in memory and session storage only while the vault is unlocked.

This design is **zero-knowledge application storage**, not anonymity. It has not been independently audited.

## Conflict model

Each transaction is an independent encrypted record. Updates are ordered by `updatedAt`, with `deviceId` as a deterministic tie-breaker. Deletions are tombstones, so an offline device cannot accidentally resurrect a deleted record during a later sync.

This is intentionally smaller than a general CRDT: it matches the app's append-heavy transaction workflow while remaining understandable and testable.

## Capacity model

Free vaults receive 1 MiB. Registration stops at 200 vaults, leaving headroom inside D1's database limit. The database enforces per-vault quota inside the same atomic batch as record writes; oversized syncs roll back entirely.

Before public launch:

1. Create and elevate the owner's vault.
2. Add Turnstile to vault creation.
3. Enable public registration only after abuse and recovery tests pass.
4. Monitor D1 reads, writes, storage, Worker errors, and rate-limit events.

## Deliberate trade-offs

- D1 was selected over object storage because multi-record sync, replay tracking, and quota enforcement need transactions.
- The backend returns complete encrypted snapshots for simplicity. Cursor-based delta sync is the next scaling step.
- Server-side search and analytics are impossible by design because transaction content is encrypted.
- Recovery has no administrator bypass. That protects privacy but makes user education and backups essential.
