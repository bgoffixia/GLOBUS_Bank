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
const vault = source('../src/components/private-vault-panel.tsx');
const support = source('../src/components/support-messaging.tsx');
const app = source('../src/App.tsx');
const adminSupportRoutes = source('../../api-server/src/routes/bankAdmin.ts');
const customerSupportRoutes = source('../../api-server/src/routes/bank.ts');
const adminVaultAccess = source('../src/components/admin-vault-access-page.tsx');
const contactPage = source('../src/pages/bank-pages.tsx');

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
  expect(dashboard).toContain('min-w-0 w-full overflow-hidden');
  expect(dashboard).toContain('data-testid="dashboard-content-grid" className="mt-2 grid min-h-0 min-w-0 flex-1');
  expect(financeWidget).toContain('data-testid="dashboard-ledger-scroll"');
  expect(financeWidget).toContain('data-testid="dashboard-ledger-summary-scroll"');
  expect(appStyles).toContain('.dashboard-ledger-scroll');
  expect(appStyles).toContain('overflow-y: auto');
  expect(appStyles).toContain('max-height: min(44dvh, 20rem)');
  expect(appStyles).toContain('.dashboard-ledger-summary-scroll');
  expect(appStyles).toContain('max-height: min(34dvh, 15rem)');
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

test('Vault fills the page and keeps long service content in its internal scroller', () => {
  expect(appStyles).toContain('.vault-unlocked-shell');
  expect(appStyles).toContain('grid-template-rows: auto auto minmax(0, 1fr)');
  expect(appStyles).toContain('.vault-page-content');
  expect(appStyles).toContain('overflow-y: auto');
  expect(vault).toContain('data-testid="vault-readonly-preview-banner"');
  expect(vault).toContain('data-testid={`vault-wallet-policy-preview-${wallet.id}`}');
  expect(vault).toContain('Read-only preview. Defaults are examples, not your saved policies.');
  expect(vault).toContain('required to load saved choices and make changes');
  expect(vault).toContain('disabled={!vaultAccessActive}');
});

test('admin Vault grants display expiry and offer the approved durations', () => {
  expect(adminVaultAccess).toContain('select-admin-vault-grant-duration');
  expect(adminVaultAccess).toContain('<option value="7d">7 days</option>');
  expect(adminVaultAccess).toContain('<option value="30d">30 days</option>');
  expect(adminVaultAccess).toContain('<option value="90d">90 days</option>');
  expect(adminVaultAccess).toContain('<option value="permanent">No expiry</option>');
  expect(adminVaultAccess).toContain('record.adminGrantExpiresAt');
});

test('inactive Vault access previews services while keeping changes disabled', () => {
  expect(vault).toContain('Preview only. Your saved settings load after you have an active subscription or administrator grant.');
  expect(vault).toContain('Preview only. Saved alert choices load after you have an active subscription or administrator grant.');
  expect(vault).toContain('Private notes are available with Vault access');
  expect(vault).toContain('button-save-receipt-preference');
  expect(vault).toContain('disabled={!canSaveReceiptPreference(vaultSessionActive, vaultAccessActive)');
  expect(vault).toContain('accessActive');
});

test('support pages are routed, owned, allowlisted, audited, and refresh messages live', () => {
  expect(app).toContain('path="/support"');
  expect(app).toContain('path="/admin/support"');
  expect(support).toContain('refetchInterval: 5000');
  expect(support).toContain('refetchInterval: 15000');
  expect(support).toContain('useListBankSupportConversations');
  expect(support).toContain('useListAdminSupportConversations');
  expect(customerSupportRoutes).toContain('eq(bankSupportConversationsTable.userId, user.id)');
  expect(adminSupportRoutes).toContain('action: "support_reply"');
  expect(adminSupportRoutes).toContain('requireAdmin');
  expect(contactPage).toContain('Globus support cannot complete, trace, or reverse payments made outside this product.');
});
