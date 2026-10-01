import type { TransactionRecord, VaultMeta } from '../types';

export const mockVaultMeta: VaultMeta = {
  vaultId: '0123456789abcdef0123456789abcdef',
  deviceId: '123e4567-e89b-42d3-a456-426614174000',
  createdAt: '2026-10-01T00:00:00.000Z'
};

export const mockTransactions: TransactionRecord[] = [
  {
    id: '123e4567-e89b-42d3-a456-426614174001',
    createdAt: '2026-10-01T04:30:00.000Z',
    updatedAt: '2026-10-01T04:30:00.000Z',
    deletedAt: null,
    deviceId: mockVaultMeta.deviceId,
    data: {
      amount: 90,
      reason: 'Chicken',
      date: '2026-09-30',
      category: 'Needs',
      subcategory: 'Groceries',
      paymentMethod: 'UPI',
      notes: '260 grams',
      needsReview: false,
      reviewReason: ''
    }
  },
  {
    id: '123e4567-e89b-42d3-a456-426614174002',
    createdAt: '2026-09-29T13:00:00.000Z',
    updatedAt: '2026-09-29T13:00:00.000Z',
    deletedAt: null,
    deviceId: mockVaultMeta.deviceId,
    data: {
      amount: 178.83,
      reason: 'Movie ticket',
      date: '2026-09-29',
      category: 'Wants',
      subcategory: 'Entertainment',
      paymentMethod: 'UPI',
      notes: '',
      needsReview: true,
      reviewReason: 'Confirm final amount after offers'
    }
  },
  {
    id: '123e4567-e89b-42d3-a456-426614174003',
    createdAt: '2026-09-25T08:00:00.000Z',
    updatedAt: '2026-09-25T08:00:00.000Z',
    deletedAt: null,
    deviceId: mockVaultMeta.deviceId,
    data: {
      amount: 2000,
      reason: 'Family transfer',
      date: '2026-09-30',
      category: 'Family',
      subcategory: 'Family Support',
      paymentMethod: 'Bank',
      notes: '',
      needsReview: false,
      reviewReason: ''
    }
  }
];
