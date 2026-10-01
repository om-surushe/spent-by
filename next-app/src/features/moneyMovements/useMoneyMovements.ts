import { useCallback, useEffect, useMemo, useState } from 'react';
import { EMPTY_TRANSACTION, SESSION_KEY, TODAY } from '../../constants';
import { getMovementType, getSpendingImpact } from '../../domain/moneyMovement';
import { decryptTransaction, deriveVault, encryptTransaction } from '../../lib/crypto';
import { getVaultMeta, getWorkerUrl, listEncryptedRecords, upsertEncryptedRecord } from '../../lib/db';
import { pushRemoteVault } from '../../lib/sync';
import {
  CATEGORIES,
  MONEY_MOVEMENT_TYPES,
  SUBCATEGORIES,
  type Category,
  type MoneyMovementType,
  type TransactionData,
  type TransactionRecord,
  type VaultMeta
} from '../../types';

function createEmptyMovement(overrides: Partial<TransactionData> = {}): TransactionData {
  return {
    ...EMPTY_TRANSACTION,
    movementType: 'Expense',
    ...overrides
  };
}

export function useMoneyMovements() {
  const [vaultMeta, setVaultMeta] = useState<VaultMeta | null>(null);
  const [phrase, setPhrase] = useState('');
  const [records, setRecords] = useState<TransactionRecord[]>([]);
  const [form, setForm] = useState<TransactionData>(() => createEmptyMovement());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(true);
  const [workerUrl, setWorkerUrl] = useState(window.location.origin);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadRecords = useCallback(async (unlockPhrase: string, meta: VaultMeta) => {
    const derived = await deriveVault(unlockPhrase);
    if (derived.vaultId !== meta.vaultId) {
      throw new Error('The unlocked session does not match this vault.');
    }

    const encryptedRecords = await listEncryptedRecords();
    const decryptedRecords = await Promise.all(
      encryptedRecords.map((record) => decryptTransaction(record, derived.encryptionKey))
    );
    setRecords(decryptedRecords);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [savedMeta, savedWorkerUrl] = await Promise.all([getVaultMeta(), getWorkerUrl()]);
        const savedPhrase = sessionStorage.getItem(SESSION_KEY) ?? '';

        if (savedWorkerUrl) setWorkerUrl(savedWorkerUrl);
        if (savedMeta && savedPhrase) {
          setVaultMeta(savedMeta);
          setPhrase(savedPhrase);
          await loadRecords(savedPhrase, savedMeta);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Unable to load vault.');
      } finally {
        setBusy(false);
      }
    })();
  }, [loadRecords]);

  const activeRecords = useMemo(
    () => records.filter((record) => !record.deletedAt && record.data.kind !== 'settings'),
    [records]
  );

  const currentMonthRecords = useMemo(
    () => activeRecords.filter((record) => record.data.date.startsWith(TODAY.slice(0, 7))),
    [activeRecords]
  );

  const netSpent = useMemo(
    () => currentMonthRecords.reduce((total, record) => total + getSpendingImpact(record), 0),
    [currentMonthRecords]
  );

  const movementCounts = useMemo(
    () => Object.fromEntries(
      MONEY_MOVEMENT_TYPES.map((type) => [
        type,
        currentMonthRecords.filter((record) => getMovementType(record) === type).length
      ])
    ) as Record<MoneyMovementType, number>,
    [currentMonthRecords]
  );

  const categoryTotals = useMemo(
    () => Object.fromEntries(
      CATEGORIES.map((category) => [
        category,
        currentMonthRecords
          .filter((record) => record.data.category === category)
          .reduce((total, record) => total + getSpendingImpact(record), 0)
      ])
    ) as Record<Category, number>,
    [currentMonthRecords]
  );

  const reviewQueue = useMemo(
    () => activeRecords.filter((record) => record.data.needsReview),
    [activeRecords]
  );

  const recentRecords = useMemo(
    () => [...activeRecords]
      .sort((a, b) => `${b.data.date}|${b.updatedAt}`.localeCompare(`${a.data.date}|${a.updatedAt}`))
      .slice(0, 30),
    [activeRecords]
  );

  const reloadRecords = useCallback(async () => {
    if (!vaultMeta || !phrase) return;
    await loadRecords(phrase, vaultMeta);
  }, [loadRecords, phrase, vaultMeta]);

  const syncRecords = useCallback(async () => {
    if (!vaultMeta || !phrase || !navigator.onLine) return;

    const derived = await deriveVault(phrase);
    const encryptedRecords = await listEncryptedRecords();
    const snapshot = await pushRemoteVault({
      workerUrl,
      authToken: derived.authToken,
      authHash: derived.authHash,
      deviceId: vaultMeta.deviceId,
      vaultId: vaultMeta.vaultId,
      records: encryptedRecords
    });

    await Promise.all(snapshot.records.map((record) => upsertEncryptedRecord(record)));
    await loadRecords(phrase, vaultMeta);
  }, [loadRecords, phrase, vaultMeta, workerUrl]);

  async function saveMovement(event: React.FormEvent) {
    event.preventDefault();
    if (!vaultMeta || !phrase || form.amount <= 0 || !form.reason.trim()) return;

    setBusy(true);
    setMessage('');
    try {
      const derived = await deriveVault(phrase);
      const timestamp = new Date().toISOString();
      const existing = editingId ? activeRecords.find((record) => record.id === editingId) : undefined;
      const record: TransactionRecord = {
        id: existing?.id ?? crypto.randomUUID(),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        deviceId: vaultMeta.deviceId,
        data: { ...form, reason: form.reason.trim(), kind: 'transaction' }
      };

      await upsertEncryptedRecord(await encryptTransaction(record, derived.encryptionKey));
      await reloadRecords();
      setEditingId(null);
      setForm(createEmptyMovement({
        date: form.date,
        movementType: form.movementType,
        paymentMethod: form.paymentMethod,
        category: form.category,
        subcategory: SUBCATEGORIES[form.category][0]
      }));

      if (navigator.onLine) await syncRecords();
      setMessage(existing ? 'Movement updated.' : 'Movement saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save movement.');
    } finally {
      setBusy(false);
    }
  }

  function startEditing(record: TransactionRecord) {
    setEditingId(record.id);
    setForm(createEmptyMovement({
      ...record.data,
      movementType: getMovementType(record),
      kind: 'transaction'
    }));
    document.getElementById('money-movement-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(createEmptyMovement());
  }

  async function markReviewed(record: TransactionRecord) {
    if (!vaultMeta || !phrase) return;

    setBusy(true);
    try {
      const derived = await deriveVault(phrase);
      const nextRecord: TransactionRecord = {
        ...record,
        updatedAt: new Date().toISOString(),
        deviceId: vaultMeta.deviceId,
        data: { ...record.data, needsReview: false, reviewReason: '' }
      };

      await upsertEncryptedRecord(await encryptTransaction(nextRecord, derived.encryptionKey));
      await reloadRecords();
      if (navigator.onLine) await syncRecords();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update review status.');
    } finally {
      setBusy(false);
    }
  }

  return {
    vaultMeta,
    phrase,
    form,
    setForm,
    message,
    busy,
    editingId,
    activeRecords,
    recentRecords,
    netSpent,
    movementCounts,
    categoryTotals,
    reviewQueue,
    saveMovement,
    startEditing,
    cancelEditing,
    markReviewed
  };
}
