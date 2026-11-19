import { getGetBankReceiptPreferencesQueryKey } from "@workspace/api-client-react";

export const RECEIPT_LAYOUTS = [
  {
    id: "standard",
    label: "Classic receipt",
    summary: "A balanced, one-page transaction record.",
    preview: "classic",
  },
  {
    id: "bank_payment",
    label: "Payment details",
    summary: "A structured layout for amounts and counterparties.",
    preview: "details",
  },
  {
    id: "transfer_journey",
    label: "Transfer journey",
    summary: "A visual summary of the recorded activity and status.",
    preview: "journey",
  },
  {
    id: "transfer_ledger",
    label: "Ledger timeline",
    summary: "A compact ledger-style record with reference details.",
    preview: "ledger",
  },
  {
    id: "settlement_statement",
    label: "Statement",
    summary: "A formal statement layout for a Globus transaction.",
    preview: "statement",
  },
] as const;

export type ReceiptTemplateId = (typeof RECEIPT_LAYOUTS)[number]["id"];

export function receiptPreferencesQueryKey(userId: string | undefined) {
  return [...getGetBankReceiptPreferencesQueryKey(), userId ?? "signed-out"];
}

export function isReceiptTemplateId(value: unknown): value is ReceiptTemplateId {
  return RECEIPT_LAYOUTS.some(layout => layout.id === value);
}
