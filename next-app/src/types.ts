export const CATEGORIES = ['Needs', 'Wants', 'Family', 'Miscellaneous'] as const;
export const PAYMENT_METHODS = ['Card', 'UPI', 'Splitwise', 'Cash', 'Bank', 'Other'] as const;

export const SUBCATEGORIES = {
  Needs: ['Rent', 'Food Maid', 'Cleaning Maid', 'Groceries', 'Transport', 'Electricity', 'WiFi', 'Home Travel', 'Home Sent', 'Home EMI', 'Recharge', 'Medical', 'Education', 'Household', 'Other Needs'],
  Wants: ['Eating Out', 'Sports', 'Subscriptions', 'Entertainment', 'Shopping', 'Personal Care', 'Snacks', 'Other Wants'],
  Family: ['Family Support', 'Family Food', 'Family Recharge', 'Family Medical', 'Gifts', 'Events', 'Other Family'],
  Miscellaneous: ['Fixed Home Expense', 'Recoverable', 'One-time', 'Travel', 'Unclear']
} as const;

export type Category = string;
export type PaymentMethod = string;
export type Subcategory = string;

export type TransactionData = {
  kind?: 'transaction' | 'settings';
  amount: number;
  reason: string;
  date: string;
  category: Category;
  subcategory: string;
  paymentMethod: PaymentMethod;
  notes: string;
  needsReview?: boolean;
  reviewReason?: string;
  settings?: BudgetSettings;
};

export type BudgetSettings = Record<string, number>;

export type EncryptedRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
  iv: string;
  encryptedData: string;
};

export type TransactionRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deviceId: string;
  data: TransactionData;
};

export type VaultMeta = {
  vaultId: string;
  deviceId: string;
  createdAt: string;
};

export type VaultManifest = {
  vaultId: string;
  authHash: string;
  createdAt: string;
  updatedAt: string;
  storageBytes: number;
  recentRequestIds: string[];
  records: Array<{
    id: string;
    updatedAt: string;
    deletedAt: string | null;
    deviceId: string;
    sizeBytes: number;
  }>;
};

export type SyncStatus = 'idle' | 'pending' | 'offline' | 'ok' | 'error';

export type SyncSnapshot = {
  manifest: VaultManifest;
  records: EncryptedRecord[];
};
