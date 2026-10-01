import type { MoneyMovementType, TransactionRecord } from '../types';

export function getMovementType(record: TransactionRecord): MoneyMovementType {
  return record.data.movementType ?? 'Expense';
}

export function getSpendingImpact(record: TransactionRecord): number {
  switch (getMovementType(record)) {
    case 'Expense':
      return record.data.amount;
    case 'Refund':
    case 'Reimbursement':
      return -record.data.amount;
    case 'Income':
    case 'Transfer':
      return 0;
  }
}

export function getMovementSign(type: MoneyMovementType): '+' | '-' | '•' {
  if (type === 'Income' || type === 'Refund' || type === 'Reimbursement') return '+';
  if (type === 'Expense') return '-';
  return '•';
}
