import type { ReceiptTemplateId } from "./receipt-layouts";
import type { ReceiptTransaction } from "./transfer-receipt-data";

export const illustrativeReceiptTransaction: ReceiptTransaction = {
  id: "vault-layout-sample",
  reference: "GBX-20261120-8Q4K2P",
  type: "external_transfer",
  status: "pending",
  receiptTemplate: "standard",
  currency: "NGN",
  amount: "184500.00",
  fee: "125.00",
  counterparty: "Amina Bello · Harborline Bank",
  description: "Illustrative sample transfer request · not a real transaction",
  mode: "internal_ledger",
  transactionDate: null,
  createdAt: "2026-11-20T10:42:00.000Z",
  sender: { name: "Mariam Bello", walletLast4: "4821" },
  recipient: {
    name: "Amina Bello",
    bank: "Harborline Bank",
    country: "Nigeria",
    route: "Local routing",
    account: "••••••7314",
    transferType: "local_routing",
    routingCode: null,
    swiftBic: null,
    remark: "Illustrative request only",
  },
};

export function buildReceiptLayoutPreview(
  latestTransaction: ReceiptTransaction | undefined,
  template: ReceiptTemplateId,
) {
  return {
    transaction: {
      ...(latestTransaction ?? illustrativeReceiptTransaction),
      receiptTemplate: template,
    } satisfies ReceiptTransaction,
    illustrativeOnly: !latestTransaction,
  };
}

export function canSaveReceiptPreference(
  sessionToken: string,
  vaultAccessActive: boolean,
) {
  return sessionToken.trim().length > 0 && vaultAccessActive;
}

export function shouldClearSavedReceiptSelection(
  wasAuthorized: boolean,
  sessionToken: string,
  vaultAccessActive: boolean,
) {
  return wasAuthorized && !canSaveReceiptPreference(sessionToken, vaultAccessActive);
}

export function canExportReceipt(
  illustrativeOnly: boolean,
  completed: boolean,
) {
  return !illustrativeOnly && completed;
}

export function canPrintReceipt(illustrativeOnly: boolean) {
  return !illustrativeOnly;
}
