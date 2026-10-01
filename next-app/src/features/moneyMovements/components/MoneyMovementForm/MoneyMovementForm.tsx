import type React from 'react';
import {
  CATEGORIES,
  MONEY_MOVEMENT_TYPES,
  PAYMENT_METHODS,
  SUBCATEGORIES,
  type Category,
  type MoneyMovementType,
  type PaymentMethod,
  type TransactionData
} from '../../../../types';

type MoneyMovementFormProps = {
  form: TransactionData;
  editingId: string | null;
  busy: boolean;
  onFormChange: (nextForm: TransactionData) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancelEdit: () => void;
};

function reasonPlaceholder(movementType: MoneyMovementType) {
  switch (movementType) {
    case 'Transfer':
      return 'e.g. BOI → Canara';
    case 'Refund':
      return 'e.g. Train ticket refund';
    case 'Reimbursement':
      return 'e.g. Friend paid me back';
    case 'Income':
      return 'e.g. Salary';
    case 'Expense':
      return 'e.g. Lunch';
  }
}

export function MoneyMovementForm({
  form,
  editingId,
  busy,
  onFormChange,
  onSubmit,
  onCancelEdit
}: MoneyMovementFormProps) {
  const movementType = form.movementType ?? 'Expense';
  const activeSubcategories = SUBCATEGORIES[form.category];

  return (
    <section className="card" id="money-movement-form">
      <div className="section-head">
        <div>
          <p className="eyebrow">Capture</p>
          <h2>{editingId ? 'Edit money movement' : 'What happened?'}</h2>
        </div>
      </div>

      <form className="form-grid" onSubmit={onSubmit}>
        <label className="full">
          Money movement
          <select
            value={movementType}
            onChange={(event) => onFormChange({ ...form, movementType: event.target.value as MoneyMovementType })}
          >
            {MONEY_MOVEMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>

        <label>
          Amount
          <input
            autoFocus
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={form.amount || ''}
            onChange={(event) => onFormChange({ ...form, amount: Number(event.target.value) })}
            required
          />
        </label>

        <label>
          Date
          <input
            type="date"
            value={form.date}
            onChange={(event) => onFormChange({ ...form, date: event.target.value })}
            required
          />
        </label>

        <label className="full">
          Reason
          <input
            value={form.reason}
            onChange={(event) => onFormChange({ ...form, reason: event.target.value })}
            placeholder={reasonPlaceholder(movementType)}
            required
          />
        </label>

        <label>
          Category
          <select
            value={form.category}
            onChange={(event) => {
              const category = event.target.value as Category;
              onFormChange({ ...form, category, subcategory: SUBCATEGORIES[category][0] });
            }}
          >
            {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>

        <label>
          Subcategory
          <select
            value={form.subcategory}
            onChange={(event) => onFormChange({ ...form, subcategory: event.target.value })}
          >
            {activeSubcategories.map((subcategory) => <option key={subcategory} value={subcategory}>{subcategory}</option>)}
          </select>
        </label>

        <label>
          Payment / account
          <select
            value={form.paymentMethod}
            onChange={(event) => onFormChange({ ...form, paymentMethod: event.target.value as PaymentMethod })}
          >
            {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
          </select>
        </label>

        <label className="full">
          Notes <span className="subtle">(optional)</span>
          <input value={form.notes} onChange={(event) => onFormChange({ ...form, notes: event.target.value })} />
        </label>

        <label className="check full">
          <input
            type="checkbox"
            checked={Boolean(form.needsReview)}
            onChange={(event) => onFormChange({
              ...form,
              needsReview: event.target.checked,
              reviewReason: event.target.checked ? form.reviewReason : ''
            })}
          />
          I need to verify something later
        </label>

        {form.needsReview ? (
          <label className="full">
            What needs checking?
            <input
              value={form.reviewReason ?? ''}
              onChange={(event) => onFormChange({ ...form, reviewReason: event.target.value })}
            />
          </label>
        ) : null}

        <div className="actions full">
          <button className="button primary" disabled={busy}>
            {editingId ? 'Update' : 'Save movement'}
          </button>
          {editingId ? (
            <button type="button" className="button" onClick={onCancelEdit}>Cancel</button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
