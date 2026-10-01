# Money data review

Diagram: [`../diagrams/money-data-flow.excalidraw`](../diagrams/money-data-flow.excalidraw).

## End-to-end flow

1. The Quick Add form creates a `TransactionRecord` with a UUID, device ID, timestamps, deletion marker, and a `TransactionData` payload.
2. The payload is encrypted record-by-record and written to IndexedDB. The ledger, review queue, budgets, and dashboard decrypt local records in memory.
3. Edits keep the original ID and `createdAt`; deletes write an encrypted tombstone. This is correct for offline sync because another device cannot accidentally restore a deleted record.
4. Automatic or manual sync sends encrypted records. D1 resolves the same-record conflict by newest `updatedAt`, then `deviceId`.
5. Transaction export intentionally writes plaintext JSON. Vault backup writes the encrypted records and vault metadata.

## Findings

### Fix before treating totals as financially correct

- **Amounts are JavaScript `number`s with no integer smallest-unit rule.** The JSON import accepts `Number(item.amount)` and only checks `> 0`, so fractions, excessively large values, and even `1e400` are not rejected. Money must be stored as integer paise/cents at every input boundary; formatting should convert only for display.
- **Imports are not atomic.** Each parsed row is encrypted and saved inside the validation loop. A malformed later row leaves earlier rows imported while displaying an error. Validate and normalize the complete array first; only then write it in one Dexie transaction.
- **There are no automated tests** for calculation, import validation, edit/delete tombstones, or merge behavior.

### Product gaps, not bugs

- The current model records ordinary transactions and review flags. It does not yet model a transfer, refund, reimbursement, or split as a linked money movement. Do not fake those with categories when the correct-money-movements branch is reviewed.
- The old modular `TransactionForm` and the Pop Finance `QuickAddTransaction` are overlapping transaction-entry UIs. Keep one after the desired UX is settled; duplicate forms will drift.

### Privacy and export

- Plain transaction export is useful but sensitive. The UI should clearly say it is unencrypted before download.
- Encrypted vault backup is the safe portable backup. It is still useless without the recovery phrase, as intended.

## Smallest correct next change

Create a pure `normalizeTransactionInput()` function that accepts UI/import input and returns an integer-smallest-unit `TransactionData` or a field error. Use it from Quick Add and import, then add one test file covering its edge cases. This fixes the two real correctness risks without redesigning the app.
