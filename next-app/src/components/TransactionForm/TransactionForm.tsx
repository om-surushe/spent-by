import type React from 'react';
import { CATEGORIES, PAYMENT_METHODS, SUBCATEGORIES, type PaymentMethod, type TransactionData } from '../../types';
import './TransactionForm.css';

type TransactionFormProps = {
  form: TransactionData;
  editingId: string | null;
  busy: boolean;
  showImport: boolean;
  importText: string;
  onFormChange: (form: TransactionData) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancelEdit: () => void;
  onToggleImport: () => void;
  onExportTransactions: () => void;
  onExportBackup: () => void;
  onImportTextChange: (value: string) => void;
  onImportTransactions: () => void;
  onCopyImportPrompt: () => void;
  onLockVault: () => void;
};

export function TransactionForm({
  form,
  editingId,
  busy,
  showImport,
  importText,
  onFormChange,
  onSubmit,
  onCancelEdit,
  onToggleImport,
  onExportTransactions,
  onExportBackup,
  onImportTextChange,
  onImportTransactions,
  onCopyImportPrompt,
  onLockVault
}: TransactionFormProps) {
  const activeSubcategories = SUBCATEGORIES[form.category as keyof typeof SUBCATEGORIES] ?? [];

  return (
    <section className="card transaction-form" id="transaction-form">
      <div className="section-head">
        <h2>{editingId ? 'Edit transaction' : 'Add transaction'}</h2>
        <button className="button" onClick={onLockVault}>Lock vault</button>
      </div>

      <form className="transaction-form__grid" onSubmit={onSubmit}>
        <label>
          Amount
          <input type="number" min="0" step="0.01" value={form.amount || ''} onChange={(event) => onFormChange({ ...form, amount: Number(event.target.value) })} required />
        </label>
        <label>
          Date
          <input type="date" value={form.date} onChange={(event) => onFormChange({ ...form, date: event.target.value })} required />
        </label>
        <label className="full">
          Reason
          <input value={form.reason} onChange={(event) => onFormChange({ ...form, reason: event.target.value })} required />
        </label>
        <label>
          Category
          <select value={form.category} onChange={(event) => {
            const category = event.target.value as keyof typeof SUBCATEGORIES;
            onFormChange({ ...form, category, subcategory: SUBCATEGORIES[category][0] });
          }}>
            {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label>
          Subcategory
          <select value={form.subcategory} onChange={(event) => onFormChange({ ...form, subcategory: event.target.value })}>
            {activeSubcategories.map((subcategory) => <option key={subcategory} value={subcategory}>{subcategory}</option>)}
          </select>
        </label>
        <label>
          Payment
          <select value={form.paymentMethod} onChange={(event) => onFormChange({ ...form, paymentMethod: event.target.value as PaymentMethod })}>
            {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
          </select>
        </label>
        <label className="full">
          Notes
          <textarea rows={3} value={form.notes} onChange={(event) => onFormChange({ ...form, notes: event.target.value })} />
        </label>
        <label className="check full">
          <input type="checkbox" checked={Boolean(form.needsReview)} onChange={(event) => onFormChange({ ...form, needsReview: event.target.checked })} />
          Flag this transaction for review
        </label>
        {form.needsReview ? (
          <label className="full">
            Review note
            <input value={form.reviewReason ?? ''} onChange={(event) => onFormChange({ ...form, reviewReason: event.target.value })} placeholder="What needs checking?" />
          </label>
        ) : null}
        <div className="full actions">
          <button className="button primary" disabled={busy} type="submit">{editingId ? 'Update transaction' : 'Add transaction'}</button>
          {editingId ? <button className="button" type="button" onClick={onCancelEdit}>Cancel edit</button> : null}
          <button className="button" type="button" onClick={onToggleImport}>Import JSON</button>
          <button className="button" type="button" onClick={onExportTransactions}>Export transactions</button>
          <button className="button" type="button" onClick={onExportBackup}>Export encrypted backup</button>
        </div>
      </form>

      {showImport ? (
        <div className="transaction-form__import-panel">
          <div className="section-head">
            <h2>Import transactions</h2>
            <button className="button" onClick={onCopyImportPrompt}>Copy AI prompt</button>
          </div>
          <textarea rows={8} value={importText} onChange={(event) => onImportTextChange(event.target.value)} placeholder='Paste a JSON array, for example [{"amount":500,"reason":"Lunch","date":"2026-09-06","category":"Wants"}]' />
          <div className="actions top-gap">
            <label className="button transaction-form__file-button">
              Choose JSON file
              <input type="file" accept="application/json,.json" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void file.text().then(onImportTextChange);
              }} />
            </label>
            <button className="button primary" disabled={!importText.trim() || busy} onClick={onImportTransactions}>Import and sync</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
