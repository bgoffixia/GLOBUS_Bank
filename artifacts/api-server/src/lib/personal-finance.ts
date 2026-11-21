import type {
  PersonalFinanceFrequency,
  PersonalFinanceKind,
  PersonalFinanceRecordInput,
  PersonalFinanceRecordUpdate,
  PersonalFinanceStatus,
} from "@workspace/api-zod";
import type { BankPersonalFinanceRecord } from "@workspace/db";

const MAX_MINOR_AMOUNT = 9_223_372_036_854_775_807n;

export type NormalizedPersonalFinanceRecord = {
  kind: PersonalFinanceKind;
  title: string;
  category: string | null;
  currency: PersonalFinanceRecordInput["currency"];
  amountMinor: bigint;
  targetAmountMinor: bigint | null;
  recordDate: string;
  dueDate: string | null;
  frequency: PersonalFinanceFrequency | null;
  status: PersonalFinanceStatus;
  notes: string | null;
};

export class PersonalFinanceValidationError extends Error {}

function parseMinorAmount(value: string, label: string): bigint {
  if (!/^\d{1,19}$/.test(value)) {
    throw new PersonalFinanceValidationError(`${label} must be a whole minor-unit amount.`);
  }
  const amount = BigInt(value);
  if (amount > MAX_MINOR_AMOUNT) {
    throw new PersonalFinanceValidationError(`${label} is above the supported limit.`);
  }
  return amount;
}

function requireDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PersonalFinanceValidationError(`${label} must be a valid calendar date.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new PersonalFinanceValidationError(`${label} must be a valid calendar date.`);
  }
  return value;
}

function optionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizePersonalFinanceRecord(
  input: PersonalFinanceRecordInput,
): NormalizedPersonalFinanceRecord {
  const title = input.title.trim();
  if (!title) {
    throw new PersonalFinanceValidationError("Enter a name for this record.");
  }

  const amountMinor = parseMinorAmount(input.amountMinor, "Amount");
  if (input.kind === "expense" && amountMinor === 0n) {
    throw new PersonalFinanceValidationError("Expense amounts must be greater than zero.");
  }

  const targetAmountMinor =
    input.targetAmountMinor == null
      ? null
      : parseMinorAmount(input.targetAmountMinor, "Target amount");
  if (input.kind === "savings") {
    if (targetAmountMinor === null || targetAmountMinor === 0n) {
      throw new PersonalFinanceValidationError("A savings goal needs a target amount greater than zero.");
    }
  } else if (targetAmountMinor !== null) {
    throw new PersonalFinanceValidationError("Target amounts are only used for savings goals.");
  }

  const dueDate =
    input.dueDate == null ? null : requireDate(input.dueDate, "Due date");
  if (dueDate && input.kind !== "bill" && input.kind !== "loan") {
    throw new PersonalFinanceValidationError("Due dates are only used for bills and loans.");
  }
  if (input.kind === "bill" && !dueDate) {
    throw new PersonalFinanceValidationError("Add a due date for this bill.");
  }

  const frequency = input.frequency ?? null;
  if (frequency && input.kind !== "bill" && input.kind !== "loan") {
    throw new PersonalFinanceValidationError("Payment frequency is only used for bills and loans.");
  }

  const status = input.status ?? (input.kind === "expense" ? "paid" : "active");
  if (input.kind === "expense" && status !== "paid") {
    throw new PersonalFinanceValidationError("Expense entries are recorded as paid.");
  }
  if (input.kind === "bill" && status === "closed") {
    throw new PersonalFinanceValidationError("Bills can be marked active or paid.");
  }

  return {
    kind: input.kind,
    title,
    category: optionalText(input.category),
    currency: input.currency,
    amountMinor,
    targetAmountMinor,
    recordDate: requireDate(input.recordDate, "Record date"),
    dueDate,
    frequency,
    status,
    notes: optionalText(input.notes),
  };
}

export function mergePersonalFinanceRecordUpdate(
  current: BankPersonalFinanceRecord,
  patch: PersonalFinanceRecordUpdate,
): NormalizedPersonalFinanceRecord {
  return normalizePersonalFinanceRecord({
    kind: current.kind,
    title: patch.title ?? current.title,
    category: patch.category === undefined ? current.category : patch.category,
    currency: patch.currency ?? current.currency,
    amountMinor: patch.amountMinor ?? current.amountMinor.toString(),
    targetAmountMinor:
      patch.targetAmountMinor === undefined
        ? current.targetAmountMinor?.toString() ?? null
        : patch.targetAmountMinor,
    recordDate: patch.recordDate ?? current.recordDate,
    dueDate: patch.dueDate === undefined ? current.dueDate : patch.dueDate,
    frequency:
      patch.frequency === undefined ? current.frequency : patch.frequency,
    status: patch.status ?? current.status,
    notes: patch.notes === undefined ? current.notes : patch.notes,
  });
}

export function personalFinanceRecordResponse(
  record: BankPersonalFinanceRecord,
) {
  return {
    id: record.id,
    kind: record.kind,
    title: record.title,
    category: record.category,
    currency: record.currency,
    amountMinor: record.amountMinor.toString(),
    targetAmountMinor: record.targetAmountMinor?.toString() ?? null,
    recordDate: record.recordDate,
    dueDate: record.dueDate,
    frequency: record.frequency,
    status: record.status,
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
