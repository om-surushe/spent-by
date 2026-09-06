import { useEffect, useMemo, useState } from 'react';
import { clearVaultData, getVaultMeta, getWorkerUrl, listEncryptedRecords, setVaultMeta, upsertEncryptedRecord } from './lib/db';
import { createVaultMeta, decryptTransaction, deriveVault, encryptTransaction, generateRecoveryPhrase, normalizePhrase } from './lib/crypto';
import { createRemoteVault, pullRemoteVault, pushRemoteVault } from './lib/sync';
import { CATEGORIES, PAYMENT_METHODS, SUBCATEGORIES, type BudgetSettings, type Category, type EncryptedRecord, type PaymentMethod, type SyncStatus, type TransactionData, type TransactionRecord, type VaultMeta } from './types';
import { QuickAddTransaction } from './components/QuickAddTransaction';
import { HomeCustomizer, type HomeSectionId } from './components/HomeCustomizer';
import { FinanceLabelsSettings } from './components/FinanceLabelsSettings';
import { InstallAppPrompt } from './components/InstallAppPrompt';
import { MonthFilter } from './components/MonthFilter';

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
const DEFAULT_HOME_ORDER: HomeSectionId[] = ['quick-add', 'transactions', 'monthly-budget', 'review', 'overview'];
const DEFAULT_SOURCES: PaymentMethod[] = [...PAYMENT_METHODS];
const DEFAULT_CATEGORIES: Category[] = [...CATEGORIES];
const DEFAULT_SUBCATEGORIES: Record<string, string[]> = Object.fromEntries(
  Object.entries(SUBCATEGORIES).map(([category, values]) => [category, [...values]])
);

function readLocalList<T extends string>(key: string, fallback: T[], allowed: readonly T[]) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null') as unknown;
    if (!Array.isArray(parsed)) return fallback;
    const cleaned = parsed.filter((value): value is T => typeof value === 'string' && allowed.includes(value as T));
    return cleaned.length ? Array.from(new Set(cleaned)) : fallback;
  } catch {
    return fallback;
  }
}

function readLocalStringList(key: string, fallback: string[]) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null') as unknown;
    if (!Array.isArray(parsed)) return fallback;
    const cleaned = parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    return cleaned.length ? Array.from(new Set(cleaned)) : fallback;
  } catch {
    return fallback;
  }
}

