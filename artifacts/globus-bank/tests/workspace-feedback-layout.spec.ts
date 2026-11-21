import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { calculateReceiptFit } from '../src/lib/receipt-fit';

const source = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const shell = source('../src/components/bank-shell.tsx');
const dashboard = source('../src/pages/bank-pages.tsx');
const financeWidget = source('../src/pages/personal-finance/personal-finance.tsx');
const transfer = source('../src/components/transfer/transfer-wizard.tsx');
const appStyles = source('../src/index.css');
const receipt = source('../src/components/transfer/transfer-receipt.tsx');
const receiptFit = source('../src/lib/receipt-fit.ts');
const toastHook = source('../src/hooks/use-toast.ts');
const toaster = source('../src/components/ui/toaster.tsx');
const notificationCenter = source('../src/components/notifications-center.tsx');
const transferRoutes = source('../../api-server/src/routes/bank.ts');
const notificationDelivery = source('../../api-server/src/lib/transfer-notifications.ts');

test('transfer workspace uses the available width and allows the page to scroll vertically', () => {
  expect(shell).toContain("isDashboard || isTransfer ? 'max-w-none px-3 sm:px-6'");
  expect(transfer).toContain('className="transfer-page flex min-h-full w-full flex-col"');
  expect(transfer).toContain('className="mx-auto flex min-h-full w-full flex-1 flex-col py-0"');
  expect(transfer).not.toContain('max-w-[680px]');
  expect(source('../src/index.css')).toContain('overflow-y: auto');
});

test('dashboard keeps the balance card sticky and scrolls long ledger sections internally', () => {
  expect(dashboard).toContain('data-testid="dashboard-workspace" className="flex min-h-full w-full flex-col"');
  expect(dashboard).toContain('data-testid="dashboard-sticky-balance" className="balance-panel sticky top-0');
  expect(dashboard).toContain('data-testid="dashboard-content-grid" className="mt-2 grid min-h-0 min-w-0 flex-1');
  expect(financeWidget).toContain('data-testid="dashboard-ledger-scroll"');
  expect(appStyles).toContain('.dashboard-ledger-scroll');
  expect(appStyles).toContain('overflow-y: auto');
  expect(appStyles).toContain('max-height: min(44dvh, 20rem)');
  expect(shell).toContain('isDashboard ? \'min-h-full pb-24');
});

test('transfer page omits the screenshot-matched ledger disclaimer banner', () => {
  expect(transfer).not.toContain('Transfer details are recorded on the Globus ledger. No outside bank receives funds.');
  expect(transfer).not.toContain('<ShieldCheck');
});

test('receipt is a borderless full-page view with compact save and share controls', () => {
  expect(receipt).toContain('receipt-backdrop fixed inset-0 z-50 overflow-hidden bg-[#fffefa]');
  expect(receipt).toContain('className="receipt-dialog relative flex w-full max-w-none flex-col overflow-x-hidden overflow-y-auto bg-[#fffefa]"');
  expect(receipt).toContain('data-testid="button-share-receipt"');
  expect(receipt).toContain('data-testid="button-save-receipt-png"');
  expect(receipt).toContain('inline-flex h-7 items-center');
  expect(receiptFit).toContain('Math.min(1, availableHeight / documentHeight)');
  expect(receiptFit).toContain('viewportHeight');
});

test('receipt fitting uses the full viewport and preserves space for actions', () => {
  const long = calculateReceiptFit(1000, 100, 1000);
  expect(long.maxDialogHeight).toBe(1000);
  expect(long.availableHeight).toBe(892);
  expect(long.scale).toBeCloseTo(0.892);
  expect(long.height).toBe(892);

  const short = calculateReceiptFit(400, 80, 800);
  expect(short.scale).toBe(1);
  expect(short.height).toBe(400);
});

test('global action feedback closes after five seconds', () => {
  expect(toaster).toContain('<ToastProvider duration={5000}>');
  expect(toastHook).toContain('const TOAST_REMOVE_DELAY = 700');
  expect(transfer).toContain("variant: 'destructive',\n          duration: 5000");
  expect(receipt).toContain("variant: 'destructive',\n        duration: 5000");
});

test('new in-app notices toast while transfer push delivery remains wired', () => {
  expect(notificationCenter).toContain('refetchInterval: 15_000');
  expect(notificationCenter).toContain('notifications.data.filter(item => !seen.ids.has(item.id))');
  expect(notificationCenter).toContain('title: newest.title');
  expect(transferRoutes).toContain('void sendPushToUser(notification.userId, notification)');
  expect(notificationDelivery).toContain('https://api.webpushr.com/v1/notification/send/sid');
});
