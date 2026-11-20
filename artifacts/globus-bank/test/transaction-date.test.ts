import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  customerTransactionDate,
  transactionDateInputValue,
} from '../src/lib/transaction-date';

test('customer history uses an explicit calendar date without timezone shifting', () => {
  const actual = customerTransactionDate('2026-03-01', '2026-02-28T23:30:00.000Z');
  const expected = new Date(2026, 2, 1).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  assert.equal(actual, expected);
  assert.notEqual(actual, customerTransactionDate(null, '2026-02-28T23:30:00.000Z'));
});

test('admin date editor keeps a custom date or falls back to the immutable record date', () => {
  assert.equal(transactionDateInputValue('2026-11-20', '2026-11-19T23:30:00.000Z'), '2026-11-20');
  assert.equal(transactionDateInputValue(null, '2026-11-19T23:30:00.000Z'), '2026-11-19');
});
