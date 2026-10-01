import type React from 'react';
import { CATEGORIES, type BudgetSettings, type Category, type VaultMeta } from '../../types';
import { formatCurrency } from '../../utils/format';
import { getBudgetProgress } from './helpers';
import './DashboardSidebar.css';

type DashboardSidebarProps = {
  vaultMeta: VaultMeta;
  activeCount: number;
  totalSpent: number;
  categoryTotals: Record<Category, number>;
  budgets: BudgetSettings;
  budgetDraft: BudgetSettings;
  busy: boolean;
  onBudgetDraftChange: (value: BudgetSettings) => void;
  onSaveBudgets: (event: React.FormEvent) => void;
  onCreateCloudVault: () => void;
  onSyncNow: () => void;
  onPullCloud: () => void;
};

export function DashboardSidebar({
  vaultMeta,
  activeCount,
  totalSpent,
  categoryTotals,
  budgets,
  budgetDraft,
  busy,
  onBudgetDraftChange,
  onSaveBudgets,
  onCreateCloudVault,
  onSyncNow,
  onPullCloud
}: DashboardSidebarProps) {
  return (
    <section className="dashboard-sidebar stack">
      <article className="card dashboard-sidebar__stats">
        <div><p className="eyebrow">Vault</p><strong>{vaultMeta.vaultId.slice(0, 12)}…</strong></div>
        <div><p className="eyebrow">Transactions</p><strong>{activeCount}</strong></div>
        <div><p className="eyebrow">Spent</p><strong>{formatCurrency(totalSpent)}</strong></div>
      </article>

      <article className="card">
        <h2>This month</h2>
        <div className="dashboard-sidebar__category-grid">
          {CATEGORIES.map((category) => {
            const progress = getBudgetProgress(categoryTotals[category], budgets[category]);
            return (
              <div className={`dashboard-sidebar__category-card dashboard-sidebar__category-card--${category.toLowerCase()}`} key={category}>
                <span>{category}</span>
                <strong>{formatCurrency(categoryTotals[category])}</strong>
                <small>{progress === null ? 'No target set' : `${progress}% of monthly target`}</small>
              </div>
            );
          })}
        </div>
      </article>

      <article className="card">
        <h2>Encrypted cloud sync</h2>
        <div className="actions top-gap">
          <button className="button" disabled={busy} onClick={onCreateCloudVault}>Create cloud vault</button>
          <button className="button" disabled={busy} onClick={onSyncNow}>Sync now</button>
          <button className="button" disabled={busy} onClick={onPullCloud}>Pull cloud</button>
        </div>
        <p className="subtle top-gap">Changes save locally first and sync automatically when online. The server receives ciphertext only.</p>
      </article>

      <article className="card">
        <h2>Private monthly targets</h2>
        <p className="subtle">These targets are encrypted and sync with your vault.</p>
        <form className="dashboard-sidebar__budget-grid" onSubmit={onSaveBudgets}>
          {CATEGORIES.map((category) => (
            <label key={category}>
              {category}
              <input
                type="number"
                min="0"
                value={budgetDraft[category] || ''}
                onChange={(event) => onBudgetDraftChange({ ...budgetDraft, [category]: Number(event.target.value) })}
                placeholder="0"
              />
            </label>
          ))}
          <button className="button primary full" disabled={busy}>Save targets</button>
        </form>
      </article>
    </section>
  );
}
