import { useEffect, useMemo, useState } from 'react';
import { clearVaultData, getVaultMeta, getWorkerUrl, listEncryptedRecords, setVaultMeta, upsertEncryptedRecord } from './lib/db';
import { createVaultMeta, decryptTransaction, deriveVault, encryptTransaction, generateRecoveryPhrase, normalizePhrase } from './lib/crypto';
import { createRemoteVault, pullRemoteVault, pushRemoteVault } from './lib/sync';
import { CATEGORIES, PAYMENT_METHODS, SUBCATEGORIES, type BudgetSettings, type Category, type EncryptedRecord, type PaymentMethod, type SyncStatus, type TransactionData, type TransactionRecord, type VaultMeta } from './types';
import { QuickAddTransaction } from './components/QuickAddTransaction';

const SESSION_KEY = 'finance-vault-preview-phrase';
const DEFAULT_WORKER_URL = window.location.port === '4174' ? 'http://127.0.0.1:8787' : window.location.origin;
const today = new Date().toISOString().slice(0, 10);

const emptyForm: TransactionData = {
  kind: 'transaction',
  amount: 0,
  reason: '',
  date: today,
  category: 'Needs',
  subcategory: SUBCATEGORIES.Needs[0],
  paymentMethod: 'UPI',
  notes: '',
  needsReview: false,
  reviewReason: ''
};

const emptyBudgets: BudgetSettings = { Needs: 0, Wants: 0, Family: 0, Miscellaneous: 0 };

