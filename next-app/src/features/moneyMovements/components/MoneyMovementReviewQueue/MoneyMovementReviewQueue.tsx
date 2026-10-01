import { getMovementType } from '../../../../domain/moneyMovement';
import type { TransactionRecord } from '../../../../types';
import { formatCurrency } from '../../../../utils/format';

type MoneyMovementReviewQueueProps = {
  records: TransactionRecord[];
  busy: boolean;
  onEdit: (record: TransactionRecord) => void;
  onMarkReviewed: (record: TransactionRecord) => void;
};

export function MoneyMovementReviewQueue({ records, busy, onEdit, onMarkReviewed }: MoneyMovementReviewQueueProps) {
  return (
    <section className="card full-span">
      <div className="section-head">
        <div><p className="eyebrow">Review</p><h2>Needs attention</h2></div>
        <strong>{records.length}</strong>
      </div>
      <div className="review-grid">
        {records.map((record) => (
          <article className="review-card" key={record.id}>
            <span>{getMovementType(record)} · {record.data.date}</span>
            <strong>{formatCurrency(record.data.amount)}</strong>
            <h3>{record.data.reason}</h3>
            <p>{record.data.reviewReason || 'Verify the details.'}</p>
            <div className="actions">
              <button className="button" onClick={() => onEdit(record)}>Edit</button>
              <button className="button primary" disabled={busy} onClick={() => onMarkReviewed(record)}>Mark reviewed</button>
            </div>
          </article>
        ))}
        {records.length === 0 ? <p className="empty">Review queue is clear.</p> : null}
      </div>
    </section>
  );
}
