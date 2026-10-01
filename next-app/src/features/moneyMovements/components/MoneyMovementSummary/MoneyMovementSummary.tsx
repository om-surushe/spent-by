import { CATEGORIES, type Category, type MoneyMovementType } from '../../../../types';
import { formatCurrency } from '../../../../utils/format';

type MoneyMovementSummaryProps = {
  netSpent: number;
  movementCounts: Record<MoneyMovementType, number>;
  categoryTotals: Record<Category, number>;
};

export function MoneyMovementSummary({ netSpent, movementCounts, categoryTotals }: MoneyMovementSummaryProps) {
  return (
    <section className="stack">
      <article className="card stats">
        <div><p className="eyebrow">Net spent</p><strong>{formatCurrency(netSpent)}</strong></div>
        <div><p className="eyebrow">Expenses</p><strong>{movementCounts.Expense}</strong></div>
        <div><p className="eyebrow">Money back</p><strong>{movementCounts.Refund + movementCounts.Reimbursement}</strong></div>
      </article>

      <article className="card">
        <h2>This month by category</h2>
        <div className="category-grid">
          {CATEGORIES.map((category) => (
            <div className={`category-stat category-${category.toLowerCase()}`} key={category}>
              <span>{category}</span>
              <strong>{formatCurrency(categoryTotals[category])}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <h2>Product rule</h2>
        <p className="subtle">
          Record your actual share for shared expenses when known. If you record the full payment, record money returned by others as a reimbursement. Transfers between your own accounts never count as spending.
        </p>
      </article>
    </section>
  );
}
