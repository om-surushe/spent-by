import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAmount } from './money.ts';

test('normalizes an exact two-decimal amount', () => {
  assert.equal(normalizeAmount(123.45), 123.45);
});

test('rejects invalid money amounts', () => {
  for (const value of [0, -1, Number.POSITIVE_INFINITY, 1.234, 10_000_000.01]) {
    assert.throws(() => normalizeAmount(value));
  }
});
