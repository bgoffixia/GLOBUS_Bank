import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReceiptTransaction } from "../src/lib/transfer-receipt-data";
import {
  buildReceiptLayoutPreview,
  canExportReceipt,
  canPrintReceipt,
  canSaveReceiptPreference,
  shouldClearSavedReceiptSelection,
} from "../src/lib/vault-receipt-preview";
import { RECEIPT_LAYOUTS } from "../src/lib/receipt-layouts";

test("all receipt layouts can be previewed without a Vault session using non-exportable sample data", () => {
  for (const { id } of RECEIPT_LAYOUTS) {
    const preview = buildReceiptLayoutPreview(undefined, id);
    assert.equal(preview.illustrativeOnly, true);
    assert.equal(preview.transaction.receiptTemplate, id);
    assert.equal(preview.transaction.status, "pending");
    assert.match(preview.transaction.description, /illustrative sample/i);
    assert.equal(canExportReceipt(preview.illustrativeOnly, true), false);
    assert.equal(canPrintReceipt(preview.illustrativeOnly), false);
  }
});

test("live previews apply the selected template to a copy, preserving the saved transaction snapshot", () => {
  const transaction = {
    id: "tx-live-preview",
    reference: "GB-LIVE-PREVIEW",
    type: "external_transfer",
    status: "completed",
    receiptTemplate: "standard",
    currency: "NGN",
    amount: "2500.00",
    fee: "0.00",
    counterparty: "Current recipient · Current bank",
    description: "Current transfer from account history",
    mode: "internal_ledger",
    createdAt: "2026-11-20T09:00:00.000Z",
  } as ReceiptTransaction;

  const preview = buildReceiptLayoutPreview(transaction, "transfer_journey");
  assert.equal(preview.illustrativeOnly, false);
  assert.notEqual(preview.transaction, transaction);
  assert.equal(preview.transaction.reference, transaction.reference);
  assert.equal(preview.transaction.description, transaction.description);
  assert.equal(preview.transaction.receiptTemplate, "transfer_journey");
  assert.equal(transaction.receiptTemplate, "standard");
  assert.equal(canExportReceipt(preview.illustrativeOnly, true), true);
  assert.equal(canPrintReceipt(preview.illustrativeOnly), true);
});

test("saving a receipt preference requires both an unlocked session and active Vault access", () => {
  assert.equal(canSaveReceiptPreference("", true), false);
  assert.equal(canSaveReceiptPreference("session-token", false), false);
  assert.equal(canSaveReceiptPreference("   ", true), false);
  assert.equal(canSaveReceiptPreference("session-token", true), true);
});

test("a private saved selection is cleared after access is lost, not during public preview", () => {
  assert.equal(shouldClearSavedReceiptSelection(false, "", false), false);
  assert.equal(shouldClearSavedReceiptSelection(false, "", true), false);
  assert.equal(shouldClearSavedReceiptSelection(true, "", true), true);
  assert.equal(shouldClearSavedReceiptSelection(true, "session-token", false), true);
  assert.equal(shouldClearSavedReceiptSelection(true, "session-token", true), false);
});
