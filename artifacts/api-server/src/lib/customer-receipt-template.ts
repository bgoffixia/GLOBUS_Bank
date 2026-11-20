import { ReceiptTemplate } from "@workspace/api-zod";

export type ReceiptTemplateId =
  (typeof ReceiptTemplate)[keyof typeof ReceiptTemplate];

const supportedReceiptTemplates = new Set<string>(
  Object.values(ReceiptTemplate),
);

export function withCustomerReceiptTemplate<T extends Record<string, unknown>>(
  values: T,
  preferredTemplate: string | null | undefined,
): T & { receiptTemplate: ReceiptTemplateId } {
  const receiptTemplate = supportedReceiptTemplates.has(preferredTemplate ?? "")
    ? (preferredTemplate as ReceiptTemplateId)
    : ReceiptTemplate.standard;

  return { ...values, receiptTemplate };
}
