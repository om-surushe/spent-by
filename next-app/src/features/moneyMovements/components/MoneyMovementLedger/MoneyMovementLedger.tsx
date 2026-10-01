import { getMovementSign, getMovementType } from '../../../../domain/moneyMovement';
import type { TransactionRecord } from '../../../../types';
import { formatCurrency } from '../../../../utils/format';
import './MoneyMovementLedger.css';

type MoneyMovementLedgerProps = {
  records: TransactionRecord[];
  totalCount: number;
  onEdit: (record: TransactionRecord) => void;
};

export function MoneyMovementLedger({ records, totalCount, onEdit }: MoneyMovementLedgerProps) {
  return (
    <section className="card ledger full-span">
      <div className="section-head">
        <div><p className="eyebrow">Recent</p><h2>Money movements</h2></div>
        <span className="subtle">{totalCount} total</span>
      </div>

      <div className="ledger__list">
        {records.map((record) => {
          const type = getMovementType(record);
          return (
            <article className="ledger__row" key={record.id}>
              <div className="ledger__details">
                <strong>{record.data.reason}</strong>
                <p>{type} · {record.data.category} · {record.data.subcategory} · {record.data.paymentMethod}</p>
                <p className="subtle">{record.data.date}{record.data.notes ? ` · ${record.data.notes}` : ''}</p>
              </div>
              <div className="ledger__side">
                <strong>{getMovementSign(type)} {formatCurrency(record.data.amount)}</strong>
                <button className="button" onClick={() => onEdit(record)}>Edit</button>
              </div>
            </article>
          );
        })}
        {records.length === 0 ? <p className="empty">No money movements yet.</p> : null}
      </div>
    </section>
  );
}
