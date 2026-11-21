import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const pages = readFileSync(
  new URL('../src/pages/bank-pages.tsx', import.meta.url),
  'utf8',
);
const vaultPanel = readFileSync(
  new URL('../src/components/private-vault-panel.tsx', import.meta.url),
  'utf8',
);

test('landing stays illustrative and describes Globus account records accurately', () => {
  expect(pages).toContain('data-testid="landing-hero-institute-illustration"');
  expect(pages).toContain('Illustrative institute artwork');
  expect(pages).toContain('A stylized neoclassical bank facade');
  expect(pages).toContain('Review your currency balances and the entries recorded in your Globus account');
  expect(pages).toContain('Search internal Globus ledger activity');
  expect(pages).toContain(`Standard ${String.fromCodePoint(0x1f3e6)}`);
  expect(pages).not.toContain('Routed transfer');
});

test('dashboard preview is limited to three rows without receipt shortcuts', () => {
  expect(pages).toContain('recentTransactions.slice(0, 3)');
  expect(pages).toContain('showReceipt={false}');
  expect(pages).toContain('canPrintReceipt && showReceipt');
  expect(pages).toContain('aria-label={`View receipt ${transaction.reference}`}');
});

test('activity history keeps currency search, filtering and receipt access', () => {
  expect(pages).toContain('useListBankTransactions(params, { query: { queryKey: getListBankTransactionsQueryKey(params) } })');
  expect(pages).toContain('data-testid="input-transaction-search"');
  expect(pages).toContain('data-testid="select-transaction-currency"');
  expect(pages).toContain('<TransactionList transactions={query.data} />');
});

test('wallet list and detail retain generated contracts and truthful reference copy', () => {
  expect(pages).toContain('useListBankWallets({ query: { queryKey: getListBankWalletsQueryKey() } })');
  expect(pages).toContain('useGetBankProfile({ query: { queryKey: getGetBankProfileQueryKey() } })');
  expect(pages).toContain('data-testid="wallet-list"');
  expect(pages).toContain('data-testid="wallet-detail-reference-disclosure"');
  expect(pages).toContain('This reference identifies your wallet inside Globus; it is not a bank account or payment destination.');
});

test('withdrawal page removes the large administrator warning without changing the request form', () => {
  expect(pages).not.toContain('Administrator review required');
  expect(pages).toContain('data-testid="withdrawal-request-form"');
  expect(pages).toContain('Available to withdraw:');
});

test('wallet policies default transfers to successful when Vault access is inactive', () => {
  expect(vaultPanel).toContain('The future transfer status defaults to Successful without active Vault access.');
  expect(vaultPanel).toContain('Active access is required to view or change wallet policies.');
});