function readLocalSubcategories() {
  try {
    const parsed = JSON.parse(localStorage.getItem('finance-vault-subcategories') ?? 'null') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_SUBCATEGORIES;
    const result: Record<string, string[]> = {};
    for (const [category, values] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(values)) continue;
      const cleaned = values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
      if (cleaned.length) result[category] = Array.from(new Set(cleaned));
    }
    return Object.keys(result).length ? result : DEFAULT_SUBCATEGORIES;
  } catch {
    return DEFAULT_SUBCATEGORIES;
  }
}

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
  const [homeOrder, setHomeOrder] = useState<HomeSectionId[]>(() => readLocalList('finance-vault-home-order', DEFAULT_HOME_ORDER, DEFAULT_HOME_ORDER));
  const [hiddenSections, setHiddenSections] = useState<HomeSectionId[]>(() => readLocalList('finance-vault-home-hidden', [], DEFAULT_HOME_ORDER));
  const [sources, setSources] = useState<PaymentMethod[]>(() => readLocalStringList('finance-vault-sources', DEFAULT_SOURCES));
  const [categories, setCategories] = useState<Category[]>(() => readLocalStringList('finance-vault-categories', DEFAULT_CATEGORIES));
  const [subcategories, setSubcategories] = useState<Record<string, string[]>>(() => readLocalSubcategories());
  const [defaultSource, setDefaultSource] = useState<PaymentMethod>(() => {
    const saved = localStorage.getItem('finance-vault-default-source') as PaymentMethod | null;
    return saved && sources.includes(saved) ? saved : 'UPI';
  });
  const [autoSync, setAutoSync] = useState(() => localStorage.getItem('finance-vault-auto-sync') !== '0');

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
      if (autoSync && phrase && vaultMeta) {
        void syncNow('Back online. Synced encrypted changes.');
      }
    }

    window.addEventListener('offline', markOffline);
    window.addEventListener('online', markOnline);
    return () => {
      window.removeEventListener('offline', markOffline);
      window.removeEventListener('online', markOnline);
    };
  }, [autoSync, phrase, vaultMeta, workerUrl]);

  const activeSubcategories = useMemo(() => subcategories[form.category] ?? [], [form.category, subcategories]);
  const activeRecords = useMemo(() => records.filter((record) => !record.deletedAt && record.data.kind !== 'settings'), [records]);
  const settingsRecord = useMemo(() => records.find((record) => !record.deletedAt && record.data.kind === 'settings'), [records]);
  const budgets = settingsRecord?.data.settings ?? emptyBudgets;
  const months = useMemo(() => Array.from(new Set(activeRecords.map((record) => record.data.date.slice(0, 7)))).sort().reverse(), [activeRecords]);
  const visibleRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeRecords
      .filter((record) => month === 'All' || record.data.date.startsWith(month))
      .filter((record) => !query || `${record.data.reason} ${record.data.notes} ${record.data.category} ${record.data.subcategory} ${record.data.paymentMethod}`.toLowerCase().includes(query))
      .sort((a, b) => `${b.data.date}|${b.updatedAt}`.localeCompare(`${a.data.date}|${a.updatedAt}`));
  }, [activeRecords, month, search]);
  const totalSpent = useMemo(() => activeRecords.reduce((sum, record) => sum + record.data.amount, 0), [activeRecords]);
  const categoryTotals = useMemo(() => Object.fromEntries(categories.map((category) => [category, activeRecords.filter((record) => record.data.date.startsWith(today.slice(0, 7)) && record.data.category === category).reduce((sum, record) => sum + record.data.amount, 0)])) as Record<Category, number>, [activeRecords, categories]);

  useEffect(() => { setBudgetDraft(budgets); }, [settingsRecord?.updatedAt]);

  useEffect(() => {
    localStorage.setItem('finance-vault-home-order', JSON.stringify(homeOrder));
  }, [homeOrder]);

  useEffect(() => {
    localStorage.setItem('finance-vault-home-hidden', JSON.stringify(hiddenSections));
  }, [hiddenSections]);

  useEffect(() => {
    localStorage.setItem('finance-vault-sources', JSON.stringify(sources));
    if (!sources.includes(defaultSource)) {
      const next = sources[0] ?? 'UPI';
      setDefaultSource(next);
      localStorage.setItem('finance-vault-default-source', next);
    }
  }, [sources, defaultSource]);

  useEffect(() => {
    localStorage.setItem('finance-vault-default-source', defaultSource);
  }, [defaultSource]);

  useEffect(() => {
    localStorage.setItem('finance-vault-categories', JSON.stringify(categories));
    localStorage.setItem('finance-vault-subcategories', JSON.stringify(subcategories));
    if (!categories.includes(form.category)) {
      const nextCategory = categories[0] ?? 'Needs';
      setForm((current) => ({
        ...current,
        category: nextCategory,
        subcategory: subcategories[nextCategory]?.[0] ?? 'Other'
      }));
    }
  }, [categories, subcategories, form.category]);

  useEffect(() => {
    localStorage.setItem('finance-vault-auto-sync', autoSync ? '1' : '0');
  }, [autoSync]);

  useEffect(() => {
    if (!sources.includes(form.paymentMethod)) {
      setForm((current) => ({ ...current, paymentMethod: defaultSource }));
    }
  }, [sources, defaultSource, form.paymentMethod]);

  const sectionOrder = useMemo(() => Object.fromEntries(homeOrder.map((id, index) => [id, index + 1])) as Record<HomeSectionId, number>, [homeOrder]);

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
      setForm({ ...emptyForm, date: form.date, category: form.category, subcategory: subcategories[form.category]?.[0] ?? 'Other', paymentMethod: defaultSource });
      setEditingId(null);
      setMessage(existing ? 'Transaction updated locally.' : 'Transaction saved locally.');
      setSyncStatus(navigator.onLine ? 'idle' : 'offline');
      if (autoSync && navigator.onLine) {
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
      if (autoSync && navigator.onLine) {
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
      if (autoSync && navigator.onLine) await syncNow(successMessage);
      else if (!navigator.onLine) setMessage(`${successMessage} It will sync when online.`);
      else setMessage(successMessage);
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
        if (!(amount > 0) || typeof item.reason !== 'string' || typeof item.date !== 'string' || !categories.includes(category)) {
          throw new Error(`Row ${index + 1} has invalid amount, reason, date, or category.`);
        }
        const payment = (item.paymentMethod ?? item.payment_method ?? 'Other') as PaymentMethod;
        const data: TransactionData = {
          ...emptyForm,
          amount,
          reason: item.reason,
          date: item.date,
          category,
          subcategory: typeof item.subcategory === 'string' ? item.subcategory : subcategories[category]?.[0] ?? 'Other',
          paymentMethod: sources.includes(payment) ? payment : defaultSource,
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
      if (autoSync && navigator.onLine) await syncNow(`Imported and synced ${parsed.length} transactions.`);
      else setMessage(`Imported ${parsed.length} transactions locally.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  async function copyImportPrompt() {
    const categoryPrompt = categories.map((category) => `${category}: ${(subcategories[category] ?? []).join(', ')}`).join('\n');
    await navigator.clipboard.writeText(`Convert my transaction text into a JSON array. Required fields: amount, reason, date (YYYY-MM-DD), category, subcategory, payment_method, notes, needs_review, review_reason. Allowed categories and subcategories:\n${categoryPrompt}`);
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
      <header className={vaultMeta && phrase ? 'app-header' : 'hero'}>
        {vaultMeta && phrase ? (
          <>
            <div className="app-brand">
              <span className="app-title">Finance Vault</span>
              <span className={`sync-dot sync-${syncStatus}`} aria-hidden="true" />
              <span className="app-sync-text">{syncStatus === 'ok' ? 'Synced' : syncStatus}</span>
            </div>
            <div className="app-header-actions">
              <InstallAppPrompt />
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="eyebrow">Finance Vault</p>
              <h1>Your money, private by design.</h1>
              <p className="subtle">Track, review, analyse, import, and recover your finances. Plaintext stays on your devices.</p>
            </div>
            <div className="status-card">
              <div><strong>Storage:</strong> encrypted locally + cloud backup</div>
              <div><strong>Sync:</strong> {syncStatus}</div>
              <div><strong>{lastSync}</strong></div>
              <InstallAppPrompt />
            </div>
          </>
        )}
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
          <p className="subtle">Local vault found on this device.</p>
          <div className="vault-id-block">
            <span className="vault-id-label">Vault ID</span>
            <div className="vault-id-row">
              <code className="vault-id-value">{vaultMeta.vaultId}</code>
              <button className="button" type="button" onClick={() => void navigator.clipboard.writeText(vaultMeta.vaultId)}>Copy</button>
            </div>
          </div>
          <textarea rows={5} value={draftPhrase} onChange={(event) => setDraftPhrase(event.target.value)} placeholder="paste your 24 words" />
          <button className="button primary" disabled={!draftPhrase.trim() || busy} onClick={() => void unlock(draftPhrase)}>Unlock</button>
        </section>
      ) : (
        <main className="grid main-grid">
          <HomeCustomizer
            order={homeOrder}
            hidden={hiddenSections}
            onOrderChange={setHomeOrder}
            onHiddenChange={setHiddenSections}
          />

          {!hiddenSections.includes('quick-add') ? (
            <div className="home-slot dashboard-quick-add" style={{ order: sectionOrder['quick-add'] }}>
              <QuickAddTransaction
                form={form}
                setForm={setForm}
                busy={busy}
                editingId={editingId}
                onSubmit={submitTransaction}
                onCancelEdit={() => {
                  setEditingId(null);
                  setForm({ ...emptyForm, paymentMethod: defaultSource });
                }}
                onToggleImport={() => setShowImport((value) => !value)}
                sources={sources}
                categories={categories}
                subcategories={subcategories}
              />
            </div>
          ) : null}

          {showImport ? (
            <section className="pop-card import-panel dashboard-import" style={{ order: sectionOrder['quick-add'] + 0.1 }}>
              <div className="section-head">
                <h2>Import transactions</h2>
                <button className="button" onClick={() => void copyImportPrompt()}>Copy AI prompt</button>
              </div>
              <textarea rows={8} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='Paste a JSON array, for example [{"amount":500,"reason":"Lunch","date":"2026-09-06","category":"Wants"}]' />
              <div className="actions top-gap">
                <label className="button file-button">Choose JSON file<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(setImportText); }} /></label>
                <button className="button primary" disabled={!importText.trim() || busy} onClick={() => void importTransactions()}>Import</button>
              </div>
            </section>
          ) : null}

          {!hiddenSections.includes('transactions') ? (
            <section className="card ledger dashboard-transactions" style={{ order: sectionOrder.transactions }}>
              <div className="section-head">
                <div><p className="eyebrow">Quick check</p><h2>Transactions</h2></div>
                <span className="subtle">{visibleRecords.length} shown</span>
              </div>
              <div className="filters">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reason, source, notes, or category" />
                <MonthFilter value={month} months={months} onChange={setMonth} />
              </div>
              {visibleRecords.length === 0 ? (
                <p className="empty">No matching transactions yet.</p>
              ) : (
                <div className="ledger-list">
                  {visibleRecords.map((record) => (
                    <article className="ledger-row ledger-row-compact" key={record.id}>
                      <div className="ledger-main">
                        <div className="ledger-title-line">
                          <strong>{record.data.reason}</strong>
                          <strong className="ledger-amount-mobile">{currency(record.data.amount)}</strong>
                        </div>
                        <p className="ledger-meta">
                          {record.data.category} · {record.data.subcategory} · {record.data.paymentMethod === 'Card' ? 'Credit Card' : record.data.paymentMethod}
                        </p>
                        <p className="ledger-date-note">{record.data.date}{record.data.notes ? ` · ${record.data.notes}` : ''}</p>
                        {record.data.needsReview ? <span className="review-badge">Needs review{record.data.reviewReason ? `: ${record.data.reviewReason}` : ''}</span> : null}
                      </div>
                      <div className="ledger-side ledger-side-compact">
                        <strong className="ledger-amount-desktop">{currency(record.data.amount)}</strong>
                        <div className="ledger-actions-compact">
                          <button className="compact-action" onClick={() => startEdit(record)}>Edit</button>
                          <button className="compact-action danger-text" onClick={() => void deleteTransaction(record.id)}>Delete</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {!hiddenSections.includes('monthly-budget') ? (
            <section className="card dashboard-budget" style={{ order: sectionOrder['monthly-budget'] }}>
              <div className="section-head">
                <div><p className="eyebrow">Budget check</p><h2>This month</h2></div>
                <span className="subtle">{new Date(`${today.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="category-grid">
                {categories.map((category) => <div className={`category-stat category-${category.toLowerCase()}`} key={category}>
                  <span>{category}</span>
                  <strong>{currency(categoryTotals[category])}</strong>
                  {budgets[category] > 0 ? <small>{Math.round((categoryTotals[category] / budgets[category]) * 100)}% of {currency(budgets[category])}</small> : <small>No target set</small>}
                </div>)}
              </div>
            </section>
          ) : null}

          {!hiddenSections.includes('review') ? (
            <section className="card dashboard-review" style={{ order: sectionOrder.review }}>
              <div className="section-head">
                <div><p className="eyebrow">Review queue</p><h2>Needs attention</h2></div>
                <strong>{activeRecords.filter((record) => record.data.needsReview).length}</strong>
              </div>
              <div className="review-grid">
                {activeRecords.filter((record) => record.data.needsReview).map((record) => <article className="review-card" key={record.id}>
                  <span>{record.data.date}</span>
                  <strong>{currency(record.data.amount)}</strong>
                  <h3>{record.data.reason}</h3>
                  <p>{record.data.reviewReason || 'Check the category or details.'}</p>
                  <div className="actions">
                    <button className="button" onClick={() => startEdit(record)}>Edit details</button>
                    <button className="button primary" disabled={busy} onClick={() => void markReviewed(record)}>Mark reviewed</button>
                  </div>
                </article>)}
                {activeRecords.every((record) => !record.data.needsReview) ? <p className="empty">Review queue is clear.</p> : null}
              </div>
            </section>
          ) : null}

          {!hiddenSections.includes('overview') ? (
            <section className="card dashboard-overview" style={{ order: sectionOrder.overview }}>
              <div className="section-head">
                <div><p className="eyebrow">Overview</p><h2>At a glance</h2></div>
                <span className={`sync-pill sync-${syncStatus}`}>{syncStatus === 'ok' ? 'Synced' : syncStatus}</span>
              </div>
              <div className="overview-grid">
                <div className="overview-stat"><span>Transactions</span><strong>{activeRecords.length}</strong></div>
                <div className="overview-stat"><span>Total spent</span><strong>{currency(totalSpent)}</strong></div>
                <div className="overview-stat vault-overview">
                  <span>Vault ID</span>
                  <code>{vaultMeta.vaultId}</code>
                  <button className="text-button" type="button" onClick={() => void navigator.clipboard.writeText(vaultMeta.vaultId)}>Copy</button>
                </div>
              </div>
            </section>
          ) : null}

          <details className="card full-span tools-card" style={{ order: 99 }}>
            <summary>
              <span><span className="eyebrow">Settings</span><strong>Preferences, backup & sync</strong></span>
              <span className="customize-hint">Keep it simple</span>
            </summary>
            <div className="settings-stack">
              <section className="settings-panel">
                <div className="setting-row">
                  <div>
                    <strong>Automatic sync</strong>
                    <p className="subtle compact-copy">Sync after every change and whenever this device comes back online.</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={autoSync} onChange={(event) => setAutoSync(event.target.checked)} />
                    <span aria-hidden="true" />
                  </label>
                </div>
                <div className="sync-summary">
                  <span className={`sync-pill sync-${syncStatus}`}>{syncStatus === 'ok' ? 'Synced' : syncStatus}</span>
                  <span className="subtle">{lastSync}</span>
                  <button className="button" disabled={busy || !navigator.onLine} onClick={() => void syncNow()}>Sync now</button>
                </div>
                <p className="subtle compact-copy">No interval setting: changes sync immediately. This keeps the behavior predictable.</p>
              </section>

              <FinanceLabelsSettings
                sources={sources}
                categories={categories}
                subcategories={subcategories}
                defaultSource={defaultSource}
                onSourcesChange={setSources}
                onCategoriesChange={setCategories}
                onSubcategoriesChange={setSubcategories}
                onDefaultSourceChange={setDefaultSource}
              />

              <section className="settings-panel">
                <h2>Monthly targets</h2>
                <form className="budget-grid" onSubmit={saveBudgets}>
                  {categories.map((category) => <label key={category}>{category}<input type="number" min="0" value={budgetDraft[category] || ''} onChange={(event) => setBudgetDraft({ ...budgetDraft, [category]: Number(event.target.value) })} placeholder="0" /></label>)}
                  <button className="button primary full" disabled={busy}>Save targets</button>
                </form>
              </section>

              <section className="settings-panel">
                <h2>Backup & privacy</h2>
                <p className="subtle">Your transactions stay encrypted on this device. Export a copy whenever you want.</p>
                <div className="actions">
                  <button className="button" type="button" onClick={exportReadableTransactions}>Export transactions</button>
                  <button className="button" type="button" onClick={() => void exportBackup()}>Encrypted backup</button>
                  <button className="button danger" type="button" onClick={lockVault}>Lock vault</button>
                </div>
              </section>

              <details className="advanced-sync">
                <summary>Advanced sync recovery</summary>
                <p className="subtle">Only use these if sync is being repaired or this device is missing cloud data.</p>
                <div className="actions">
                  <button className="button" disabled={busy} onClick={() => void createCloudVault()}>Create cloud vault</button>
                  <button className="button" disabled={busy} onClick={() => void pullCloud()}>Pull cloud</button>
                </div>
              </details>
            </div>
          </details>
        </main>
      )}
    </div>
  );
}
