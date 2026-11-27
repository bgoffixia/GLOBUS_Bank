import { getGetBankReceiptPreferencesQueryKey } from "@workspace/api-client-react";
import type { ReceiptTemplate } from "@workspace/api-client-react";

export const RECEIPT_LAYOUTS = [
  {
    id: "standard",
    label: "Standard receipt",
    summary: "A balanced, one-page transaction record.",
    preview: "classic",
  },
  {
    id: "bank_payment",
    label: "Bank payment record",
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
    label: "Transfer ledger",
    summary: "A compact ledger-style record with reference details.",
    preview: "ledger",
  },
  {
    id: "settlement_statement",
    label: "Settlement statement",
    summary: "A formal statement layout for a Globus transaction.",
    preview: "statement",
  },
  {
    id: "editorial_ledger",
    label: "Editorial ledger",
    summary: "A typographic, annotated record with a clear amount hierarchy.",
    preview: "editorial",
  },
  {
    id: "transfer_ledger_columnar",
    label: "Columnar ledger",
    summary: "A columnar posting record for quick ledger review.",
    preview: "columnar",
  },
  {
    id: "settlement_ledger",
    label: "Settlement ledger",
    summary: "A structured ledger summary with recorded status and counterparties.",
    preview: "settlement-ledger",
  },
  {
    id: "reconciliation_statement",
    label: "Reconciliation statement",
    summary: "A reconciliation-first document for comparing recorded fields.",
    preview: "reconciliation",
  },
  {
    id: "settlement_timeline",
    label: "Settlement timeline",
    summary: "A time-led record of the transaction and its current DUTSTAR status.",
    preview: "timeline",
  },
  {
    id: "archival_statement",
    label: "Archival statement",
    summary: "A formal archive copy for long-term account records.",
    preview: "archive",
  },
] as const;

/** Mirrors the expanded OpenAPI ReceiptTemplate enum scheduled for regeneration. */
export type ReceiptTemplateId = ReceiptTemplate;

export function receiptPreferencesQueryKey(userId: string | undefined) {
  return [...getGetBankReceiptPreferencesQueryKey(), userId ?? "signed-out"];
}

export function isReceiptTemplateId(value: unknown): value is ReceiptTemplateId {
  return RECEIPT_LAYOUTS.some(layout => layout.id === value);
}
