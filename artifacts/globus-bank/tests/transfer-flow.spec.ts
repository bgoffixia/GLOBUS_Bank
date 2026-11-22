import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const wizard = readFileSync(
  new URL('../src/components/transfer/transfer-wizard.tsx', import.meta.url),
  'utf8',
);
const receipt = readFileSync(
  new URL('../src/components/transfer/transfer-receipt.tsx', import.meta.url),
  'utf8',
);
const vaultPanel = readFileSync(
  new URL('../src/components/private-vault-panel.tsx', import.meta.url),
  'utf8',
);

test('transfer flow groups destination and recipient into the first step', () => {
  expect(wizard).toContain("const STEPS = ['Details', 'Amount & review', 'PIN'] as const");
  expect(wizard).toContain('Recipient & destination');
  expect(wizard).toContain('{step === 0 && <>');
  expect(wizard).toContain('data-testid="input-recipient-account-name"');
  expect(wizard).toContain('data-testid="input-recipient-account-number"');
  expect(wizard).toContain('compact />');
});

test('amount, conversion, recipient review, and confirmation share the second step', () => {
  expect(wizard).toContain('{step === 1 && <>');
  expect(wizard).toContain('data-testid="input-international-amount"');
  expect(wizard).toContain('data-testid="conversion-quote"');
  expect(wizard).toContain('data-testid="transfer-review"');
  expect(wizard).toContain('data-testid="checkbox-confirm-transfer"');
  expect(wizard).toContain('data-testid="text-review-account"');
  expect(wizard).toContain('const confirmed = confirmationFingerprint !== null && confirmationFingerprint === fingerprint');
  expect(wizard).not.toContain('setConfirmed(');
  expect(wizard).toContain('if (pending || !stepValid[2] || !rateSnapshot) return;');
  expect(wizard).not.toContain('stepValid[4]');
});

test('transfer history preview is removed while receipt creation remains', () => {
  expect(wizard).not.toContain('Transfer history');
  expect(wizard).not.toContain('useListInternationalTransferRequests');
  expect(wizard).toContain('getListInternationalTransferRequestsQueryKey()');
  expect(wizard).toContain('<TransferReceiptModal');
});

test('transfer receipt hides the underlying wizard Continue action', () => {
  expect(wizard).toContain('{!receipt && <div className="mt-auto flex items-center');
  expect(wizard).toContain('<TransferReceiptModal transaction={receipt}');
  expect(receipt).not.toContain('>Continue<');
});

test('form fields and selector controls have compact transfer-only sizing', () => {
  expect(wizard).toContain("const inputCls = 'h-10");
  expect(wizard).toContain('placeholder:text-[10px]');
  const bankSelect = readFileSync(
    new URL('../src/components/bank-select.tsx', import.meta.url),
    'utf8',
  );
  const countrySelect = readFileSync(
    new URL('../src/components/country-select.tsx', import.meta.url),
    'utf8',
  );
  expect(bankSelect).toContain('compact ?');
  expect(countrySelect).toContain('compact ?');
});

test('recipient email alert toggle saves immediately and refreshes transfer eligibility', () => {
  expect(vaultPanel).toContain('saveRecipientEmailAlertPreference');
  expect(vaultPanel).toContain('data: { transactionEmailAlertsEnabled: enabled }');
  expect(vaultPanel).toContain('onChange={event => void saveRecipientEmailAlertPreference(event.currentTarget.checked)}');
  expect(vaultPanel).toContain('setQueryData(\n        getGetBankVaultTransferEmailAlertQueryKey()');
  expect(vaultPanel).toContain('status-recipient-email-alert-saved');
  expect(wizard).toContain("refetchOnMount: 'always'");
});

test('professional transfer preview has no horizontal overflow on supported screens', async ({ page }) => {
  test.skip(!process.env.GLOBUS_TRANSFER_PREVIEW_TEST, 'Run against the isolated transfer mockup preview.');
  const widths = [320, 360, 390, 768, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('preview/transfer-wizard/Professional', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'New transfer' })).toBeVisible();
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await continueButton.scrollIntoViewIfNeeded();
    await expect(continueButton).toBeVisible();
    const measurements = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(measurements.document, `${width}px document width`).toBeLessThanOrEqual(measurements.viewport);
    expect(measurements.body, `${width}px body width`).toBeLessThanOrEqual(measurements.viewport);
  }
});
