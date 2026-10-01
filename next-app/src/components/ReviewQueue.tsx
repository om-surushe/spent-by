import type { TransactionRecord } from '../types';
import { formatCurrency } from '../utils/format';

type Props = {
  records: TransactionRecord[];
  busy: boolean;
  onEdit: (record: TransactionRecord) => void;
  onMarkReviewed: (record: TransactionRecord) => void;
};

export function ReviewQueue({ records, busy, onEdit, onMarkReviewed }: Props) {
  const flagged = records.filter((record) => record.data.needsReview);

  return (
    <section className="card full-span">
      <div className="section-head">
        <div><p className="eyebrow">Review queue</p><h2>Transactions needing attention</h2></div>
        <strong>{flagged.length}</strong>
      </div>
      <div className="review-grid">
        {flagged.map((record) => (
          <article className="review-card" key={record.id}>
            <span>{record.data.date}</span>
            <strong>{formatCurrency(record.data.amount)}</strong>
            <h3>{record.data.reason}</h3>
            <p>{record.data.reviewReason || 'Check the category or details.'}</p>
            <div className="actions">
              <button className="button" onClick={() => onEdit(record)}>Edit details</button>
              <button className="button primary" disabled={busy} onClick={() => onMarkReviewed(record)}>Mark reviewed</button>
            </div>
          </article>
        ))}
        {flagged.length === 0 ? <p className="empty">Review queue is clear.</p> : null}
      </div>
    </section>
  );
}
