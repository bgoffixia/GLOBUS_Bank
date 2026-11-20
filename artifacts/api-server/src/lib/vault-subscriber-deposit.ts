import { and, eq, sql } from "drizzle-orm";
import {
  bankAuditLogsTable,
  bankCurrencyEnum,
  bankLedgerEntriesTable,
  bankSandboxRequestsTable,
  bankTransactionsTable,
  bankUsersTable,
  bankWalletsTable,
  db,
} from "@workspace/db";
import {
  bankOperationRestrictionError,
  createReference,
  formatMinorAmount,
  userWallet,
} from "./bank";
import { hasActiveVaultAccess } from "./bank-vault";
import { storeNotification } from "./transfer-notifications";
import { withCustomerReceiptTemplate } from "./customer-receipt-template";

type BankTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function normalizeVaultTopUpDescription(description?: string): string {
  return (
    description
      ?.replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140) || "Private Vault internal wallet credit"
  );
}

export async function createVaultSubscriberTopUp(
  tx: BankTransaction,
  input: {
    userId: string;
    currency: (typeof bankCurrencyEnum.enumValues)[number];
    amountMinor: bigint;
    idempotencyKey: string;
    description?: string;
  },
) {
  const [user] = await tx
    .select({
      id: bankUsersTable.id,
      vaultSubscriptionStatus: bankUsersTable.vaultSubscriptionStatus,
      vaultSubscriptionExpiresAt: bankUsersTable.vaultSubscriptionExpiresAt,
      preferredReceiptTemplate: bankUsersTable.preferredReceiptTemplate,
    })
    .from(bankUsersTable)
    .where(eq(bankUsersTable.id, input.userId))
    .for("update");
  if (!user || !(await hasActiveVaultAccess(user, tx))) {
    return {
      error: "Active Private Vault access is required to add wallet funds.",
    } as const;
  }
  if (
    input.amountMinor <= 0n ||
    input.amountMinor > 9_223_372_036_854_775_807n
  ) {
    return { error: "Enter a positive amount within the ledger’s supported range." } as const;
  }

  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${input.idempotencyKey})::bigint)`,
  );
  const [existingTransaction] = await tx
    .select()
    .from(bankTransactionsTable)
    .where(eq(bankTransactionsTable.idempotencyKey, input.idempotencyKey))
    .limit(1);
  const [existingRequest] = await tx
    .select()
    .from(bankSandboxRequestsTable)
    .where(eq(bankSandboxRequestsTable.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (existingTransaction || existingRequest) {
    if (
      existingTransaction &&
      existingRequest &&
      existingTransaction.initiatedByUserId === input.userId &&
      existingTransaction.type === "deposit_request" &&
      existingTransaction.currency === input.currency &&
      existingTransaction.amountMinor === input.amountMinor &&
      existingRequest.userId === input.userId &&
      existingRequest.type === "deposit" &&
      existingRequest.currency === input.currency &&
      existingRequest.amountMinor === input.amountMinor
    ) {
      return {
        sandboxRequest: existingRequest,
        transaction: existingTransaction,
        notification: null,
      } as const;
    }
    return { error: "That request reference is already in use." } as const;
  }

  const wallet = await userWallet(tx, input.userId, input.currency);
  if (!wallet) return { error: "A wallet for this currency is unavailable." } as const;
  const restrictionError = await bankOperationRestrictionError(tx, {
    userId: input.userId,
    walletId: wallet.id,
    operation: "deposit",
  });
  if (restrictionError) return { error: restrictionError } as const;

  const [lockedWallet] = await tx
    .select()
    .from(bankWalletsTable)
    .where(
      and(
        eq(bankWalletsTable.id, wallet.id),
        eq(bankWalletsTable.userId, input.userId),
      ),
    )
    .for("update");
  if (!lockedWallet) return { error: "The selected wallet is unavailable." } as const;
  if (!lockedWallet.depositsEnabled) {
    return {
      error: "Adding funds is disabled for this wallet in your Private Vault settings.",
    } as const;
  }

  const commitRestrictionError = await bankOperationRestrictionError(tx, {
    userId: input.userId,
    walletId: lockedWallet.id,
    operation: "deposit",
  });
  if (commitRestrictionError) return { error: commitRestrictionError } as const;

  const reference = createReference();
  const [transaction] = await tx
    .insert(bankTransactionsTable)
    .values(withCustomerReceiptTemplate({
      reference,
      idempotencyKey: input.idempotencyKey,
      initiatedByUserId: input.userId,
      fromUserId: input.userId,
      toWalletId: lockedWallet.id,
      type: "deposit_request",
      status: "completed",
      currency: input.currency,
      amountMinor: input.amountMinor,
      counterparty: null,
      description: normalizeVaultTopUpDescription(input.description),
      mode: "internal_ledger",
    }, user.preferredReceiptTemplate))
    .returning();
  await tx.insert(bankLedgerEntriesTable).values([
    {
      transactionId: transaction.id,
      accountCode: `internal:deposit:${input.currency}`,
      currency: input.currency,
      side: "debit",
      amountMinor: input.amountMinor,
    },
    {
      transactionId: transaction.id,
      walletId: lockedWallet.id,
      accountCode: `wallet:${lockedWallet.id}`,
      currency: input.currency,
      side: "credit",
      amountMinor: input.amountMinor,
    },
  ]);
  const [request] = await tx
    .insert(bankSandboxRequestsTable)
    .values({
      userId: input.userId,
      transactionId: transaction.id,
      reference,
      idempotencyKey: input.idempotencyKey,
      type: "deposit",
      currency: input.currency,
      destinationCurrency: null,
      savedPaymentMethodId: null,
      paymentMethod: null,
      paymentMethodSummary: null,
      amountMinor: input.amountMinor,
      status: "approved",
    })
    .returning();
  const notification = await storeNotification(tx, {
    userId: input.userId,
    category: "wallet",
    title: "Internal ledger credit posted",
    body: `An internal Globus ledger credit of ${formatMinorAmount(input.amountMinor)} ${input.currency} was posted to your wallet. No outside funds moved.`,
    reference,
  });
  await tx.insert(bankAuditLogsTable).values({
    actorUserId: input.userId,
    targetUserId: input.userId,
    action: "customer_wallet_top_up",
    reason: `Internal Globus ledger credit of ${formatMinorAmount(input.amountMinor)} ${input.currency} posted to wallet ${lockedWallet.id} for a customer with active Private Vault access. Reference ${reference}.`,
  });

  return { sandboxRequest: request, transaction, notification } as const;
}
