import { formatCurrency } from '../../utils/format';
import { MoneyMovementForm } from './components/MoneyMovementForm';
import { MoneyMovementLedger } from './components/MoneyMovementLedger';
import { MoneyMovementReviewQueue } from './components/MoneyMovementReviewQueue';
import { MoneyMovementSummary } from './components/MoneyMovementSummary';
import { useMoneyMovements } from './useMoneyMovements';

export default function MoneyMovementsApp() {
  const {
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
  } = useMoneyMovements();

  if (busy && !vaultMeta) {
    return (
      <div className="app-shell">
        <section className="card narrow"><h2>Opening Finance Vault…</h2></section>
      </div>
    );
  }

  if (!vaultMeta || !phrase) {
    return (
      <div className="app-shell">
        <section className="card narrow">
          <p className="eyebrow">Product experiment</p>
          <h1>Unlock the classic vault first</h1>
          <p className="subtle">This experimental flow reuses your existing encrypted vault rather than creating another source of truth.</p>
          <a className="button primary" href="/">Open Finance Vault</a>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Finance Vault · Product experiment</p>
          <h1>Record what actually happened to your money.</h1>
          <p className="subtle">Expenses, refunds, reimbursements, income and transfers have different financial meaning. Older records remain expenses by default.</p>
        </div>
        <div className="status-card">
          <div><strong>This month net spent:</strong> {formatCurrency(netSpent)}</div>
          <div><strong>Needs review:</strong> {reviewQueue.length}</div>
          <div><a href="/">Classic view</a></div>
        </div>
      </header>

      {message ? <div className="banner">{message}</div> : null}

      <main className="grid main-grid">
        <MoneyMovementForm
          form={form}
          editingId={editingId}
          busy={busy}
          onFormChange={setForm}
          onSubmit={saveMovement}
          onCancelEdit={cancelEditing}
        />

        <MoneyMovementSummary
          netSpent={netSpent}
          movementCounts={movementCounts}
          categoryTotals={categoryTotals}
        />

        <MoneyMovementReviewQueue
          records={reviewQueue}
          busy={busy}
          onEdit={startEditing}
          onMarkReviewed={(record) => void markReviewed(record)}
        />

        <MoneyMovementLedger
          records={recentRecords}
          totalCount={activeRecords.length}
          onEdit={startEditing}
        />
      </main>
    </div>
  );
}
