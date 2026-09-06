import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, PAYMENT_METHODS, SUBCATEGORIES, type Category, type PaymentMethod, type TransactionData } from '../types';

type Props = {
  form: TransactionData;
  setForm: (next: TransactionData) => void;
  busy: boolean;
  editingId: string | null;
  onSubmit: (event: React.FormEvent) => void;
  onCancelEdit: () => void;
  onToggleImport: () => void;
};

const SOURCE_LABELS: Record<PaymentMethod, string> = {
  Card: 'Credit Card',
  UPI: 'UPI',
  Splitwise: 'Splitwise',
  Cash: 'Cash',
  Bank: 'Bank',
  Other: 'Other'
};

function evaluate(expression: string): number | null {
  const tokens = expression.match(/\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens || tokens.join('') !== expression) return null;

  const values: Array<number | string> = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '*' || token === '/') {
      const left = Number(values.pop());
      const right = Number(tokens[index + 1]);
      if (!Number.isFinite(left) || !Number.isFinite(right) || (token === '/' && right === 0)) return null;
      values.push(token === '*' ? left * right : left / right);
      index += 1;
    } else {
      values.push(token);
    }
  }

  let result = Number(values[0]);
  if (!Number.isFinite(result)) return null;
  for (let index = 1; index < values.length; index += 2) {
    const operator = values[index];
    const right = Number(values[index + 1]);
    if (!Number.isFinite(right)) return null;
    result = operator === '+' ? result + right : result - right;
  }
  return Number.isFinite(result) ? result : null;
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(amount);
}

export function QuickAddTransaction({
  form,
  setForm,
  busy,
  editingId,
  onSubmit,
  onCancelEdit,
  onToggleImport
}: Props) {
  const [expression, setExpression] = useState(form.amount ? String(form.amount) : '');

  useEffect(() => {
    setExpression(form.amount ? String(form.amount) : '');
  }, [editingId]);

  useEffect(() => {
    if (!form.amount && !form.reason && !editingId) setExpression('');
  }, [form.amount, form.reason, editingId]);

  const calculatedAmount = useMemo(() => {
    if (!expression) return 0;
    return evaluate(expression);
  }, [expression]);

  function commitExpression(nextExpression: string) {
    setExpression(nextExpression);
    const amount = nextExpression ? evaluate(nextExpression) : 0;
    if (amount !== null) setForm({ ...form, amount });
  }

  function press(key: string) {
    if (key === 'C') {
      commitExpression('');
      return;
    }
    if (key === 'backspace') {
      commitExpression(expression.slice(0, -1));
      return;
    }
    if (key === '=') {
      if (calculatedAmount === null) return;
      const next = String(Math.round((calculatedAmount + Number.EPSILON) * 100) / 100);
      commitExpression(next);
      return;
    }

    const operators = ['+', '-', '*', '/'];
    const last = expression.at(-1);
    if (operators.includes(key) && last && operators.includes(last)) {
      commitExpression(expression.slice(0, -1) + key);
      return;
    }
    if (operators.includes(key) && !expression) return;
    commitExpression(expression + key);
  }

  return (
    <section className="pop-card quick-add-card" id="transaction-form">
      <div className="pop-section-head">
        <div>
          <p className="pop-eyebrow">{editingId ? 'Editing transaction' : 'Quick add'}</p>
          <h2>{editingId ? 'Update transaction' : 'Add transaction'}</h2>
        </div>
        <span className="pop-muted">Local first</span>
      </div>

      <form onSubmit={onSubmit}>
        <div className="quick-add-display" aria-live="polite">
          <span className="expression">
            {expression.replaceAll('*', '×').replaceAll('/', '÷') || 'Enter amount'}
          </span>
          <strong>{calculatedAmount === null ? '—' : `₹${formatAmount(calculatedAmount)}`}</strong>
        </div>

        <label className="reason-field">
          <span>Reason</span>
          <input
            value={form.reason}
            onChange={(event) => setForm({ ...form, reason: event.target.value })}
            placeholder="What did you spend on?"
            required
          />
        </label>

        <div className="source-block">
          <div className="source-heading">
            <span>Source</span>
            <small>Choose where the money came from</small>
          </div>
          <div className="source-strip">
            {PAYMENT_METHODS.map((method) => (
              <button
                className={`source-chip ${form.paymentMethod === method ? 'active' : ''}`}
                key={method}
                type="button"
                onClick={() => setForm({ ...form, paymentMethod: method })}
              >
                {SOURCE_LABELS[method]}
              </button>
            ))}
          </div>
        </div>

        <div className="calculator-grid" aria-label="Calculator keypad">
          {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', 'C', '0', '.', '+'].map((key) => (
            <button
              key={key}
              type="button"
              className={`calculator-key ${['+', '-', '*', '/'].includes(key) ? 'operator' : ''} ${key === 'C' ? 'clear' : ''}`}
              onClick={() => press(key)}
            >
              {key === '*' ? '×' : key === '/' ? '÷' : key === '-' ? '−' : key}
            </button>
          ))}
          <button type="button" className="calculator-key wide" onClick={() => press('backspace')}>⌫</button>
          <button type="button" className="calculator-key equals wide" onClick={() => press('=')}>=</button>
        </div>

        <details className="transaction-details">
          <summary>More details</summary>
          <div className="details-grid">
            <label>
              Date
              <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(event) => {
                  const category = event.target.value as Category;
                  setForm({ ...form, category, subcategory: SUBCATEGORIES[category][0] });
                }}
              >
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Subcategory
              <select value={form.subcategory} onChange={(event) => setForm({ ...form, subcategory: event.target.value })}>
                {SUBCATEGORIES[form.category].map((subcategory) => <option key={subcategory} value={subcategory}>{subcategory}</option>)}
              </select>
            </label>
            <label className="full">
              Notes
              <textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>
            <label className="review-toggle full">
              <input
                type="checkbox"
                checked={Boolean(form.needsReview)}
                onChange={(event) => setForm({ ...form, needsReview: event.target.checked })}
              />
              Flag for review
            </label>
          </div>
        </details>

        <div className="quick-add-actions">
          <button className="pop-button primary" disabled={busy || !form.reason.trim() || !(form.amount > 0)} type="submit">
            {editingId ? 'Update transaction' : 'Save transaction'}
          </button>
          {editingId ? <button className="pop-button" type="button" onClick={onCancelEdit}>Cancel</button> : null}
          <button className="pop-button quiet" type="button" onClick={onToggleImport}>Import JSON</button>
        </div>
      </form>
    </section>
  );
}
