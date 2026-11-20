import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import type { InternationalTransferRequest } from '@workspace/api-client-react';
import { receiptFromRequest } from '../src/lib/transfer-receipt-data';
import {
  ReceiptTemplateMiniPreview,
  receiptTemplateOptions,
} from '../src/lib/receipt-template';
import { calculateReceiptFit } from '../src/lib/receipt-fit';
import { saveReceiptFileToDevice } from '../src/lib/receipt-file-delivery';

test('the Vault offers five distinct receipt presets with a rendered preview', () => {
  assert.deepEqual(
    receiptTemplateOptions.map((option) => option.value),
    ['standard', 'bank_payment', 'transfer_journey', 'transfer_ledger', 'settlement_statement'],
  );

  for (const option of receiptTemplateOptions) {
    const html = renderToStaticMarkup(
      createElement(ReceiptTemplateMiniPreview, { template: option.value }),
    );
    assert.match(html, new RegExp(`data-testid="receipt-template-preview-${option.value}"`));
    assert.ok(option.label.length > 0);
    assert.ok(option.description.length > 0);
  }
});

test('a future transfer receipt uses the immutable layout saved with that request', () => {
  const request = {
    id: 'tx-receipt-test',
    reference: 'GB-RECEIPT-TEST',
    status: 'completed',
    receiptTemplate: 'settlement_statement',
    transferType: 'local_routing',
    destinationCountry: 'Nigeria',
    recipientBank: 'Globus test bank',
    routingCode: '000001',
    swiftBic: null,
    senderName: 'Globus member',
    sourceWalletLast4: '1234',
    recipientAccountName: 'Test recipient',
    recipientEmail: null,
    recipientEmailNotificationSkipped: false,
    recipientAccountLast4: '5678',
    sourceCurrency: 'USD',
    sourceAmount: '12.00',
    destinationCurrency: 'USD',
    destinationAmount: '12.00',
    exchangeRate: '1',
    rateUpdatedAt: '2026-01-01T00:00:00.000Z',
    remark: '',
    createdAt: '2026-01-01T00:00:00.000Z',
  } as InternationalTransferRequest;

  const receipt = receiptFromRequest(request);
  assert.equal(receipt.receiptTemplate, 'settlement_statement');
  assert.equal(receipt.reference, request.reference);
  assert.equal(receipt.mode, 'internal_ledger');
});

test('every receipt scales below the available screen height while keeping actions visible', () => {
  for (const viewportHeight of [320, 600, 844, 1024]) {
    const actionHeight = 92;
    const fit = calculateReceiptFit(1100, actionHeight, viewportHeight);
    assert.ok(fit.scale > 0);
    assert.ok(fit.scale <= 0.86);
    assert.ok(fit.height + actionHeight + 8 <= fit.maxDialogHeight);
  }
});

test('PNG save opens native device sharing when supported and downloads otherwise', async () => {
  const file = new File(['receipt'], 'globus-receipt.png', { type: 'image/png' });
  let shared = false;
  let downloaded = false;
  const share = async (data: ShareData) => {
    shared = data.files?.[0] === file;
  };
  const download = () => { downloaded = true; };

  assert.equal(
    await saveReceiptFileToDevice(file, share, () => true, download),
    'shared',
  );
  assert.equal(shared, true);
  assert.equal(downloaded, false);

  assert.equal(
    await saveReceiptFileToDevice(file, undefined, undefined, download),
    'downloaded',
  );
  assert.equal(downloaded, true);
});
