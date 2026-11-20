import type { ReceiptTemplateId } from "./receipt-layouts";
import type { ReceiptTransaction } from "./transfer-receipt-data";

export const illustrativeReceiptTransaction: ReceiptTransaction = {
  id: "vault-layout-sample",
  reference: "GV-ILLUSTRATIVE-240618",
  type: "external_transfer",
  status: "pending",
  receiptTemplate: "standard",
  currency: "NGN",
  amount: "184500.00",
  fee: "125.00",
  counterparty: "Sample recipient · Example Bank",
  description: "Illustrative sample transfer · not a real transaction",
  mode: "internal_ledger",
  createdAt: "2025-06-18T10:42:00.000Z",
  sender: { name: "Sample Globus customer", walletLast4: "4821" },
  recipient: {
    name: "Sample recipient",
    bank: "Example Bank",
    country: "Nigeria",
    route: "Local routing",
    account: "••••••7314",
    transferType: "local_routing",
    routingCode: null,
    swiftBic: null,
    remark: "Illustrative preview only",
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
