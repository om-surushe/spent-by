import { SUBCATEGORIES, type BudgetSettings, type TransactionData } from './types';

export const SESSION_KEY = 'finance-vault-preview-phrase';
export const DEFAULT_WORKER_URL = window.location.port === '4174' ? 'http://127.0.0.1:8787' : window.location.origin;
export const TODAY = new Date().toISOString().slice(0, 10);

export const EMPTY_TRANSACTION: TransactionData = {
  kind: 'transaction',
  movementType: 'Expense',
  amount: 0,
  reason: '',
  date: TODAY,
  category: 'Needs',
  subcategory: SUBCATEGORIES.Needs[0],
  paymentMethod: 'UPI',
  notes: '',
  needsReview: false,
  reviewReason: ''
};

export const EMPTY_BUDGETS: BudgetSettings = {
  Needs: 0,
  Wants: 0,
  Family: 0,
  Miscellaneous: 0
};
