import type {
  BankFinancialAccount,
  FinanceLedgerDirection,
  FinanceLoanApplicationInput,
  FinancialAccountInput,
  FinancialAccountUpdate,
} from "@workspace/api-zod";
import type {
  BankFinanceLoanApplication as DbLoanApplication,
  BankFinancialAccount as DbFinancialAccount,
} from "@workspace/db";

const MAX_MINOR_AMOUNT = 9_223_372_036_854_775_807n;

export type NormalizedFinancialAccount = {
  type: FinancialAccountInput["type"];
  name: string;
  currency: FinancialAccountInput["currency"];
  currentValueMinor: bigint;
  targetAmountMinor: bigint | null;
  openedOn: string;
  status: BankFinancialAccount["status"];
  notes: string | null;
};

export type NormalizedFinancialAccountUpdate = Omit<
  NormalizedFinancialAccount,
  "type" | "currency" | "openedOn"
>;

export type NormalizedFinanceLoanApplication = {
  requestedAmountMinor: bigint;
  currency: FinanceLoanApplicationInput["currency"];
  purpose: string;
  termMonths: number;
};

export class FinanceWorkspaceValidationError extends Error {}

function parseMinorAmount(
  value: string,
  label: string,
  allowZero: boolean,
): bigint {
  if (!/^\d{1,19}$/.test(value)) {
    throw new FinanceWorkspaceValidationError(
      `${label} must be a whole minor-unit amount.`,
    );
  }
  const amount = BigInt(value);
  if ((!allowZero && amount === 0n) || amount > MAX_MINOR_AMOUNT) {
    throw new FinanceWorkspaceValidationError(
      `${label} must be within the supported amount range.`,
    );
  }
  return amount;
}

function requireDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new FinanceWorkspaceValidationError(
      `${label} must be a valid calendar date.`,
    );
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new FinanceWorkspaceValidationError(
      `${label} must be a valid calendar date.`,
    );
  }
  return value;
}

function optionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeFinancialAccount(
  input: FinancialAccountInput,
): NormalizedFinancialAccount {
  const name = input.name.trim();
  if (!name) {
    throw new FinanceWorkspaceValidationError("Enter a name for this account.");
  }

  const currentValueMinor = parseMinorAmount(
    input.currentValueMinor,
    "Current value",
    true,
  );
  const targetAmountMinor =
    input.targetAmountMinor == null
      ? null
      : parseMinorAmount(input.targetAmountMinor, "Target amount", false);
  if (input.type === "investment" && targetAmountMinor !== null) {
    throw new FinanceWorkspaceValidationError(
      "Targets are only available for savings trackers.",
    );
  }

  return {
    type: input.type,
    name,
    currency: input.currency,
    currentValueMinor,
    targetAmountMinor,
    openedOn: requireDate(input.openedOn, "Opening date"),
    status: "active",
    notes: optionalText(input.notes),
  };
}

export function mergeFinancialAccountUpdate(
  current: DbFinancialAccount,
  patch: FinancialAccountUpdate,
): NormalizedFinancialAccountUpdate {
  const normalized = normalizeFinancialAccount({
    type: current.type,
    name: patch.name ?? current.name,
    currency: current.currency,
    currentValueMinor:
      patch.currentValueMinor ?? current.currentValueMinor.toString(),
    targetAmountMinor:
      patch.targetAmountMinor === undefined
        ? current.targetAmountMinor?.toString() ?? null
        : patch.targetAmountMinor,
    openedOn: current.openedOn,
    notes: patch.notes === undefined ? current.notes : patch.notes,
  });
  return {
    name: normalized.name,
    currentValueMinor: normalized.currentValueMinor,
    targetAmountMinor: normalized.targetAmountMinor,
    status: patch.status ?? current.status,
    notes: normalized.notes,
  };
}

export function normalizeFinanceLoanApplication(
  input: FinanceLoanApplicationInput,
): NormalizedFinanceLoanApplication {
  const requestedAmountMinor = parseMinorAmount(
    input.requestedAmountMinor,
    "Requested amount",
    false,
  );
  const purpose = input.purpose.trim();
  if (!purpose) {
    throw new FinanceWorkspaceValidationError(
      "Enter the purpose for this application request.",
    );
  }
  if (
    !Number.isInteger(input.termMonths) ||
    input.termMonths < 1 ||
    input.termMonths > 600
  ) {
    throw new FinanceWorkspaceValidationError(
      "Choose a term between 1 and 600 months.",
    );
  }
  return {
    requestedAmountMinor,
    currency: input.currency,
    purpose,
    termMonths: input.termMonths,
  };
}

export function financialAccountResponse(account: DbFinancialAccount) {
  return {
    id: account.id,
    type: account.type,
    name: account.name,
    currency: account.currency,
    currentValueMinor: account.currentValueMinor.toString(),
    targetAmountMinor: account.targetAmountMinor?.toString() ?? null,
    openedOn: account.openedOn,
    status: account.status,
    notes: account.notes,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export function financeLoanApplicationResponse(application: DbLoanApplication) {
  return {
    id: application.id,
    requestedAmountMinor: application.requestedAmountMinor.toString(),
    currency: application.currency,
    purpose: application.purpose,
    termMonths: application.termMonths,
    status: application.status,
    submittedAt: application.submittedAt.toISOString(),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}

export function getLedgerDirection(input: {
  status: string;
  side: string;
  fromUserId: string | null;
  toUserId: string | null;
}): FinanceLedgerDirection | null {
  if (
    (input.status !== "completed" && input.status !== "reversed") ||
    (input.side !== "credit" && input.side !== "debit")
  ) {
    return null;
  }
  if (input.fromUserId && input.fromUserId === input.toUserId) {
    return "transfer";
  }
  return input.side === "credit" ? "inflow" : "outflow";
}

export function financePeriodStart(
  period: "month" | "quarter" | "year",
  now = new Date(),
): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startMonth =
    period === "year"
      ? 0
      : period === "quarter"
        ? Math.floor(month / 3) * 3
        : month;
  return new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10);
}