function currency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export default function App() {
  const [vaultMeta, setVaultMetaState] = useState<VaultMeta | null>(null);
  const [phrase, setPhrase] = useState('');
  const [draftPhrase, setDraftPhrase] = useState('');
  const [generatedPhrase, setGeneratedPhrase] = useState('');
  const [savedPhrase, setSavedPhrase] = useState(false);
  const [records, setRecords] = useState<TransactionRecord[]>([]);
  const [form, setForm] = useState<TransactionData>(emptyForm);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [workerUrl, setWorkerUrlState] = useState(DEFAULT_WORKER_URL);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSync, setLastSync] = useState('Not synced yet');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('All');
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<BudgetSettings>(emptyBudgets);

  useEffect(() => {
    void (async () => {
      const [meta, savedWorkerUrl] = await Promise.all([getVaultMeta(), getWorkerUrl()]);
      setVaultMetaState(meta ?? null);
      if (savedWorkerUrl) setWorkerUrlState(savedWorkerUrl);
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved && meta) {
        await unlock(saved, meta);
      } else {
        setBusy(false);
      }
    })();
  }, []);

  useEffect(() => {
    function markOffline() {
      setSyncStatus('offline');
    }

    function markOnline() {
      setSyncStatus((current) => (current === 'offline' ? 'idle' : current));
      if (phrase && vaultMeta) {
        void syncNow('Back online. Synced encrypted changes.');
      }
    }

    window.addEventListener('offline', markOffline);
    window.addEventListener('online', markOnline);
    return () => {
      window.removeEventListener('offline', markOffline);
      window.removeEventListener('online', markOnline);
    };
  }, [phrase, vaultMeta, workerUrl]);

  const activeSubcategories = useMemo(() => SUBCATEGORIES[form.category], [form.category]);
  const activeRecords = useMemo(() => records.filter((record) => !record.deletedAt && record.data.kind !== 'settings'), [records]);
  const settingsRecord = useMemo(() => records.find((record) => !record.deletedAt && record.data.kind === 'settings'), [records]);
  const budgets = settingsRecord?.data.settings ?? emptyBudgets;
  const months = useMemo(() => Array.from(new Set(activeRecords.map((record) => record.data.date.slice(0, 7)))).sort().reverse(), [activeRecords]);
  const visibleRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeRecords
      .filter((record) => month === 'All' || record.data.date.startsWith(month))
      .filter((record) => !query || `${record.data.reason} ${record.data.notes} ${record.data.category} ${record.data.subcategory}`.toLowerCase().includes(query))
      .sort((a, b) => `${b.data.date}|${b.updatedAt}`.localeCompare(`${a.data.date}|${a.updatedAt}`));
  }, [activeRecords, month, search]);
  const totalSpent = useMemo(() => activeRecords.reduce((sum, record) => sum + record.data.amount, 0), [activeRecords]);
  const categoryTotals = useMemo(() => Object.fromEntries(CATEGORIES.map((category) => [category, activeRecords.filter((record) => record.data.date.startsWith(today.slice(0, 7)) && record.data.category === category).reduce((sum, record) => sum + record.data.amount, 0)])) as Record<Category, number>, [activeRecords]);

  useEffect(() => { setBudgetDraft(budgets); }, [settingsRecord?.updatedAt]);

  async function loadRecords(unlockPhrase: string, meta: VaultMeta) {
    const { encryptionKey, vaultId } = await deriveVault(unlockPhrase);
    if (vaultId !== meta.vaultId) throw new Error('Wrong recovery phrase for this local vault.');
    const encryptedRecords = await listEncryptedRecords();
    const decrypted = await Promise.all(encryptedRecords.map((record) => decryptTransaction(record, encryptionKey)));
    setRecords(decrypted);
  }

  async function reloadUnlockedRecords(nextMeta?: VaultMeta, nextPhrase?: string) {
    const meta = nextMeta ?? vaultMeta;
    const unlockPhrase = nextPhrase ?? phrase;
    if (!meta || !unlockPhrase) return;
    await loadRecords(unlockPhrase, meta);
  }

  async function applySnapshot(snapshot: { records: EncryptedRecord[] }, nextMeta?: VaultMeta, nextPhrase?: string) {
    await Promise.all(snapshot.records.map((record) => upsertEncryptedRecord(record)));
    await reloadUnlockedRecords(nextMeta, nextPhrase);
  }

  async function unlock(unlockPhrase: string, metaOverride?: VaultMeta) {
    setBusy(true);
    setMessage('');
    try {
      const meta = metaOverride ?? (await getVaultMeta());
      if (!meta) throw new Error('No local vault found yet.');
      const normalized = normalizePhrase(unlockPhrase);
      await loadRecords(normalized, meta);
      sessionStorage.setItem(SESSION_KEY, normalized);
      setPhrase(normalized);
      setDraftPhrase('');
      setVaultMetaState(meta);
      setSyncStatus(navigator.onLine ? 'idle' : 'offline');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to unlock vault.');
    } finally {
      setBusy(false);
    }
  }

  async function createVault() {
    if (!generatedPhrase || !savedPhrase) return;
    setBusy(true);
    setMessage('');
    try {
      await clearVaultData();
      const derived = await deriveVault(generatedPhrase);
      const meta = createVaultMeta(derived.vaultId);
      await setVaultMeta(meta);
      sessionStorage.setItem(SESSION_KEY, derived.normalizedPhrase);
      setVaultMetaState(meta);
      setPhrase(derived.normalizedPhrase);
      setRecords([]);
      setDraftPhrase('');
      setGeneratedPhrase('');
      setSavedPhrase(false);
      setForm(emptyForm);
      if (navigator.onLine) {
        await createRemoteVault({ workerUrl, authToken: derived.authToken, authHash: derived.authHash, deviceId: meta.deviceId, vaultId: meta.vaultId });
        setLastSync(`Cloud vault created: ${new Date().toLocaleString()}`);
        setSyncStatus('ok');
        setMessage('Vault created locally and in the encrypted cloud.');
      } else {
        setLastSync('Local vault ready. Cloud will connect when online.');
        setSyncStatus('offline');
        setMessage('Vault created locally.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Vault creation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function submitTransaction(event: React.FormEvent) {
    event.preventDefault();
    if (!vaultMeta || !phrase) return;
    setBusy(true);
    setMessage('');
    try {
      const { encryptionKey } = await deriveVault(phrase);
      const timestamp = new Date().toISOString();
      const existing = editingId ? records.find((item) => item.id === editingId) : undefined;
      const record: TransactionRecord = {
        id: existing?.id ?? crypto.randomUUID(),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        deviceId: vaultMeta.deviceId,
        data: form
      };
      await upsertEncryptedRecord(await encryptTransaction(record, encryptionKey));
      await reloadUnlockedRecords();
      setForm({ ...emptyForm, date: form.date, category: form.category, subcategory: SUBCATEGORIES[form.category][0] });
      setEditingId(null);
      setMessage(existing ? 'Transaction updated locally.' : 'Transaction saved locally.');
      setSyncStatus(navigator.onLine ? 'idle' : 'offline');
      if (navigator.onLine) {
        await syncNow(existing ? 'Transaction updated and synced.' : 'Transaction saved and synced.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteTransaction(id: string) {
    if (!vaultMeta || !phrase) return;
    const existing = records.find((record) => record.id === id);
    if (!existing) return;
    setBusy(true);
    setMessage('');
    try {
      const { encryptionKey } = await deriveVault(phrase);
      const tombstone: TransactionRecord = {
        ...existing,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await upsertEncryptedRecord(await encryptTransaction(tombstone, encryptionKey));
      await reloadUnlockedRecords();
      setMessage('Deleted locally with tombstone.');
      setSyncStatus(navigator.onLine ? 'idle' : 'offline');
      if (navigator.onLine) {
        await syncNow('Deleted locally and synced encrypted changes.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(record: TransactionRecord) {
    setEditingId(record.id);
    setForm({ ...emptyForm, ...record.data, kind: 'transaction' });
    document.getElementById('transaction-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function updateRecord(record: TransactionRecord, successMessage: string) {
    if (!vaultMeta || !phrase) return;
    setBusy(true);
    try {
      const { encryptionKey } = await deriveVault(phrase);
      await upsertEncryptedRecord(await encryptTransaction(record, encryptionKey));
      await reloadUnlockedRecords();
      if (navigator.onLine) await syncNow(successMessage);
      else setMessage(`${successMessage} It will sync when online.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Update failed.');
    } finally {
      setBusy(false);
    }
  }

  async function markReviewed(record: TransactionRecord) {
    await updateRecord({
      ...record,
      updatedAt: new Date().toISOString(),
      deviceId: vaultMeta?.deviceId ?? record.deviceId,
      data: { ...record.data, needsReview: false, reviewReason: '' }
    }, 'Review completed and synced.');
  }

  async function saveBudgets(event: React.FormEvent) {
    event.preventDefault();
    if (!vaultMeta) return;
    const timestamp = new Date().toISOString();
    const record: TransactionRecord = {
      id: settingsRecord?.id ?? crypto.randomUUID(),
      createdAt: settingsRecord?.createdAt ?? timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      deviceId: vaultMeta.deviceId,
      data: { ...emptyForm, kind: 'settings', reason: 'Private budget settings', settings: budgetDraft }
    };
    await updateRecord(record, 'Private budgets saved and synced.');
  }

  function downloadJson(filename: string, value: unknown) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportReadableTransactions() {
    downloadJson(`finance-vault-transactions-${today}.json`, activeRecords.map((record) => ({
      amount: record.data.amount,
      reason: record.data.reason,
      date: record.data.date,
      category: record.data.category,
      subcategory: record.data.subcategory,
      payment_method: record.data.paymentMethod,
      notes: record.data.notes,
      needs_review: Boolean(record.data.needsReview),
      review_reason: record.data.reviewReason ?? ''
    })));
  }

  async function importTransactions() {
    if (!vaultMeta || !phrase) return;
    setBusy(true);
    try {
      const parsed = JSON.parse(importText) as Array<Record<string, unknown>>;
      if (!Array.isArray(parsed)) throw new Error('Import must be a JSON array.');
      const { encryptionKey } = await deriveVault(phrase);
      const timestamp = new Date().toISOString();
      for (const [index, item] of parsed.entries()) {
        const category = item.category as Category;
        const amount = Number(item.amount);
        if (!(amount > 0) || typeof item.reason !== 'string' || typeof item.date !== 'string' || !CATEGORIES.includes(category)) {
          throw new Error(`Row ${index + 1} has invalid amount, reason, date, or category.`);
        }
        const payment = (item.paymentMethod ?? item.payment_method ?? 'Other') as PaymentMethod;
        const data: TransactionData = {
          ...emptyForm,
          amount,
          reason: item.reason,
          date: item.date,
          category,
          subcategory: typeof item.subcategory === 'string' ? item.subcategory : SUBCATEGORIES[category][0],
          paymentMethod: PAYMENT_METHODS.includes(payment) ? payment : 'Other',
          notes: typeof item.notes === 'string' ? item.notes : '',
          needsReview: Boolean(item.needsReview ?? item.needs_review),
          reviewReason: String(item.reviewReason ?? item.review_reason ?? '')
        };
        const record: TransactionRecord = { id: crypto.randomUUID(), createdAt: timestamp, updatedAt: timestamp, deletedAt: null, deviceId: vaultMeta.deviceId, data };
        await upsertEncryptedRecord(await encryptTransaction(record, encryptionKey));
      }
      await reloadUnlockedRecords();
      setImportText('');
      setShowImport(false);
      if (navigator.onLine) await syncNow(`Imported and synced ${parsed.length} transactions.`);
      else setMessage(`Imported ${parsed.length} transactions locally.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  async function copyImportPrompt() {
    const categories = CATEGORIES.map((category) => `${category}: ${SUBCATEGORIES[category].join(', ')}`).join('\n');
    await navigator.clipboard.writeText(`Convert my transaction text into a JSON array. Required fields: amount, reason, date (YYYY-MM-DD), category, subcategory, payment_method, notes, needs_review, review_reason. Allowed categories and subcategories:\n${categories}`);
    setMessage('AI import prompt copied.');
  }

  async function exportBackup() {
    const encryptedRecords = await listEncryptedRecords();
    downloadJson(`finance-vault-encrypted-${today}.json`, { vaultMeta, encryptedRecords });
  }

  function lockVault() {
    sessionStorage.removeItem(SESSION_KEY);
    setPhrase('');
    setRecords([]);
    setMessage('Vault locked.');
  }

  async function withSync(action: () => Promise<void>, successMessage?: string) {
    setSyncStatus('pending');
    setMessage('');
    try {
      await action();
      setSyncStatus('ok');
      setLastSync(`Last sync: ${new Date().toLocaleString()}`);
      if (successMessage) setMessage(successMessage);
    } catch (error) {
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
      setMessage(error instanceof Error ? error.message : 'Sync failed.');
    }
  }

  async function createCloudVault() {
    if (!vaultMeta || !phrase) return;
    const derived = await deriveVault(phrase);
    await withSync(async () => {
      await createRemoteVault({
        workerUrl,
        authToken: derived.authToken,
        authHash: derived.authHash,
        deviceId: vaultMeta.deviceId,
        vaultId: vaultMeta.vaultId
      });
    }, 'Cloud vault created.');
  }

  async function pushCloud() {
    if (!vaultMeta || !phrase) return;
    const derived = await deriveVault(phrase);
    await withSync(async () => {
      const encryptedRecords = await listEncryptedRecords();
      await pushRemoteVault({
        workerUrl,
        authToken: derived.authToken,
        authHash: derived.authHash,
        deviceId: vaultMeta.deviceId,
        vaultId: vaultMeta.vaultId,
        records: encryptedRecords
      });
    }, 'Encrypted records pushed to cloud.');
  }

  async function pullCloud() {
    if (!vaultMeta || !phrase) return;
    const derived = await deriveVault(phrase);
    await withSync(async () => {
      const snapshot = await pullRemoteVault({
        workerUrl,
        authToken: derived.authToken,
        authHash: derived.authHash,
        deviceId: vaultMeta.deviceId,
        vaultId: vaultMeta.vaultId
      });
      await applySnapshot(snapshot);
      setMessage(`Pulled ${snapshot.records.length} encrypted records from cloud.`);
    });
  }

  async function syncNow(successMessage = 'Encrypted changes synced.') {
    if (!vaultMeta || !phrase) return;
    const derived = await deriveVault(phrase);
    await withSync(async () => {
      const encryptedRecords = await listEncryptedRecords();
      const snapshot = await pushRemoteVault({
        workerUrl,
        authToken: derived.authToken,
        authHash: derived.authHash,
        deviceId: vaultMeta.deviceId,
        vaultId: vaultMeta.vaultId,
        records: encryptedRecords
      });
      await applySnapshot(snapshot);
    }, successMessage);
  }

  async function recoverFromCloud() {
    if (!draftPhrase.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const derived = await deriveVault(draftPhrase);
      const meta = createVaultMeta(derived.vaultId);
      const snapshot = await pullRemoteVault({
        workerUrl,
        authToken: derived.authToken,
        authHash: derived.authHash,
        deviceId: meta.deviceId,
        vaultId: meta.vaultId
      });
      await clearVaultData();
      await setVaultMeta(meta);
      await applySnapshot(snapshot, meta, derived.normalizedPhrase);
      sessionStorage.setItem(SESSION_KEY, derived.normalizedPhrase);
      setVaultMetaState(meta);
      setPhrase(derived.normalizedPhrase);
      setDraftPhrase('');
      setSyncStatus('ok');
      setLastSync(`Recovered from cloud: ${new Date().toLocaleString()}`);
      setMessage(`Recovered ${snapshot.records.length} encrypted records from cloud.`);
    } catch (error) {
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
      setMessage(error instanceof Error ? error.message : 'Cloud recovery failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Finance Vault</p>
          <h1>Your money, private by design.</h1>
          <p className="subtle">Track, review, analyse, import, and recover your finances. Plaintext stays on your devices.</p>
        </div>
        <div className="status-card">
          <div><strong>Storage:</strong> encrypted locally + cloud backup</div>
          <div><strong>Sync:</strong> {syncStatus}</div>
          <div><strong>{lastSync}</strong></div>
        </div>
      </header>

      {message ? <div className="banner">{message}</div> : null}

      {!vaultMeta ? (
        <section className="grid two-up">
          <article className="card">
            <h2>Create new vault</h2>
            <p className="subtle">Generate one recovery phrase for encryption, sync, and recovery. We cannot reset it.</p>
            <button className="button" onClick={() => setGeneratedPhrase(generateRecoveryPhrase())}>Generate phrase</button>
            {generatedPhrase ? (
              <>
                <div className="phrase-box">{generatedPhrase}</div>
                <label className="check">
                  <input type="checkbox" checked={savedPhrase} onChange={(event) => setSavedPhrase(event.target.checked)} />
                  I saved these 24 words.
                </label>
                <button className="button primary" disabled={!savedPhrase || busy} onClick={() => void createVault()}>Create vault</button>
              </>
            ) : null}
          </article>

          <article className="card">
            <h2>Recover existing cloud vault</h2>
            <p className="subtle">Use this on a fresh browser or device to restore your encrypted transactions and private settings.</p>
            <textarea rows={5} value={draftPhrase} onChange={(event) => setDraftPhrase(event.target.value)} placeholder="paste your 24 words" />
            <div className="actions">
              <button className="button primary" disabled={!draftPhrase.trim() || busy} onClick={() => void recoverFromCloud()}>Recover from cloud</button>
            </div>
          </article>
        </section>
      ) : !phrase ? (
        <section className="card narrow">
          <h2>Unlock vault</h2>
          <p className="subtle">Local data exists for vault <code>{vaultMeta.vaultId.slice(0, 12)}…</code>.</p>
          <textarea rows={5} value={draftPhrase} onChange={(event) => setDraftPhrase(event.target.value)} placeholder="paste your 24 words" />
          <button className="button primary" disabled={!draftPhrase.trim() || busy} onClick={() => void unlock(draftPhrase)}>Unlock</button>
        </section>
      ) : (
        <main className="grid main-grid">
          <QuickAddTransaction
            form={form}
            setForm={setForm}
            busy={busy}
            editingId={editingId}
            onSubmit={submitTransaction}
            onCancelEdit={() => {
              setEditingId(null);
              setForm(emptyForm);
            }}
            onToggleImport={() => setShowImport((value) => !value)}
          />

          {showImport ? (
            <section className="pop-card import-panel full-span">
              <div className="section-head">
                <h2>Import transactions</h2>
                <button className="button" onClick={() => void copyImportPrompt()}>Copy AI prompt</button>
              </div>
              <textarea rows={8} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='Paste a JSON array, for example [{"amount":500,"reason":"Lunch","date":"2026-09-06","category":"Wants"}]' />
              <div className="actions top-gap">
                <label className="button file-button">Choose JSON file<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(setImportText); }} /></label>
                <button className="button primary" disabled={!importText.trim() || busy} onClick={() => void importTransactions()}>Import and sync</button>
              </div>
            </section>
          ) : null}

          <section className="stack">
            <article className="card stats">
              <div>
                <p className="eyebrow">Vault</p>
                <strong>{vaultMeta.vaultId.slice(0, 12)}…</strong>
              </div>
              <div>
                <p className="eyebrow">Transactions</p>
                <strong>{activeRecords.length}</strong>
              </div>
              <div>
                <p className="eyebrow">Spent</p>
                <strong>{currency(totalSpent)}</strong>
              </div>
            </article>

            <article className="card">
              <h2>This month</h2>
              <div className="category-grid">
                {CATEGORIES.map((category) => <div className={`category-stat category-${category.toLowerCase()}`} key={category}>
                  <span>{category}</span><strong>{currency(categoryTotals[category])}</strong>
                  {budgets[category] > 0 ? <small>{Math.round((categoryTotals[category] / budgets[category]) * 100)}% of monthly target</small> : <small>No target set</small>}
                </div>)}
              </div>
            </article>

            <article className="card">
              <h2>Encrypted cloud sync</h2>
              <div className="actions top-gap">
                <button className="button" disabled={busy} onClick={() => void createCloudVault()}>Create cloud vault</button>
                <button className="button" disabled={busy} onClick={() => void syncNow()}>Sync now</button>
                <button className="button" disabled={busy} onClick={() => void pullCloud()}>Pull cloud</button>
              </div>
              <p className="subtle top-gap">Changes save locally first and sync automatically when online. The server receives ciphertext only.</p>
            </article>

            <article className="card">
              <h2>Private monthly targets</h2>
              <p className="subtle">These targets are encrypted and sync with your vault.</p>
              <form className="budget-grid" onSubmit={saveBudgets}>
                {CATEGORIES.map((category) => <label key={category}>{category}<input type="number" min="0" value={budgetDraft[category] || ''} onChange={(event) => setBudgetDraft({ ...budgetDraft, [category]: Number(event.target.value) })} placeholder="0" /></label>)}
                <button className="button primary full" disabled={busy}>Save targets</button>
              </form>
            </article>
          </section>

          <section className="card ledger full-span">
            <div className="section-head">
              <div><p className="eyebrow">Ledger</p><h2>Transactions</h2></div>
              <span className="subtle">{visibleRecords.length} shown</span>
            </div>
            <div className="filters">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reason, notes, or category" />
              <select value={month} onChange={(event) => setMonth(event.target.value)}>
                <option value="All">All months</option>
                {months.map((value) => <option key={value} value={value}>{new Date(`${value}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</option>)}
              </select>
            </div>
            {visibleRecords.length === 0 ? (
              <p className="empty">No matching transactions yet.</p>
            ) : (
              <div className="ledger-list">
                {visibleRecords.map((record) => (
                  <article className="ledger-row" key={record.id}>
                    <div>
                      <strong>{record.data.reason}</strong>
                      <p>{record.data.category} · {record.data.subcategory} · {record.data.paymentMethod}</p>
                      <p className="subtle">{record.data.date}{record.data.notes ? ` · ${record.data.notes}` : ''}</p>
                      {record.data.needsReview ? <span className="review-badge">Needs review{record.data.reviewReason ? `: ${record.data.reviewReason}` : ''}</span> : null}
                    </div>
                    <div className="ledger-side">
                      <strong>{currency(record.data.amount)}</strong>
                      <div className="actions"><button className="button" onClick={() => startEdit(record)}>Edit</button><button className="button danger" onClick={() => void deleteTransaction(record.id)}>Delete</button></div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card full-span">
            <div className="section-head"><div><p className="eyebrow">Review queue</p><h2>Transactions needing attention</h2></div><strong>{activeRecords.filter((record) => record.data.needsReview).length}</strong></div>
            <div className="review-grid">
              {activeRecords.filter((record) => record.data.needsReview).map((record) => <article className="review-card" key={record.id}>
                <span>{record.data.date}</span><strong>{currency(record.data.amount)}</strong><h3>{record.data.reason}</h3>
                <p>{record.data.reviewReason || 'Check the category or details.'}</p>
                <div className="actions"><button className="button" onClick={() => startEdit(record)}>Edit details</button><button className="button primary" disabled={busy} onClick={() => void markReviewed(record)}>Mark reviewed</button></div>
              </article>)}
              {activeRecords.every((record) => !record.data.needsReview) ? <p className="empty">Review queue is clear.</p> : null}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
