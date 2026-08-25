import { useEffect, useMemo, useState } from 'react';
import { clearVaultData, getVaultMeta, getWorkerUrl, listEncryptedRecords, setVaultMeta, setWorkerUrl, upsertEncryptedRecord } from './lib/db';
import { createVaultMeta, decryptTransaction, deriveVault, encryptTransaction, generateRecoveryPhrase, normalizePhrase } from './lib/crypto';
import { createRemoteVault, pullRemoteVault, pushRemoteVault } from './lib/sync';
import { CATEGORIES, PAYMENT_METHODS, SUBCATEGORIES, type Category, type EncryptedRecord, type PaymentMethod, type SyncStatus, type TransactionData, type TransactionRecord, type VaultMeta } from './types';

const SESSION_KEY = 'finance-vault-preview-phrase';
const DEFAULT_WORKER_URL = 'http://127.0.0.1:8787';
const today = new Date().toISOString().slice(0, 10);

const emptyForm: TransactionData = {
  amount: 0,
  reason: '',
  date: today,
  category: 'Needs',
  subcategory: SUBCATEGORIES.Needs[0],
  paymentMethod: 'UPI',
  notes: ''
};

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
  const activeRecords = useMemo(() => records.filter((record) => !record.deletedAt), [records]);
  const totalSpent = useMemo(() => activeRecords.reduce((sum, record) => sum + record.data.amount, 0), [activeRecords]);

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
      setLastSync('Local vault ready. Cloud not created yet.');
      setSyncStatus(navigator.onLine ? 'idle' : 'offline');
      setMessage('New vault created locally.');
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
      const record: TransactionRecord = {
        id: crypto.randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        deviceId: vaultMeta.deviceId,
        data: form
      };
      await upsertEncryptedRecord(await encryptTransaction(record, encryptionKey));
      await reloadUnlockedRecords();
      setForm({ ...emptyForm, date: form.date, category: form.category, subcategory: SUBCATEGORIES[form.category][0] });
      setMessage('Saved locally. No network needed.');
      setSyncStatus(navigator.onLine ? 'idle' : 'offline');
      if (navigator.onLine) {
        await syncNow('Saved locally and synced encrypted changes.');
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

  async function exportBackup() {
    const encryptedRecords = await listEncryptedRecords();
    const payload = JSON.stringify({ vaultMeta, encryptedRecords }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance-vault-preview-${vaultMeta?.vaultId ?? 'local'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function lockVault() {
    sessionStorage.removeItem(SESSION_KEY);
    setPhrase('');
    setRecords([]);
    setMessage('Vault locked.');
  }

  async function saveWorkerEndpoint() {
    await setWorkerUrl(workerUrl.trim());
    setMessage('Worker URL saved locally.');
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
          <p className="eyebrow">Finance Vault preview</p>
          <h1>Encrypted offline-first tracker, built next to the old app.</h1>
          <p className="subtle">This slice adds auto-sync after local changes and a fresh-device recovery path from cloud.</p>
        </div>
        <div className="status-card">
          <div><strong>Old app:</strong> untouched</div>
          <div><strong>Preview:</strong> `next-app/`</div>
          <div><strong>Sync status:</strong> {syncStatus}</div>
          <div><strong>{lastSync}</strong></div>
        </div>
      </header>

      {message ? <div className="banner">{message}</div> : null}

      {!vaultMeta ? (
        <section className="grid two-up">
          <article className="card">
            <h2>Create new vault</h2>
            <p className="subtle">This generates a 24-word recovery phrase. Save it before continuing.</p>
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
            <p className="subtle">Use this on a fresh browser/device. It will pull encrypted records from cloud and create the local vault.</p>
            <label>
              Worker URL
              <input value={workerUrl} onChange={(event) => setWorkerUrlState(event.target.value)} placeholder="http://127.0.0.1:8787" />
            </label>
            <textarea rows={5} value={draftPhrase} onChange={(event) => setDraftPhrase(event.target.value)} placeholder="paste your 24 words" />
            <div className="actions">
              <button className="button" onClick={() => void saveWorkerEndpoint()}>Save URL</button>
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
          <section className="card">
            <div className="section-head">
              <h2>Add transaction</h2>
              <button className="button" onClick={lockVault}>Lock vault</button>
            </div>
            <form className="form-grid" onSubmit={submitTransaction}>
              <label>
                Amount
                <input type="number" min="0" step="0.01" value={form.amount || ''} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} required />
              </label>
              <label>
                Date
                <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
              </label>
              <label className="full">
                Reason
                <input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required />
              </label>
              <label>
                Category
                <select value={form.category} onChange={(event) => {
                  const category = event.target.value as Category;
                  setForm({ ...form, category, subcategory: SUBCATEGORIES[category][0] });
                }}>
                  {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label>
                Subcategory
                <select value={form.subcategory} onChange={(event) => setForm({ ...form, subcategory: event.target.value })}>
                  {activeSubcategories.map((subcategory) => <option key={subcategory} value={subcategory}>{subcategory}</option>)}
                </select>
              </label>
              <label>
                Payment
                <select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as PaymentMethod })}>
                  {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                </select>
              </label>
              <label className="full">
                Notes
                <textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </label>
              <div className="full actions">
                <button className="button primary" disabled={busy} type="submit">Save locally</button>
                <button className="button" type="button" onClick={() => void exportBackup()}>Export encrypted backup</button>
              </div>
            </form>
          </section>

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
              <h2>Cloud sync preview</h2>
              <label>
                Worker URL
                <input value={workerUrl} onChange={(event) => setWorkerUrlState(event.target.value)} placeholder="http://127.0.0.1:8787" />
              </label>
              <div className="actions top-gap">
                <button className="button" onClick={() => void saveWorkerEndpoint()}>Save URL</button>
                <button className="button" disabled={busy} onClick={() => void createCloudVault()}>Create cloud vault</button>
                <button className="button" disabled={busy} onClick={() => void syncNow()}>Sync now</button>
                <button className="button" disabled={busy} onClick={() => void pullCloud()}>Pull cloud</button>
              </div>
              <p className="subtle top-gap">Local writes still happen first. If online, encrypted changes sync right after save/delete.</p>
            </article>

            <article className="card">
              <h2>What to test now</h2>
              <ul className="checklist">
                <li>Create cloud vault once.</li>
                <li>Add a transaction and confirm sync status updates without pressing push.</li>
                <li>Refresh and pull cloud.</li>
                <li>Open a fresh browser/private window and use Recover from cloud.</li>
                <li>Make changes on both sessions and sync again.</li>
              </ul>
            </article>
          </section>

          <section className="card ledger full-span">
            <div className="section-head">
              <h2>Local encrypted transactions</h2>
              <span className="subtle">Newest first</span>
            </div>
            {activeRecords.length === 0 ? (
              <p className="empty">Nothing yet. Add one transaction and test cross-browser recovery.</p>
            ) : (
              <div className="ledger-list">
                {activeRecords.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((record) => (
                  <article className="ledger-row" key={record.id}>
                    <div>
                      <strong>{record.data.reason}</strong>
                      <p>{record.data.category} · {record.data.subcategory} · {record.data.paymentMethod}</p>
                      <p className="subtle">{record.data.date} · {record.id.slice(0, 8)}</p>
                    </div>
                    <div className="ledger-side">
                      <strong>{currency(record.data.amount)}</strong>
                      <button className="button danger" onClick={() => void deleteTransaction(record.id)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
