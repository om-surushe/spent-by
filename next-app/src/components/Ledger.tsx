import type { TransactionRecord } from '../types';
import { formatCurrency, formatMonth } from '../utils/format';

type Props = {
  records: TransactionRecord[];
  visibleRecords: TransactionRecord[];
  search: string;
  month: string;
  months: string[];
  onSearchChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onEdit: (record: TransactionRecord) => void;
  onDelete: (id: string) => void;
};

export function Ledger({
  visibleRecords,
  search,
  month,
  months,
  onSearchChange,
  onMonthChange,
  onEdit,
  onDelete
}: Props) {
  return (
    <section className="card ledger full-span">
      <div className="section-head">
        <div><p className="eyebrow">Ledger</p><h2>Transactions</h2></div>
        <span className="subtle">{visibleRecords.length} shown</span>
      </div>
      <div className="filters">
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search reason, notes, or category" />
        <select value={month} onChange={(event) => onMonthChange(event.target.value)}>
          <option value="All">All months</option>
          {months.map((value) => <option key={value} value={value}>{formatMonth(value)}</option>)}
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
                <strong>{formatCurrency(record.data.amount)}</strong>
                <div className="actions">
                  <button className="button" onClick={() => onEdit(record)}>Edit</button>
                  <button className="button danger" onClick={() => onDelete(record.id)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
