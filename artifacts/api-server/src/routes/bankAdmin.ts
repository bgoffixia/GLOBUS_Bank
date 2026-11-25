import { Router, type IRouter, type Request, type RequestHandler } from "express";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { clerkClient, getAuth } from "@clerk/express";
import { rateLimit } from "express-rate-limit";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  gt,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import {
  CreateAdminFundingBody,
  CreateAdminFundingParams,
  CreateAdminFundingResponse,
  GetAdminWalletCurrencyMigrationPreviewResponse,
  ConvertAdminWalletCurrenciesToUsdBody,
  ConvertAdminWalletCurrenciesToUsdResponse,
  CreateAdminRestrictionBody,
  CreateAdminRestrictionResponse,
  CreateAdminTransactionCorrectionBody,
  CreateAdminTransactionCorrectionParams,
  CreateAdminTransactionCorrectionResponse,
  GetAdminAccessResponse,
  GetAdminSettingsResponse,
  GetAdminSummaryResponse,
  GetAdminTransactionDetailParams,
  GetAdminTransactionDetailResponse,
  GetAdminUserDetailParams,
  GetAdminUserDetailResponse,
  ListAdminRestrictionsQueryParams,
  ListAdminRestrictionsResponse,
  ListAdminAccountsQueryParams,
  ListAdminAccountsResponse,
  ListAdminAuditLogsQueryParams,
  ListAdminAuditLogsResponse,
  ListAdminTransactionsQueryParams,
  ListAdminTransactionsResponse,
  ListAdminLedgerRequestsResponse,
  ListAdminLedgerQueryParams,
  ListAdminLedgerResponse,
  ListAdminTransactionStatusHistoryParams,
  ListAdminTransactionStatusHistoryResponse,
  ListAdminUsersQueryParams,
  ListAdminUsersResponse,
  ListAdminVaultAccessQueryParams,
  ListAdminVaultAccessResponse,
  ListAdminLedgerRequestsQueryParams,
  UpdateAdminUserStatusBody,
  UpdateAdminUserStatusParams,
  UpdateAdminUserStatusResponse,
  UpdateAdminUserProfileBody,
  UpdateAdminUserProfileParams,
  UpdateAdminUserProfileResponse,
  UpdateAdminUserAccessControlsBody,
  UpdateAdminUserAccessControlsParams,
  UpdateAdminUserAccessControlsResponse,
  UpdateAdminUserVaultSubscriptionBody,
  UpdateAdminUserVaultSubscriptionParams,
  UpdateAdminUserVaultSubscriptionResponse,
  GrantAdminVaultAccessBody,
  GrantAdminVaultAccessParams,
  GrantAdminVaultAccessResponse,
  RevokeAdminVaultAccessBody,
  RevokeAdminVaultAccessParams,
  RevokeAdminVaultAccessResponse,
  UpdateAdminSettingsBody,
  UpdateAdminSettingsResponse,
  UpdateAdminWalletStatusBody,
  UpdateAdminWalletStatusParams,
  UpdateAdminWalletStatusResponse,
  ReviewAdminFundingBody,
  ReviewAdminFundingParams,
  ReviewAdminFundingResponse,
  UpdateAdminTransactionStatusBody,
  UpdateAdminTransactionStatusParams,
  UpdateAdminTransactionStatusResponse,
  UpdateAdminTransactionDateBody,
  UpdateAdminTransactionDateParams,
  UpdateAdminTransactionDateResponse,
  ProcessAdminInternalTransferBody,
  ProcessAdminInternalTransferParams,
  ProcessAdminInternalTransferResponse,
  ResetAdminUserPasswordBody,
  ResetAdminUserPasswordParams,
  ResetAdminUserPasswordResponse,
  RemoveAdminRestrictionBody,
  RemoveAdminRestrictionParams,
  RemoveAdminRestrictionResponse,
  UpsertBankExchangeRateBody,
  UpsertBankExchangeRateResponse,
  ReviewAdminLedgerRequestBody,
  ReviewAdminLedgerRequestParams,
  ReviewAdminLedgerRequestResponse,
  ResetAdminUserTransactionPinBody,
  ResetAdminUserTransactionPinParams,
  ResetAdminUserTransactionPinResponse,
  AssignAdminUserAccountTierBody,
  AssignAdminUserAccountTierParams,
  AssignAdminUserAccountTierResponse,
  ListAdminSupportConversationsQueryParams,
  ListAdminSupportConversationsResponse,
  ListAdminSupportMessagesParams,
  ListAdminSupportMessagesResponse,
  ReplyAdminSupportMessageParams,
  ReplyAdminSupportMessageBody,
  ReplyAdminSupportMessageResponse,
  MarkAdminSupportConversationReadParams,
  MarkAdminSupportConversationReadResponse,
} from "@workspace/api-zod";
import {
  bankAuditLogsTable,
  bankAdminSettingsTable,
  bankExchangeRatesTable,
  bankInternationalTransferRequestsTable,
  bankLedgerEntriesTable,
  bankRestrictionsTable,
  bankSandboxRequestsTable,
  bankTransactionsTable,
  bankUsersTable,
  bankVaultAdminEntitlementsTable,
  bankVaultSessionsTable,
  bankVaultPasscodeResetTokensTable,
  bankSupportConversationsTable,
  bankSupportMessagesTable,
  bankWalletsTable,
  db,
} from "@workspace/db";
import {
  isPasswordResetRequired,
  setPasswordResetCache,
} from "../lib/password-reset";
import {
  CUSTOMER_EMAIL_SENDER_DOMAIN,
  CUSTOMER_EMAIL_SENDER_DISPLAY_NAME,
  normalizeCustomerEmailSenderDisplayName,
} from "../lib/customer-email-sender";
import { sendPasswordResetEmail } from "../lib/password-reset-email";
import {
  balanceForWallet,
  bankOperationRestrictionError,
  convertMinorAmount,
  conversionRatesMatch,
  createReference,
  ensureBankUser,
  formatMinorAmount,
  getWalletsForUser,
  listUserTransactions,
  parseAmountToMinor,
  reservedForWallet,
  toBankTransaction,
  userWallet,
} from "../lib/bank";
import { getExchangeRate } from "../lib/exchange-rates";
import { verifyTransactionPin } from "../lib/transaction-pin";
import { isIsoCalendarDate } from "../lib/transaction-date";
import {
  getEffectiveAccountTier,
  hasActiveVaultAccess,
  vaultSubscriptionStatus,
} from "../lib/bank-vault";
import {
  notifyTransferRecipient,
  sendPushToUser,
  storeNotification,
} from "../lib/transfer-notifications";
import {
  minorAmountToDecimal,
} from "../lib/vault-subscription";
import { withCustomerReceiptTemplate } from "../lib/customer-receipt-template";
import { getVaultPasscodeResetSenderAddress } from "../lib/vault-passcode-reset-email";
import { sendVaultPasscodeResetEmail } from "../lib/vault-passcode-reset-smtp";

const router: IRouter = Router();
const supportMessageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many support replies. Try again in a few minutes." },
});
const testTransactionAlertLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 1,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "A test transaction alert was already requested recently." },
});

const adminAuditOperationLabels: Array<[string, string]> = [
  ["/bank/admin/exchange-rates", "exchange rate update"],
  ["/bank/admin/wallet-currency-migration", "legacy wallet currency conversion"],
  ["/bank/admin/wallets/:walletId", "wallet status change"],
  ["/bank/admin/restrictions/:restrictionId/remove", "restriction removal"],
  ["/bank/admin/restrictions", "restriction creation"],
  ["/bank/admin/settings", "operations settings update"],
  ["/bank/admin/ledger-requests/:requestId", "customer request review"],
  ["/bank/admin/users/:userId/vault-access/grant", "Private Vault admin grant"],
  ["/bank/admin/users/:userId/vault-access/revoke", "Private Vault admin grant revocation"],
  ["/bank/admin/users/:userId/transaction-pin/reset", "customer transaction PIN reset"],
  ["/bank/admin/users/:userId/vault-passcode-reset", "Private Vault passcode reset-link request"],
  ["/bank/admin/users/:userId/password-reset", "customer password reset"],
  ["/bank/admin/users/:userId/status", "customer account status change"],
  ["/bank/admin/users/:userId/profile", "customer profile update"],
  ["/bank/admin/users/:userId/access-controls", "customer access controls update"],
  ["/bank/admin/users/:userId/account-tier", "customer account tier assignment"],
  ["/bank/admin/users/:userId/vault-subscription", "Private Vault subscription access removal"],
  ["/bank/admin/users/:userId/funding", "customer wallet adjustment"],
  ["/bank/admin/transactions/:transactionId/process", "internal transfer processing"],
  ["/bank/admin/transactions/:transactionId/funding-review", "funding adjustment review"],
  ["/bank/admin/transactions/:transactionId/status", "transaction status correction"],
  ["/bank/admin/transactions/:transactionId", "transaction correction"],
];

const adminAuditDetailFields = [
  "accountStatus",
  "status",
  "decision",
  "type",
  "vaultPlanCode",
  "testingModeDisabled",
  "transferAccessGranted",
  "adminAccountTier",
  "direction",
  "currency",
  "amount",
  "sourceCurrency",
  "destinationCurrency",
  "rate",
  "kind",
  "effectiveAt",
  "expiresAt",
  "name",
] as const;

function generatedAdminAuditReason(req: Request): string {
  const route = String(req.route?.path ?? `${req.baseUrl}${req.path}`);
  const operation = adminAuditOperationLabels.find(([path]) => route === path)?.[1]
    ?? `${req.method.toLowerCase()} ${route}`;
  const body = typeof req.body === "object" && req.body !== null
    ? req.body as Record<string, unknown>
    : {};
  const details = adminAuditDetailFields.flatMap((field) => {
    const value = body[field];
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      return [];
    }
    const safeValue = String(value).replace(/[\r\n\t]/g, " ").slice(0, 80);
    return safeValue ? [`${field}=${safeValue}`] : [];
  });
  return `Automatically generated audit reason for ${operation}${details.length ? ` (${details.join(", ")})` : ""}.`
    .slice(0, 500);
}

function configuredAdminIds(): Set<string> {
  return new Set(
    (process.env.GLOBUS_ADMIN_CLERK_IDS ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );
}

function configuredAdminEmails(): Set<string> {
  return new Set(
    (process.env.GLOBUS_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function isAllowlistedAdmin(userId: string): Promise<boolean> {
  if (configuredAdminIds().has(userId)) return true;

  const allowedEmails = configuredAdminEmails();
  if (allowedEmails.size === 0) return false;

  const identity = await clerkClient.users.getUser(userId);
  const primaryEmail = identity.emailAddresses.find(
    (email) => email.id === identity.primaryEmailAddressId,
  );

  return Boolean(
    primaryEmail?.verification?.status === "verified" &&
      allowedEmails.has(primaryEmail.emailAddress.trim().toLowerCase()),
  );
}

function adminVaultAccessRecord(
  user: typeof bankUsersTable.$inferSelect,
  grant: typeof bankVaultAdminEntitlementsTable.$inferSelect | null,
  now = new Date(),
) {
  const subscriptionStatus = vaultSubscriptionStatus(
    user.vaultSubscriptionStatus,
    user.vaultSubscriptionExpiresAt,
  );
  const subscriptionActive = subscriptionStatus === "active";
  const adminGrantActive = Boolean(
    grant && (!grant.expiresAt || grant.expiresAt > now),
  );
  const accessSource = adminGrantActive
    ? "admin_grant"
    : subscriptionActive
      ? "paystack_subscription"
      : "none";
  return {
    userId: user.id,
    email: user.email,
    customerId: user.customerId,
    firstName: user.firstName,
    lastName: user.lastName,
    subscriptionStatus,
    subscriptionActive,
    subscriptionExpiresAt: user.vaultSubscriptionExpiresAt?.toISOString() ?? null,
    adminGrantActive,
    adminGrantAt: grant?.grantedAt.toISOString() ?? null,
    adminGrantExpiresAt: grant?.expiresAt?.toISOString() ?? null,
    adminGrantByUserId: grant?.grantedByUserId ?? null,
    adminGrantReason: grant?.reason ?? null,
    accessActive: adminGrantActive || subscriptionActive,
    accessSource,
  };
}

type AdminVaultGrantDuration = "7d" | "30d" | "90d" | "permanent";
const adminVaultGrantDurationDays: Record<AdminVaultGrantDuration, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  permanent: null,
};

function adminVaultGrantExpiry(
  duration: AdminVaultGrantDuration,
  now = new Date(),
): Date | null {
  const days = adminVaultGrantDurationDays[duration];
  return days === null ? null : new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

async function applyAdminVaultEntitlementAction(
  actorUserId: string,
  targetUserId: string,
  reason: string,
  action: "grant" | "revoke",
  grantExpiresAt: Date | null = null,
) {
  if (actorUserId === targetUserId && action === "revoke") {
    return { selfRevoke: true as const };
  }
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, targetUserId))
      .for("update");
    if (!target) return { notFound: true as const };

    if (action === "grant") {
      const [existing] = await tx
        .select()
        .from(bankVaultAdminEntitlementsTable)
        .where(eq(bankVaultAdminEntitlementsTable.userId, target.id))
        .for("update");
      const now = new Date();
      if (existing && (!existing.expiresAt || existing.expiresAt > now)) {
        return { alreadyGranted: true as const };
      }
      const grantValues = {
        userId: target.id,
        grantedByUserId: actorUserId,
        reason,
        grantedAt: now,
        expiresAt: grantExpiresAt,
      };
      if (existing) {
        await tx
          .update(bankVaultAdminEntitlementsTable)
          .set(grantValues)
          .where(eq(bankVaultAdminEntitlementsTable.userId, target.id));
      } else {
        await tx
          .insert(bankVaultAdminEntitlementsTable)
          .values(grantValues);
      }
    } else {
      const [grant] = await tx
        .delete(bankVaultAdminEntitlementsTable)
        .where(eq(bankVaultAdminEntitlementsTable.userId, target.id))
        .returning({ userId: bankVaultAdminEntitlementsTable.userId });
      if (!grant) return { notGranted: true as const };
      await tx
        .delete(bankVaultSessionsTable)
        .where(eq(bankVaultSessionsTable.userId, target.id));
    }

    await tx.insert(bankAuditLogsTable).values({
      actorUserId,
      targetUserId: target.id,
      action:
        action === "grant"
          ? "grant_admin_private_vault_access"
          : "revoke_admin_private_vault_access",
      reason,
    });
    return { target };
  });
}

function restrictionStatus(
  restriction: typeof bankRestrictionsTable.$inferSelect,
  now = new Date(),
): "active" | "scheduled" | "expired" | "removed" {
  if (restriction.status === "removed") return "removed";
  if (restriction.effectiveAt > now) return "scheduled";
  if (restriction.expiresAt && restriction.expiresAt <= now) return "expired";
  return "active";
}

function adminRestrictionResponse(input: {
  restriction: typeof bankRestrictionsTable.$inferSelect;
  customer: typeof bankUsersTable.$inferSelect;
  wallet?: typeof bankWalletsTable.$inferSelect;
  createdBy?: typeof bankUsersTable.$inferSelect;
  removedBy?: typeof bankUsersTable.$inferSelect;
}) {
  const { restriction, customer, wallet, createdBy, removedBy } = input;
  return {
    id: restriction.id,
    userId: restriction.userId,
    customerId: customer.customerId,
    userName:
      [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
      "Globus member",
    email: customer.email,
    walletId: restriction.walletId,
    walletCurrency: wallet?.currency ?? null,
    type: restriction.type,
    status: restrictionStatus(restriction),
    reason: restriction.reason,
    effectiveAt: restriction.effectiveAt.toISOString(),
    expiresAt: restriction.expiresAt?.toISOString() ?? null,
    internalNotes: restriction.internalNotes,
    createdByName:
      [createdBy?.firstName, createdBy?.lastName].filter(Boolean).join(" ") ||
      createdBy?.email ||
      "Unknown administrator",
    createdByEmail: createdBy?.email ?? "unknown@invalid.local",
    createdAt: restriction.createdAt.toISOString(),
    removedAt: restriction.removedAt?.toISOString() ?? null,
    removedByName: removedBy
      ? [removedBy.firstName, removedBy.lastName].filter(Boolean).join(" ") ||
        removedBy.email
      : null,
    removalReason: restriction.removalReason,
  };
}

function ledgerPostingsBalanced(
  entries: Array<{
    currency: string;
    side: string;
    amountMinor: bigint;
  }>,
): boolean {
  if (entries.length < 2) return false;
  const totals = new Map<string, { debit: bigint; credit: bigint }>();
  for (const entry of entries) {
    if (
      entry.amountMinor <= 0n ||
      (entry.side !== "debit" && entry.side !== "credit")
    ) {
      return false;
    }
    const total = totals.get(entry.currency) ?? { debit: 0n, credit: 0n };
    total[entry.side] += entry.amountMinor;
    totals.set(entry.currency, total);
  }
  return (
    totals.size > 0 &&
    [...totals.values()].every(
      ({ debit, credit }) => debit > 0n && debit === credit,
    )
  );
}

const requireSignedIn: RequestHandler = (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  next();
};

const requireAdmin: RequestHandler = async (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  try {
    if (await isPasswordResetRequired(userId)) {
      res.status(423).json({
        error: "Update your password before accessing administrator tools.",
      });
      return;
    }
  } catch {
    res.status(503).json({
      error: "Account security could not be verified right now.",
    });
    return;
  }
  let allowed: boolean;
  try {
    allowed = await isAllowlistedAdmin(userId);
  } catch {
    res.status(503).json({
      error: "Administrator access could not be verified right now.",
    });
    return;
  }
  if (!allowed) {
    res.status(403).json({ error: "Administrator access is not enabled for this account." });
    return;
  }
  next();
};

async function getOrCreateAdminSettings() {
  await db
    .insert(bankAdminSettingsTable)
    .values({
      id: "operations",
      customerEmailSenderDomain: CUSTOMER_EMAIL_SENDER_DOMAIN,
      customerEmailSenderDisplayName: CUSTOMER_EMAIL_SENDER_DISPLAY_NAME,
    })
    .onConflictDoNothing();
  const [settings] = await db
    .select()
    .from(bankAdminSettingsTable)
    .where(eq(bankAdminSettingsTable.id, "operations"))
    .limit(1);
  if (!settings) throw new Error("Administrative settings are unavailable.");
  return settings;
}

function adminSettingsPayload(settings: Awaited<ReturnType<typeof getOrCreateAdminSettings>>) {
  return {
    customerEmailSenderDomain: settings.customerEmailSenderDomain,
    customerEmailSenderDisplayName: settings.customerEmailSenderDisplayName,
    fundingLimit: settings.fundingLimit,
    secondApprovalThreshold: settings.secondApprovalThreshold,
    frozenIncomingPolicy: "allow_frozen" as const,
    vaultPlan1mPrice: minorAmountToDecimal(settings.vaultPlan1mPriceMinor),
    vaultPlan3mPrice: minorAmountToDecimal(settings.vaultPlan3mPriceMinor),
    vaultPlan1yPrice: minorAmountToDecimal(settings.vaultPlan1yPriceMinor),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

function respondWithTransactionPinError(
  res: import("express").Response,
  result: Exclude<
    Awaited<ReturnType<typeof verifyTransactionPin>>,
    "valid"
  >,
): void {
  if (result === "not_configured") {
    res.status(409).json({
      error: "Set a 6-digit transaction PIN in Settings before approving transactions.",
    });
  } else if (result === "locked") {
    res.status(429).json({
      error: "Too many incorrect PIN attempts. Try again in 15 minutes.",
    });
  } else if (result === "invalid") {
    res.status(403).json({ error: "The transaction PIN is incorrect." });
  } else {
    res.status(404).json({ error: "The account for this transaction was not found." });
  }
}

router.get("/bank/admin/access", requireSignedIn, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const userId = getAuth(req).userId;
  let allowed = false;
  if (userId) {
    try {
      allowed = await isAllowlistedAdmin(userId);
    } catch {
      res.status(503).json({
        error: "Administrator access could not be verified right now.",
      });
      return;
    }
  }
  res.json(
    GetAdminAccessResponse.parse({
      allowed,
      roles: allowed ? ["super_administrator"] : [],
    }),
  );
});

router.post(
  "/bank/admin/test-transaction-alert-email",
  requireAdmin,
  testTransactionAlertLimiter,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access administrator tools." });
      return;
    }
    const actor = await ensureBankUser(clerkUserId);
    const recipientAddress = "offixiatoolz@gmail.com";
    const reference = `TEST-GB-${randomUUID().slice(0, 8).toUpperCase()}`;
    const subject = "[TEST ONLY] GLOBUS BANK Transaction Alert";
    const message = [
      "GLOBUS BANK — TEST TRANSACTION ALERT",
      "",
      "THIS IS A SIMULATED EMAIL FOR SYSTEM TESTING ONLY.",
      "No real transaction was initiated, processed, or posted.",
      "No funds have been transferred or deducted.",
      "",
      "Transaction type: Debit (simulated)",
      "Amount: NGN 5,000.00 (fictional test amount)",
      "Status: TEST ONLY — NOT A REAL TRANSACTION",
      `Reference: ${reference}`,
      "",
      "This message does not represent an actual account activity.",
      "Thank you,",
      "GLOBUS BANK",
    ].join("\n");
    try {
      const apiKey = process.env.RESEND_API_KEY?.trim();
      if (!apiKey) {
        res.status(503).json({ error: "The email delivery service is not configured." });
        return;
      }
      await sendVaultPasscodeResetEmail({
        apiKey,
        senderAddress: getVaultPasscodeResetSenderAddress(),
        recipientAddress,
        subject,
        text: message,
      });
      await db.insert(bankAuditLogsTable).values({
        actorUserId: actor.id,
        targetUserId: actor.id,
        action: "send_admin_test_transaction_alert_email",
        reason: `Sent a clearly labeled simulated transaction-alert email to ${recipientAddress}; reference ${reference}. No financial transaction was created.`,
      });
      res.json({
        sent: true,
        recipient: recipientAddress,
        reference,
        message: "Test transaction alert email accepted by the SMTP server. No real transaction occurred.",
      });
    } catch (error) {
      req.log.error({ error }, "Admin test transaction alert email failed");
      res.status(502).json({ error: "The test email could not be sent. Check the mail service logs." });
    }
  },
);

router.put("/bank/admin/exchange-rates", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpsertBankExchangeRateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.sourceCurrency === parsed.data.destinationCurrency) {
    res.status(400).json({ error: "Choose two different currencies." });
    return;
  }
  if (!Number.isFinite(Number(parsed.data.rate)) || Number(parsed.data.rate) <= 0) {
    res.status(400).json({ error: "The rate must be greater than zero." });
    return;
  }
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const actor = await ensureBankUser(clerkUserId);
  const pinResult = await verifyTransactionPin(actor.id, parsed.data.transactionPin);
  if (pinResult !== "valid") {
    respondWithTransactionPinError(res, pinResult);
    return;
  }
  const reason = generatedAdminAuditReason(req);
  const rate = await db.transaction(async (tx) => {
    const now = new Date();
    const [savedRate] = await tx
      .insert(bankExchangeRatesTable)
      .values({
        sourceCurrency: parsed.data.sourceCurrency,
        destinationCurrency: parsed.data.destinationCurrency,
        rate: parsed.data.rate,
        updatedByUserId: actor.id,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          bankExchangeRatesTable.sourceCurrency,
          bankExchangeRatesTable.destinationCurrency,
        ],
        set: {
          rate: parsed.data.rate,
          updatedByUserId: actor.id,
          updatedAt: now,
        },
      })
      .returning();
    await tx.insert(bankAuditLogsTable).values({
      actorUserId: actor.id,
      targetUserId: actor.id,
      action: "update_exchange_rate",
      reason: `${parsed.data.sourceCurrency} to ${parsed.data.destinationCurrency} rate set to ${parsed.data.rate}. ${reason}`,
    });
    return savedRate;
  });
  res.json(
    UpsertBankExchangeRateResponse.parse({
      sourceCurrency: rate.sourceCurrency,
      destinationCurrency: rate.destinationCurrency,
      rate: rate.rate,
      updatedAt: rate.updatedAt.toISOString(),
    }),
  );
});

router.get("/bank/admin/summary", requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();
  const hasActiveRestriction = sql`exists (
    select 1 from bank_restrictions br
    where br.user_id = ${bankUsersTable.id}
      and br.status = 'active'
      and br.effective_at <= ${now}
      and (br.expires_at is null or br.expires_at > ${now})
  )`;
  const hasActiveSuspension = sql`exists (
    select 1 from bank_restrictions br
    where br.user_id = ${bankUsersTable.id}
      and br.restriction_type = 'suspend_user'
      and br.status = 'active'
      and br.effective_at <= ${now}
      and (br.expires_at is null or br.expires_at > ${now})
  )`;
  const [
    userCount,
    activeAccountCount,
    restrictedAccountCount,
    suspendedAccountCount,
    pendingCount,
    transactionCount,
    ledgerTotals,
    recentActions,
  ] = await Promise.all([
    db.select({ value: count() }).from(bankUsersTable),
    db
      .select({ value: count() })
      .from(bankUsersTable)
      .where(and(eq(bankUsersTable.accountStatus, "active"), sql`not (${hasActiveRestriction})`)),
    db
      .select({ value: count() })
      .from(bankUsersTable)
      .where(
        and(
          or(eq(bankUsersTable.accountStatus, "restricted"), hasActiveRestriction),
          sql`not (${hasActiveSuspension})`,
        ),
      ),
    db
      .select({ value: count() })
      .from(bankUsersTable)
      .where(or(eq(bankUsersTable.accountStatus, "suspended"), hasActiveSuspension)),
    db
      .select({ value: count() })
      .from(bankTransactionsTable)
      .where(
        and(
          eq(bankTransactionsTable.status, "pending"),
          ne(bankTransactionsTable.type, "deposit_request"),
        ),
      ),
    db.select({ value: count() }).from(bankTransactionsTable),
    db
      .select({
        currency: bankLedgerEntriesTable.currency,
        side: bankLedgerEntriesTable.side,
        amount: sql<string>`coalesce(sum(${bankLedgerEntriesTable.amountMinor}), 0)::text`,
      })
      .from(bankLedgerEntriesTable)
      .groupBy(bankLedgerEntriesTable.currency, bankLedgerEntriesTable.side),
    db
      .select()
      .from(bankAuditLogsTable)
      .orderBy(desc(bankAuditLogsTable.createdAt))
      .limit(8),
  ]);
  const recentUserIds = [
    ...new Set(recentActions.flatMap((row) => [row.actorUserId, row.targetUserId])),
  ];
  const recentUsers = recentUserIds.length
    ? await db
        .select({
          id: bankUsersTable.id,
          email: bankUsersTable.email,
          firstName: bankUsersTable.firstName,
          lastName: bankUsersTable.lastName,
        })
        .from(bankUsersTable)
        .where(inArray(bankUsersTable.id, recentUserIds))
    : [];
  const userById = new Map(recentUsers.map((user) => [user.id, user]));
  const currencies = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD"] as const;
  const amountFor = (currency: (typeof currencies)[number], side: string) =>
    ledgerTotals.find((row) => row.currency === currency && row.side === side)
      ?.amount ?? "0";
  const currencyTotals = (side: "credit" | "debit") =>
    currencies.map((currency) => ({
      currency,
      amount: formatMinorAmount(BigInt(amountFor(currency, side))),
    }));
  res.json(
    GetAdminSummaryResponse.parse({
      registeredUsers: userCount[0]?.value ?? 0,
      activeAccounts: activeAccountCount[0]?.value ?? 0,
      restrictedAccounts: restrictedAccountCount[0]?.value ?? 0,
      suspendedAccounts: suspendedAccountCount[0]?.value ?? 0,
      pendingOperations: pendingCount[0]?.value ?? 0,
      ledgerTransactions: transactionCount[0]?.value ?? 0,
      creditsByCurrency: currencyTotals("credit"),
      debitsByCurrency: currencyTotals("debit"),
      recentActions: recentActions.map((row) => {
        const actor = userById.get(row.actorUserId);
        const target = userById.get(row.targetUserId);
        return {
          id: row.id,
          actorName:
            [actor?.firstName, actor?.lastName].filter(Boolean).join(" ") ||
            actor?.email ||
            "Unknown administrator",
          actorEmail: actor?.email ?? "unknown@invalid.local",
          targetName:
            [target?.firstName, target?.lastName].filter(Boolean).join(" ") ||
            target?.email ||
            "Unknown member",
          targetEmail: target?.email ?? "unknown@invalid.local",
          action: row.action,
          reason: row.reason,
          createdAt: row.createdAt.toISOString(),
        };
      }),
    }),
  );
});

router.get("/bank/admin/accounts", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListAdminAccountsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.pageSize ?? 25;
  const filters = [];
  filters.push(sql`(
    ${bankWalletsTable.currency} in ('USD', 'EUR', 'GBP', 'CAD')
    OR coalesce((
      select sum(case when ${bankLedgerEntriesTable.side} = 'credit'
        then ${bankLedgerEntriesTable.amountMinor}
        else -${bankLedgerEntriesTable.amountMinor} end)
      from ${bankLedgerEntriesTable}
      where ${bankLedgerEntriesTable.walletId} = ${bankWalletsTable.id}
    ), 0) <> 0
    OR exists (
      select 1
      from ${bankSandboxRequestsTable} legacy_request
      inner join ${bankTransactionsTable} legacy_tx
        on legacy_request.transaction_id = legacy_tx.id
      where legacy_request.status in ('pending_review', 'pending_provider_setup')
        and (legacy_tx.from_wallet_id = ${bankWalletsTable.id}
          or legacy_tx.to_wallet_id = ${bankWalletsTable.id})
    )
  )`);
  const search = parsed.data.search?.trim();
  if (search) {
    const needle = `%${search}%`;
    filters.push(
      or(
        sql`${bankWalletsTable.id}::text ilike ${needle}`,
        ilike(bankUsersTable.customerId, needle),
        ilike(bankUsersTable.email, needle),
        ilike(bankUsersTable.firstName, needle),
        ilike(bankUsersTable.lastName, needle),
      ),
    );
  }
  if (parsed.data.currency) {
    filters.push(eq(bankWalletsTable.currency, parsed.data.currency));
  }
  const now = new Date();
  const hasEffectiveFreeze = sql`exists (
    select 1 from bank_restrictions br
    where br.wallet_id = ${bankWalletsTable.id}
      and br.user_id = ${bankUsersTable.id}
      and br.restriction_type = 'freeze_wallet'
      and br.status = 'active'
      and br.effective_at <= ${now}
      and (br.expires_at is null or br.expires_at > ${now})
  )`;
  if (parsed.data.status) {
    filters.push(
      parsed.data.status === "restricted"
        ? or(eq(bankWalletsTable.status, "restricted"), hasEffectiveFreeze)
        : and(
            eq(bankWalletsTable.status, "active"),
            sql`not (${hasEffectiveFreeze})`,
          ),
    );
  }
  const where = filters.length ? and(...filters) : undefined;
  const [totalRows] = await db
    .select({ value: count() })
    .from(bankWalletsTable)
    .innerJoin(bankUsersTable, eq(bankWalletsTable.userId, bankUsersTable.id))
    .where(where);
  const rows = await db
    .select({
      id: bankWalletsTable.id,
      userId: bankUsersTable.id,
      customerId: bankUsersTable.customerId,
      email: bankUsersTable.email,
      firstName: bankUsersTable.firstName,
      lastName: bankUsersTable.lastName,
      currency: bankWalletsTable.currency,
      status: bankWalletsTable.status,
      restrictionReason: bankWalletsTable.restrictionReason,
      restrictionNotes: bankWalletsTable.restrictionNotes,
      restrictedAt: bankWalletsTable.restrictedAt,
      createdAt: bankWalletsTable.createdAt,
      balance: sql<string>`coalesce(sum(case when ${bankLedgerEntriesTable.side} = 'credit' then ${bankLedgerEntriesTable.amountMinor} else -${bankLedgerEntriesTable.amountMinor} end), 0)::text`,
    })
    .from(bankWalletsTable)
    .innerJoin(bankUsersTable, eq(bankWalletsTable.userId, bankUsersTable.id))
    .leftJoin(
      bankLedgerEntriesTable,
      eq(bankLedgerEntriesTable.walletId, bankWalletsTable.id),
    )
    .where(where)
    .groupBy(
      bankWalletsTable.id,
      bankUsersTable.id,
      bankUsersTable.customerId,
      bankUsersTable.email,
      bankUsersTable.firstName,
      bankUsersTable.lastName,
      bankWalletsTable.currency,
      bankWalletsTable.status,
      bankWalletsTable.restrictionReason,
      bankWalletsTable.restrictionNotes,
      bankWalletsTable.restrictedAt,
      bankWalletsTable.createdAt,
    )
    .orderBy(desc(bankWalletsTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const rowWalletIds = rows.map((row) => row.id);
  const activeFreezeRows = rowWalletIds.length
    ? await db
        .select()
        .from(bankRestrictionsTable)
        .where(
          and(
            inArray(bankRestrictionsTable.walletId, rowWalletIds),
            eq(bankRestrictionsTable.type, "freeze_wallet"),
            eq(bankRestrictionsTable.status, "active"),
            lte(bankRestrictionsTable.effectiveAt, now),
            or(
              isNull(bankRestrictionsTable.expiresAt),
              gt(bankRestrictionsTable.expiresAt, now),
            ),
          ),
        )
    : [];
  const activeFreezeByWallet = new Map(
    activeFreezeRows
      .filter((restriction) => restriction.walletId)
      .map((restriction) => [restriction.walletId!, restriction]),
  );
  res.json(
    ListAdminAccountsResponse.parse({
      items: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        customerId: row.customerId,
        memberName:
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          "Globus member",
        email: row.email,
        currency: row.currency,
        balance: formatMinorAmount(BigInt(row.balance)),
        status:
          row.status === "restricted" || activeFreezeByWallet.has(row.id)
            ? "restricted"
            : "active",
        restrictionReason:
          row.restrictionReason ??
          activeFreezeByWallet.get(row.id)?.reason ??
          null,
        restrictionNotes:
          row.restrictionNotes ??
          activeFreezeByWallet.get(row.id)?.internalNotes ??
          null,
        restrictedAt:
          row.restrictedAt?.toISOString() ??
          activeFreezeByWallet.get(row.id)?.effectiveAt.toISOString() ??
          null,
        createdAt: row.createdAt.toISOString(),
      })),
      total: Number(totalRows?.value ?? 0),
      page,
      pageSize,
    }),
  );
});

async function legacyWalletCurrencyMigrationPreview() {
  const supportedCurrencies = ["USD", "EUR", "GBP", "CAD"] as const;
  const rows = await db
    .select({
      walletId: bankWalletsTable.id,
      userId: bankUsersTable.id,
      customerId: bankUsersTable.customerId,
      firstName: bankUsersTable.firstName,
      lastName: bankUsersTable.lastName,
      email: bankUsersTable.email,
      accountStatus: bankUsersTable.accountStatus,
      currency: bankWalletsTable.currency,
      walletStatus: bankWalletsTable.status,
    })
    .from(bankWalletsTable)
    .innerJoin(bankUsersTable, eq(bankWalletsTable.userId, bankUsersTable.id))
    .where(notInArray(bankWalletsTable.currency, [...supportedCurrencies]))
    .orderBy(asc(bankUsersTable.email), asc(bankWalletsTable.currency));
  const walletIds = rows.map((row) => row.walletId);
  const userIds = [...new Set(rows.map((row) => row.userId))];
  if (!walletIds.length) return { items: [], eligibleCount: 0, blockedCount: 0 };

  const now = new Date();
  const [balances, pendingRows, reservedRows, restrictions] = await Promise.all([
    db
      .select({
        walletId: bankLedgerEntriesTable.walletId,
        amount: sql<string>`coalesce(sum(case when ${bankLedgerEntriesTable.side} = 'credit' then ${bankLedgerEntriesTable.amountMinor} else -${bankLedgerEntriesTable.amountMinor} end), 0)::text`,
      })
      .from(bankLedgerEntriesTable)
      .where(inArray(bankLedgerEntriesTable.walletId, walletIds))
      .groupBy(bankLedgerEntriesTable.walletId),
    db
      .select({
        walletId: bankTransactionsTable.toWalletId,
        amount: sql<string>`coalesce(sum(${bankSandboxRequestsTable.amountMinor}), 0)::text`,
      })
      .from(bankSandboxRequestsTable)
      .innerJoin(
        bankTransactionsTable,
        eq(bankSandboxRequestsTable.transactionId, bankTransactionsTable.id),
      )
      .where(
        and(
          eq(bankSandboxRequestsTable.type, "deposit"),
          inArray(bankSandboxRequestsTable.status, [
            "pending_review",
            "pending_provider_setup",
          ]),
          inArray(bankTransactionsTable.toWalletId, walletIds),
        ),
      )
      .groupBy(bankTransactionsTable.toWalletId),
    db
      .select({
        walletId: bankTransactionsTable.fromWalletId,
        amount: sql<string>`coalesce(sum(${bankSandboxRequestsTable.amountMinor}), 0)::text`,
      })
      .from(bankSandboxRequestsTable)
      .innerJoin(
        bankTransactionsTable,
        eq(bankSandboxRequestsTable.transactionId, bankTransactionsTable.id),
      )
      .where(
        and(
          eq(bankSandboxRequestsTable.type, "withdrawal"),
          inArray(bankSandboxRequestsTable.status, [
            "pending_review",
            "pending_provider_setup",
          ]),
          inArray(bankTransactionsTable.fromWalletId, walletIds),
        ),
      )
      .groupBy(bankTransactionsTable.fromWalletId),
    db
      .select({
        userId: bankRestrictionsTable.userId,
        walletId: bankRestrictionsTable.walletId,
        type: bankRestrictionsTable.type,
      })
      .from(bankRestrictionsTable)
      .where(
        and(
          inArray(bankRestrictionsTable.userId, userIds),
          eq(bankRestrictionsTable.status, "active"),
          lte(bankRestrictionsTable.effectiveAt, now),
          or(
            isNull(bankRestrictionsTable.expiresAt),
            gt(bankRestrictionsTable.expiresAt, now),
          ),
        ),
      ),
  ]);
  const balanceByWallet = new Map(
    balances.map((row) => [row.walletId, BigInt(row.amount)]),
  );
  const pendingByWallet = new Map(
    pendingRows.map((row) => [row.walletId, BigInt(row.amount)]),
  );
  const reservedByWallet = new Map(
    reservedRows.map((row) => [row.walletId, BigInt(row.amount)]),
  );
  const relevantRows = rows.filter((row) =>
    (balanceByWallet.get(row.walletId) ?? 0n) !== 0n ||
    (pendingByWallet.get(row.walletId) ?? 0n) !== 0n ||
    (reservedByWallet.get(row.walletId) ?? 0n) !== 0n,
  );
  const rates = new Map<
    string,
    Awaited<ReturnType<typeof getExchangeRate>> | null
  >();
  await Promise.all(
    [...new Set(relevantRows.map((row) => row.currency))].map(async (currency) => {
      try {
        rates.set(currency, await getExchangeRate(currency, "USD"));
      } catch {
        rates.set(currency, null);
      }
    }),
  );

  const items = relevantRows.map((row) => {
    const balance = balanceByWallet.get(row.walletId) ?? 0n;
    const pending = pendingByWallet.get(row.walletId) ?? 0n;
    const reserved = reservedByWallet.get(row.walletId) ?? 0n;
    const restrictionsForWallet = restrictions.filter(
      (restriction) =>
        restriction.userId === row.userId &&
        (!restriction.walletId || restriction.walletId === row.walletId),
    );
    const quote = rates.get(row.currency) ?? null;
    let targetAmount: string | null = null;
    let blockReason: string | null = null;
    if (row.accountStatus !== "active") {
      blockReason = "The customer account is not active.";
    } else if (row.walletStatus !== "active" || restrictionsForWallet.length) {
      blockReason = "An account or wallet restriction must be resolved first.";
    } else if (reserved > 0n) {
      blockReason = "Resolve outstanding withdrawal reservations first.";
    } else if (balance <= 0n) {
      blockReason = "There is no positive balance to convert.";
    } else if (!quote) {
      blockReason = "A supported exchange-rate quote is unavailable.";
    } else {
      const converted = convertMinorAmount(balance, quote.rate, "USD");
      if (converted <= 0n) {
        blockReason = "The balance converts to less than USD 0.01.";
      } else {
        targetAmount = formatMinorAmount(converted, "USD");
      }
    }
    return {
      walletId: row.walletId,
      userId: row.userId,
      customerId: row.customerId,
      memberName:
        [row.firstName, row.lastName].filter(Boolean).join(" ") || "Globus member",
      email: row.email,
      currency: row.currency,
      sourceAmount: formatMinorAmount(balance, row.currency),
      pending: formatMinorAmount(pending, row.currency),
      reserved: formatMinorAmount(reserved, row.currency),
      targetAmount,
      exchangeRate: quote?.rate ?? null,
      rateProvider: quote?.provider ?? null,
      rateUpdatedAt: quote?.checkedAt.toISOString() ?? null,
      eligible: blockReason === null,
      blockReason,
    };
  });
  return {
    items,
    eligibleCount: items.filter((item) => item.eligible).length,
    blockedCount: items.filter((item) => !item.eligible).length,
  };
}

router.get(
  "/bank/admin/wallet-currency-migration",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const preview = await legacyWalletCurrencyMigrationPreview();
    res.json(GetAdminWalletCurrencyMigrationPreviewResponse.parse(preview));
  },
);

router.post(
  "/bank/admin/wallet-currency-migration",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = ConvertAdminWalletCurrenciesToUsdBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const walletIds = parsed.data.conversions.map((conversion) => conversion.walletId);
    if (new Set(walletIds).size !== walletIds.length) {
      res.status(400).json({ error: "A wallet may appear only once in a conversion request." });
      return;
    }
    const actorUserId = getAuth(req).userId;
    if (!actorUserId) {
      res.status(401).json({ error: "Sign in with an authorized administrator account." });
      return;
    }
    const actor = await ensureBankUser(actorUserId);
    const pinResult = await verifyTransactionPin(actor.id, parsed.data.transactionPin);
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }

    const preview = await legacyWalletCurrencyMigrationPreview();
    const expectedById = new Map(
      preview.items.map((item) => [item.walletId, item]),
    );
    const conversions = parsed.data.conversions;
    if (conversions.some((conversion) => {
      const current = expectedById.get(conversion.walletId);
      return !current ||
        !current.eligible ||
        current.sourceAmount !== conversion.sourceAmount ||
        !current.exchangeRate ||
        !conversionRatesMatch(current.exchangeRate, conversion.exchangeRate);
    })) {
      res.status(409).json({
        error: "Wallet balances, restrictions, or rates changed. Refresh the preview and confirm again.",
      });
      return;
    }

    const quotes = new Map<string, Awaited<ReturnType<typeof getExchangeRate>>>();
    try {
      await Promise.all(
        [...new Set(conversions.map((conversion) => expectedById.get(conversion.walletId)!.currency))]
          .map(async (currency) => quotes.set(currency, await getExchangeRate(currency, "USD"))),
      );
    } catch {
      res.status(503).json({ error: "An exchange rate is unavailable. No balances were changed." });
      return;
    }
    if (conversions.some((conversion) => {
      const source = expectedById.get(conversion.walletId)!;
      return !conversionRatesMatch(
        source.exchangeRate ?? "",
        quotes.get(source.currency)?.rate ?? "",
      );
    })) {
      res.status(409).json({
        error: "The exchange rate changed. Refresh the preview and confirm again.",
      });
      return;
    }

    const sourceAmounts = new Map(
      conversions.map((conversion) => [
        conversion.walletId,
        parseAmountToMinor(conversion.sourceAmount),
      ]),
    );
    const userIds = [...new Set(
      conversions.map((conversion) => expectedById.get(conversion.walletId)!.userId),
    )];
    const result = await db.transaction(async (tx) => {
      const sourceWalletRows = await tx
        .select()
        .from(bankWalletsTable)
        .where(inArray(bankWalletsTable.id, walletIds));
      const usdWalletRows = await tx
        .select()
        .from(bankWalletsTable)
        .where(
          and(
            inArray(bankWalletsTable.userId, userIds),
            eq(bankWalletsTable.currency, "USD"),
          ),
        );
      const usdWalletByUser = new Map(usdWalletRows.map((wallet) => [wallet.userId, wallet]));
      if (sourceWalletRows.length !== walletIds.length || userIds.some((id) => !usdWalletByUser.has(id))) {
        return { error: "A source wallet or USD wallet is no longer available." } as const;
      }
      const lockedWalletIds = [
        ...new Set([
          ...walletIds,
          ...usdWalletRows.map((wallet) => wallet.id),
        ]),
      ];
      const lockedWallets = await tx
        .select()
        .from(bankWalletsTable)
        .where(inArray(bankWalletsTable.id, lockedWalletIds))
        .orderBy(asc(bankWalletsTable.id))
        .for("update");
      const lockedById = new Map(lockedWallets.map((wallet) => [wallet.id, wallet]));
      const users = await tx
        .select({
          id: bankUsersTable.id,
          customerId: bankUsersTable.customerId,
          accountStatus: bankUsersTable.accountStatus,
          preferredReceiptTemplate: bankUsersTable.preferredReceiptTemplate,
        })
        .from(bankUsersTable)
        .where(inArray(bankUsersTable.id, userIds));
      const usersById = new Map(users.map((user) => [user.id, user]));
      const now = new Date();
      const activeRestrictions = await tx
        .select({
          userId: bankRestrictionsTable.userId,
          walletId: bankRestrictionsTable.walletId,
        })
        .from(bankRestrictionsTable)
        .where(
          and(
            inArray(bankRestrictionsTable.userId, userIds),
            eq(bankRestrictionsTable.status, "active"),
            lte(bankRestrictionsTable.effectiveAt, now),
            or(
              isNull(bankRestrictionsTable.expiresAt),
              gt(bankRestrictionsTable.expiresAt, now),
            ),
          ),
        );
      const existingKeys = await tx
        .select({ idempotencyKey: bankTransactionsTable.idempotencyKey })
        .from(bankTransactionsTable)
        .where(inArray(
          bankTransactionsTable.idempotencyKey,
          walletIds.map((id) => `legacy-currency-to-usd:${id}`),
        ));
      if (existingKeys.length) {
        return { error: "At least one wallet has already been converted." } as const;
      }
      const pendingDeposits = await tx
        .select({
          walletId: bankTransactionsTable.toWalletId,
          amount: sql<string>`coalesce(sum(${bankSandboxRequestsTable.amountMinor}), 0)::text`,
        })
        .from(bankSandboxRequestsTable)
        .innerJoin(
          bankTransactionsTable,
          eq(bankSandboxRequestsTable.transactionId, bankTransactionsTable.id),
        )
        .where(
          and(
            eq(bankSandboxRequestsTable.type, "deposit"),
            inArray(bankSandboxRequestsTable.status, [
              "pending_review",
              "pending_provider_setup",
            ]),
            inArray(bankTransactionsTable.toWalletId, walletIds),
          ),
        )
        .groupBy(bankTransactionsTable.toWalletId);
      const pendingByWallet = new Map(
        pendingDeposits.map((row) => [row.walletId, BigInt(row.amount)]),
      );

      const prepared: Array<{
        source: (typeof sourceWalletRows)[number];
        target: (typeof usdWalletRows)[number];
        owner: (typeof users)[number];
        sourceMinor: bigint;
        targetMinor: bigint;
        rate: Awaited<ReturnType<typeof getExchangeRate>>;
      }> = [];
      for (const conversion of conversions) {
        const source = lockedById.get(conversion.walletId);
        const expected = expectedById.get(conversion.walletId)!;
        const targetSnapshot = usdWalletByUser.get(expected.userId);
        const target = targetSnapshot ? lockedById.get(targetSnapshot.id) : undefined;
        const owner = usersById.get(expected.userId);
        if (!source || !target || !owner) {
          return { error: "A source wallet, USD wallet, or customer record is missing." } as const;
        }
        const blockedByRestriction = activeRestrictions.some(
          (restriction) =>
            restriction.userId === owner.id &&
            (!restriction.walletId ||
              restriction.walletId === source.id ||
              restriction.walletId === target.id),
        );
        if (
          owner.accountStatus !== "active" ||
          source.status !== "active" ||
          target.status !== "active" ||
          blockedByRestriction
        ) {
          return { error: "An account or wallet restriction must be resolved before conversion." } as const;
        }
        const balance = await balanceForWallet(tx, source.id);
        const reserved = await reservedForWallet(tx, source.id);
        const sourceMinor = sourceAmounts.get(source.id)!;
        if (
          source.currency !== expected.currency ||
          source.currency === "USD" ||
          balance !== sourceMinor ||
          sourceMinor <= 0n ||
          reserved > 0n ||
          (pendingByWallet.get(source.id) ?? 0n) > 0n
        ) {
          return { error: "A wallet balance or pending operation changed. Refresh the preview." } as const;
        }
        const rate = quotes.get(source.currency)!;
        const targetMinor = convertMinorAmount(sourceMinor, rate.rate, "USD");
        if (targetMinor <= 0n) {
          return { error: "A balance converts to less than USD 0.01 and requires manual review." } as const;
        }
        prepared.push({ source, target, owner, sourceMinor, targetMinor, rate });
      }

      const created: Array<{
        walletId: string;
        customerId: string | null;
        sourceCurrency: string;
        sourceAmount: string;
        targetAmount: string;
        exchangeRate: string;
        rateProvider: "Frankfurter" | "Grey";
        reference: string;
      }> = [];
      for (const item of prepared) {
        const reference = createReference();
        const description = `Legacy ${item.source.currency} balance converted to USD. Rate ${item.rate.rate} from ${item.rate.provider}, quoted ${item.rate.checkedAt.toISOString()}. ${generatedAdminAuditReason(req)}`;
        const [transaction] = await tx
          .insert(bankTransactionsTable)
          .values(withCustomerReceiptTemplate({
            reference,
            idempotencyKey: `legacy-currency-to-usd:${item.source.id}`,
            initiatedByUserId: actor.id,
            fromUserId: item.owner.id,
            toUserId: item.owner.id,
            fromWalletId: item.source.id,
            toWalletId: item.target.id,
            type: "exchange_request",
            status: "completed",
            currency: item.source.currency,
            amountMinor: item.sourceMinor,
            feeMinor: 0n,
            counterparty: "Currency conversion",
            description,
            adminReference: "Legacy wallet conversion to USD",
            adminNotes: null,
            mode: "internal_ledger",
          }, item.owner.preferredReceiptTemplate))
          .returning();
        await tx.insert(bankLedgerEntriesTable).values([
          {
            transactionId: transaction.id,
            walletId: item.source.id,
            accountCode: `wallet:${item.source.id}`,
            currency: item.source.currency,
            side: "debit",
            amountMinor: item.sourceMinor,
          },
          {
            transactionId: transaction.id,
            accountCode: `internal:fx-clearing:${item.source.currency}`,
            currency: item.source.currency,
            side: "credit",
            amountMinor: item.sourceMinor,
          },
          {
            transactionId: transaction.id,
            accountCode: "internal:fx-clearing:USD",
            currency: "USD",
            side: "debit",
            amountMinor: item.targetMinor,
          },
          {
            transactionId: transaction.id,
            walletId: item.target.id,
            accountCode: `wallet:${item.target.id}`,
            currency: "USD",
            side: "credit",
            amountMinor: item.targetMinor,
          },
        ]);
        await tx.insert(bankAuditLogsTable).values({
          actorUserId: actor.id,
          targetUserId: item.owner.id,
          action: "convert_legacy_wallet_to_usd",
          reason: description,
        });
        created.push({
          walletId: item.source.id,
          customerId: item.owner.customerId,
          sourceCurrency: item.source.currency,
          sourceAmount: formatMinorAmount(item.sourceMinor, item.source.currency),
          targetAmount: formatMinorAmount(item.targetMinor, "USD"),
          exchangeRate: item.rate.rate,
          rateProvider: item.rate.provider,
          reference,
        });
      }
      return { conversions: created } as const;
    });
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json(
      ConvertAdminWalletCurrenciesToUsdResponse.parse({
        convertedCount: result.conversions.length,
        conversions: result.conversions,
      }),
    );
  },
);

router.patch(
  "/bank/admin/wallets/:walletId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateAdminWalletStatusParams.safeParse(req.params);
    const parsed = UpdateAdminWalletStatusBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid request.",
      });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const reason = generatedAdminAuditReason(req);
    const result = await db.transaction(async (tx) => {
      const [observedWallet] = await tx
        .select({ userId: bankWalletsTable.userId })
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, params.data.walletId))
        .limit(1);
      if (!observedWallet) return null;
      const [user] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, observedWallet.userId))
        .for("update");
      if (!user) return null;
      const [wallet] = await tx
        .select()
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, params.data.walletId))
        .for("update");
      if (!wallet) return null;
      const restricted = parsed.data.status === "restricted";
      const now = new Date();
      let activeFreeze: typeof bankRestrictionsTable.$inferSelect | undefined;
      if (restricted) {
        [activeFreeze] = await tx
          .insert(bankRestrictionsTable)
          .values({
            userId: user.id,
            walletId: wallet.id,
            type: "freeze_wallet",
            reason,
            effectiveAt: now,
            createdByUserId: actorUserId,
            internalNotes: null,
          })
          .returning();
      } else {
        const [freezeToRemove] = await tx
          .select()
          .from(bankRestrictionsTable)
          .where(
            and(
              eq(bankRestrictionsTable.userId, user.id),
              eq(bankRestrictionsTable.walletId, wallet.id),
              eq(bankRestrictionsTable.type, "freeze_wallet"),
              eq(bankRestrictionsTable.status, "active"),
              lte(bankRestrictionsTable.effectiveAt, now),
              or(
                isNull(bankRestrictionsTable.expiresAt),
                gt(bankRestrictionsTable.expiresAt, now),
              ),
            ),
          )
          .orderBy(desc(bankRestrictionsTable.createdAt))
          .limit(1)
          .for("update");
        if (freezeToRemove) {
          await tx
            .update(bankRestrictionsTable)
            .set({
              status: "removed",
              removedAt: now,
              removedByUserId: actorUserId,
              removalReason: reason,
            })
            .where(eq(bankRestrictionsTable.id, freezeToRemove.id));
        }
      }
      const [remainingFreeze] = restricted
        ? [activeFreeze]
        : await tx
            .select()
            .from(bankRestrictionsTable)
            .where(
              and(
                eq(bankRestrictionsTable.userId, user.id),
                eq(bankRestrictionsTable.walletId, wallet.id),
                eq(bankRestrictionsTable.type, "freeze_wallet"),
                eq(bankRestrictionsTable.status, "active"),
                lte(bankRestrictionsTable.effectiveAt, now),
                or(
                  isNull(bankRestrictionsTable.expiresAt),
                  gt(bankRestrictionsTable.expiresAt, now),
                ),
              ),
            )
            .orderBy(desc(bankRestrictionsTable.createdAt))
            .limit(1);
      const remainsFrozen = Boolean(remainingFreeze);
      const [updated] = await tx
        .update(bankWalletsTable)
        .set({
          status: remainsFrozen ? "restricted" : "active",
          restrictionReason: remainsFrozen ? remainingFreeze?.reason ?? reason : null,
          restrictionNotes: remainsFrozen ? remainingFreeze?.internalNotes ?? null : null,
          restrictedByUserId: remainsFrozen
            ? remainingFreeze?.createdByUserId ?? actorUserId
            : null,
          restrictedAt: remainsFrozen ? remainingFreeze?.effectiveAt ?? now : null,
          updatedAt: now,
        })
        .where(eq(bankWalletsTable.id, wallet.id))
        .returning();
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: user.id,
        action: restricted ? "freeze_wallet" : "unfreeze_wallet",
        reason: `${wallet.currency} wallet ${wallet.id}: ${reason}${!restricted && remainsFrozen ? " Other active freeze restrictions remain in effect." : ""}`,
      });
      const balance = await balanceForWallet(tx, wallet.id);
      return { wallet: updated, user, balance };
    });
    if (!result) {
      res.status(404).json({ error: "Wallet account not found." });
      return;
    }
    res.json(
      UpdateAdminWalletStatusResponse.parse({
        id: result.wallet.id,
        userId: result.user.id,
        customerId: result.user.customerId,
        memberName:
          [result.user.firstName, result.user.lastName].filter(Boolean).join(" ") ||
          "Globus member",
        email: result.user.email,
        currency: result.wallet.currency,
        balance: formatMinorAmount(result.balance),
        status: result.wallet.status,
        restrictionReason: result.wallet.restrictionReason,
        restrictionNotes: result.wallet.restrictionNotes,
        restrictedAt: result.wallet.restrictedAt?.toISOString() ?? null,
        createdAt: result.wallet.createdAt.toISOString(),
      }),
    );
  },
);

router.get("/bank/admin/audit-logs", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListAdminAuditLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.pageSize ?? 25;
  const filters = [];
  if (parsed.data.action) {
    filters.push(ilike(bankAuditLogsTable.action, `%${parsed.data.action.trim()}%`));
  }
  const search = parsed.data.search?.trim();
  if (search) {
    const needle = `%${search}%`;
    filters.push(
      or(
        ilike(bankAuditLogsTable.action, needle),
        ilike(bankAuditLogsTable.reason, needle),
        sql`${bankAuditLogsTable.actorUserId} in (select id from bank_users where email ilike ${needle} or customer_id ilike ${needle} or first_name ilike ${needle} or last_name ilike ${needle})`,
        sql`${bankAuditLogsTable.targetUserId} in (select id from bank_users where email ilike ${needle} or customer_id ilike ${needle} or first_name ilike ${needle} or last_name ilike ${needle})`,
      ),
    );
  }
  const where = filters.length ? and(...filters) : undefined;
  const [totalRows] = await db
    .select({ value: count() })
    .from(bankAuditLogsTable)
    .where(where);
  const logs = await db
    .select()
    .from(bankAuditLogsTable)
    .where(where)
    .orderBy(desc(bankAuditLogsTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const userIds = [
    ...new Set(logs.flatMap((log) => [log.actorUserId, log.targetUserId])),
  ];
  const users = userIds.length
    ? await db
        .select({
          id: bankUsersTable.id,
          email: bankUsersTable.email,
          firstName: bankUsersTable.firstName,
          lastName: bankUsersTable.lastName,
        })
        .from(bankUsersTable)
        .where(inArray(bankUsersTable.id, userIds))
    : [];
  const userById = new Map(users.map((user) => [user.id, user]));
  res.json(
    ListAdminAuditLogsResponse.parse({
      items: logs.map((log) => {
        const actor = userById.get(log.actorUserId);
        const target = userById.get(log.targetUserId);
        return {
          id: log.id,
          actorName:
            [actor?.firstName, actor?.lastName].filter(Boolean).join(" ") ||
            actor?.email ||
            "Unknown administrator",
          actorEmail: actor?.email ?? "unknown@invalid.local",
          targetName:
            [target?.firstName, target?.lastName].filter(Boolean).join(" ") ||
            target?.email ||
            "Unknown member",
          targetEmail: target?.email ?? "unknown@invalid.local",
          action: log.action,
          reason: log.reason,
          createdAt: log.createdAt.toISOString(),
        };
      }),
      total: Number(totalRows?.value ?? 0),
      page,
      pageSize,
    }),
  );
});

router.get("/bank/admin/settings", requireAdmin, async (_req, res): Promise<void> => {
  const settings = await getOrCreateAdminSettings();
  res.json(
    GetAdminSettingsResponse.parse(adminSettingsPayload(settings)),
  );
});

router.put("/bank/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateAdminSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const customerEmailSenderDisplayName =
    normalizeCustomerEmailSenderDisplayName(
      parsed.data.customerEmailSenderDisplayName,
    );
  if (!customerEmailSenderDisplayName) {
    res.status(400).json({
      error: "Enter a display name from 1 to 80 characters without control characters or angle brackets.",
    });
    return;
  }
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const actorUserId = (await ensureBankUser(clerkUserId)).id;
  const pinResult = await verifyTransactionPin(actorUserId, parsed.data.transactionPin);
  if (pinResult !== "valid") {
    respondWithTransactionPinError(res, pinResult);
    return;
  }
  let fundingLimitMinor: bigint;
  let approvalThresholdMinor: bigint;
  let vaultPlan1mPriceMinor: bigint;
  let vaultPlan3mPriceMinor: bigint;
  let vaultPlan1yPriceMinor: bigint;
  try {
    fundingLimitMinor = parseAmountToMinor(parsed.data.fundingLimit);
    approvalThresholdMinor = parseAmountToMinor(parsed.data.secondApprovalThreshold);
    vaultPlan1mPriceMinor = parseAmountToMinor(parsed.data.vaultPlan1mPrice);
    vaultPlan3mPriceMinor = parseAmountToMinor(parsed.data.vaultPlan3mPrice);
    vaultPlan1yPriceMinor = parseAmountToMinor(parsed.data.vaultPlan1yPrice);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Enter valid funding settings.",
    });
    return;
  }
  const hardCeilingMinor = 10_000_000_000n;
  if (
    fundingLimitMinor <= 0n ||
    fundingLimitMinor > hardCeilingMinor ||
    approvalThresholdMinor < 0n ||
    approvalThresholdMinor > fundingLimitMinor
    || vaultPlan1mPriceMinor <= 0n
    || vaultPlan3mPriceMinor <= 0n
    || vaultPlan1yPriceMinor <= 0n
    || vaultPlan1mPriceMinor > hardCeilingMinor
    || vaultPlan3mPriceMinor > hardCeilingMinor
    || vaultPlan1yPriceMinor > hardCeilingMinor
  ) {
    res.status(400).json({
      error: "Funding and Vault plan amounts must be positive and no more than 100,000,000; the approval threshold must not exceed the funding limit.",
    });
    return;
  }
  const reason = generatedAdminAuditReason(req);
  const [settings] = await db
    .insert(bankAdminSettingsTable)
    .values({
      id: "operations",
      customerEmailSenderDisplayName,
      fundingLimit: formatMinorAmount(fundingLimitMinor),
      secondApprovalThreshold: formatMinorAmount(approvalThresholdMinor),
      vaultPlan1mPriceMinor: vaultPlan1mPriceMinor.toString(),
      vaultPlan3mPriceMinor: vaultPlan3mPriceMinor.toString(),
      vaultPlan1yPriceMinor: vaultPlan1yPriceMinor.toString(),
      updatedByUserId: actorUserId,
    })
    .onConflictDoUpdate({
      target: bankAdminSettingsTable.id,
      set: {
        customerEmailSenderDisplayName,
        fundingLimit: formatMinorAmount(fundingLimitMinor),
        secondApprovalThreshold: formatMinorAmount(approvalThresholdMinor),
        vaultPlan1mPriceMinor: vaultPlan1mPriceMinor.toString(),
        vaultPlan3mPriceMinor: vaultPlan3mPriceMinor.toString(),
        vaultPlan1yPriceMinor: vaultPlan1yPriceMinor.toString(),
        updatedByUserId: actorUserId,
        updatedAt: new Date(),
      },
    })
    .returning();
  await db.insert(bankAuditLogsTable).values({
    actorUserId,
    targetUserId: actorUserId,
    action: "update_admin_settings",
    reason: `Transfer-alert display name ${settings.customerEmailSenderDisplayName}; funding cap ${settings.fundingLimit}; second approval threshold ${settings.secondApprovalThreshold}; unverified dashboard notice and Paystack Vault plan pricing updated. ${reason}`,
  });
  res.json(
    UpdateAdminSettingsResponse.parse(adminSettingsPayload(settings)),
  );
});

router.get(
  "/bank/admin/restrictions",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = ListAdminRestrictionsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const now = new Date();
    const filters = [];
    if (parsed.data.type) {
      filters.push(eq(bankRestrictionsTable.type, parsed.data.type));
    }
    if (parsed.data.search?.trim()) {
      const needle = `%${parsed.data.search.trim()}%`;
      filters.push(
        or(
          ilike(bankRestrictionsTable.reason, needle),
          ilike(bankRestrictionsTable.internalNotes, needle),
          sql`${bankRestrictionsTable.walletId}::text ilike ${needle}`,
          sql`${bankRestrictionsTable.userId} in (
            select id from bank_users
            where email ilike ${needle}
              or customer_id ilike ${needle}
              or first_name ilike ${needle}
              or last_name ilike ${needle}
          )`,
        ),
      );
    }
    if (parsed.data.status === "removed") {
      filters.push(eq(bankRestrictionsTable.status, "removed"));
    } else if (parsed.data.status === "scheduled") {
      filters.push(eq(bankRestrictionsTable.status, "active"));
      filters.push(gt(bankRestrictionsTable.effectiveAt, now));
    } else if (parsed.data.status === "expired") {
      filters.push(eq(bankRestrictionsTable.status, "active"));
      filters.push(lte(bankRestrictionsTable.expiresAt, now));
    } else if (parsed.data.status === "active") {
      filters.push(eq(bankRestrictionsTable.status, "active"));
      filters.push(lte(bankRestrictionsTable.effectiveAt, now));
      filters.push(
        or(
          isNull(bankRestrictionsTable.expiresAt),
          gt(bankRestrictionsTable.expiresAt, now),
        ),
      );
    }
    const where = filters.length ? and(...filters) : undefined;
    const [total] = await db
      .select({ value: count() })
      .from(bankRestrictionsTable)
      .where(where);
    const restrictions = await db
      .select()
      .from(bankRestrictionsTable)
      .where(where)
      .orderBy(desc(bankRestrictionsTable.createdAt))
      .limit(parsed.data.pageSize)
      .offset((parsed.data.page - 1) * parsed.data.pageSize);
    const relatedUserIds = [
      ...new Set(
        restrictions.flatMap((restriction) =>
          [
            restriction.userId,
            restriction.createdByUserId,
            restriction.removedByUserId,
          ].filter((id): id is string => Boolean(id)),
        ),
      ),
    ];
    const relatedUsers = relatedUserIds.length
      ? await db
          .select()
          .from(bankUsersTable)
          .where(inArray(bankUsersTable.id, relatedUserIds))
      : [];
    const usersById = new Map(relatedUsers.map((user) => [user.id, user]));
    const walletIds = [
      ...new Set(
        restrictions
          .map((restriction) => restriction.walletId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const wallets = walletIds.length
      ? await db
          .select()
          .from(bankWalletsTable)
          .where(inArray(bankWalletsTable.id, walletIds))
      : [];
    const walletsById = new Map(wallets.map((wallet) => [wallet.id, wallet]));
    const items = restrictions.map((restriction) => {
      const customer = usersById.get(restriction.userId);
      if (!customer) {
        throw new Error("A restriction references a missing customer record.");
      }
      return adminRestrictionResponse({
        restriction,
        customer,
        wallet: restriction.walletId
          ? walletsById.get(restriction.walletId)
          : undefined,
        createdBy: usersById.get(restriction.createdByUserId),
        removedBy: restriction.removedByUserId
          ? usersById.get(restriction.removedByUserId)
          : undefined,
      });
    });
    res.json(
      ListAdminRestrictionsResponse.parse({
        items,
        total: Number(total?.value ?? 0),
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
      }),
    );
  },
);

router.post(
  "/bank/admin/restrictions",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = CreateAdminRestrictionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access administrative controls." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const effectiveAt = parsed.data.effectiveAt;
    const expiresAt = parsed.data.expiresAt ?? null;
    if (expiresAt && expiresAt <= effectiveAt) {
      res.status(400).json({ error: "Expiry must be later than the effective date." });
      return;
    }
    if (parsed.data.type === "freeze_wallet" && !parsed.data.walletId) {
      res.status(400).json({ error: "Select a wallet to freeze." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [customer] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, parsed.data.userId))
        .for("update");
      if (!customer) return { notFound: true as const };
      const wallet = parsed.data.walletId
        ? (
            await tx
              .select()
              .from(bankWalletsTable)
              .where(
                and(
                  eq(bankWalletsTable.id, parsed.data.walletId),
                  eq(bankWalletsTable.userId, customer.id),
                ),
              )
              .for("update")
          )[0]
        : undefined;
      if (parsed.data.walletId && !wallet) {
        return { error: "The selected wallet does not belong to this customer." };
      }
      const [restriction] = await tx
        .insert(bankRestrictionsTable)
        .values({
          userId: customer.id,
          walletId: wallet?.id ?? null,
          type: parsed.data.type,
          reason: generatedAdminAuditReason(req),
          effectiveAt,
          expiresAt,
          internalNotes: null,
          createdByUserId: actorUserId,
        })
        .returning();
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: customer.id,
        action: "create_account_restriction",
        reason: `${generatedAdminAuditReason(req)} Restriction ${restriction.id} is ${parsed.data.type}, effective ${effectiveAt.toISOString()}${expiresAt ? ` until ${expiresAt.toISOString()}` : ""}.`,
      });
      const [actor] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, actorUserId));
      return { restriction, customer, wallet, actor };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "Customer account not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.status(201).json(
      CreateAdminRestrictionResponse.parse(
        adminRestrictionResponse({
          restriction: result.restriction,
          customer: result.customer,
          wallet: result.wallet,
          createdBy: result.actor,
        }),
      ),
    );
  },
);

router.post(
  "/bank/admin/restrictions/:restrictionId/remove",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = RemoveAdminRestrictionParams.safeParse(req.params);
    const parsed = RemoveAdminRestrictionBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid request.",
      });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access administrative controls." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [observed] = await tx
        .select()
        .from(bankRestrictionsTable)
        .where(eq(bankRestrictionsTable.id, params.data.restrictionId))
        .limit(1);
      if (!observed) return { notFound: true as const };
      await tx
        .select({ id: bankUsersTable.id })
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, observed.userId))
        .for("update");
      const [restriction] = await tx
        .select()
        .from(bankRestrictionsTable)
        .where(eq(bankRestrictionsTable.id, observed.id))
        .for("update");
      if (!restriction) return { notFound: true as const };
      if (restriction.status === "removed") {
        return { error: "This restriction has already been removed." };
      }
      const [customer] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, restriction.userId));
      if (!customer) return { notFound: true as const };
      const [updated] = await tx
        .update(bankRestrictionsTable)
        .set({
          status: "removed",
          removedAt: new Date(),
          removedByUserId: actorUserId,
          removalReason: generatedAdminAuditReason(req),
        })
        .where(eq(bankRestrictionsTable.id, restriction.id))
        .returning();
      let wallet: typeof bankWalletsTable.$inferSelect | undefined;
      if (restriction.walletId) {
        const [savedWallet] = await tx
          .select()
          .from(bankWalletsTable)
          .where(eq(bankWalletsTable.id, restriction.walletId))
          .for("update");
        wallet = savedWallet;
        if (
          savedWallet?.status === "restricted" &&
          savedWallet.restrictionReason === restriction.reason &&
          savedWallet.restrictedByUserId === restriction.createdByUserId
        ) {
          const [remainingFreeze] = await tx
            .select({ id: bankRestrictionsTable.id })
            .from(bankRestrictionsTable)
            .where(
              and(
                eq(bankRestrictionsTable.userId, restriction.userId),
                eq(bankRestrictionsTable.walletId, restriction.walletId),
                eq(bankRestrictionsTable.type, "freeze_wallet"),
                eq(bankRestrictionsTable.status, "active"),
                lte(bankRestrictionsTable.effectiveAt, new Date()),
                or(
                  isNull(bankRestrictionsTable.expiresAt),
                  gt(bankRestrictionsTable.expiresAt, new Date()),
                ),
              ),
            )
            .limit(1);
          if (!remainingFreeze) {
            const [clearedWallet] = await tx
              .update(bankWalletsTable)
              .set({
                status: "active",
                restrictionReason: null,
                restrictionNotes: null,
                restrictedByUserId: null,
                restrictedAt: null,
                updatedAt: new Date(),
              })
              .where(eq(bankWalletsTable.id, savedWallet.id))
              .returning();
            wallet = clearedWallet;
          }
        }
      }
      const [creator] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, restriction.createdByUserId));
      const [actor] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, actorUserId));
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: customer.id,
        action: "remove_account_restriction",
        reason: `${generatedAdminAuditReason(req)} Restriction ${restriction.id} (${restriction.type}) removed.`,
      });
      return { restriction: updated, customer, wallet, creator, actor };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "Restriction record not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json(
      RemoveAdminRestrictionResponse.parse(
        adminRestrictionResponse({
          restriction: result.restriction,
          customer: result.customer,
          wallet: result.wallet,
          createdBy: result.creator,
          removedBy: result.actor,
        }),
      ),
    );
  },
);

router.get("/bank/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListAdminUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const search = parsed.data.search?.trim();
  const filters = [];
  if (search) {
    const needle = `%${search}%`;
    filters.push(
      or(
        ilike(bankUsersTable.email, needle),
        ilike(bankUsersTable.id, needle),
        ilike(bankUsersTable.customerId, needle),
        ilike(bankUsersTable.firstName, needle),
        ilike(bankUsersTable.lastName, needle),
        sql`${bankUsersTable.id} in (select user_id from bank_wallets where id::text ilike ${needle})`,
      ),
    );
  }
  const now = new Date();
  const hasActiveRestriction = sql`exists (
    select 1 from bank_restrictions br
    where br.user_id = ${bankUsersTable.id}
      and br.status = 'active'
      and br.effective_at <= ${now}
      and (br.expires_at is null or br.expires_at > ${now})
  )`;
  const hasActiveSuspension = sql`exists (
    select 1 from bank_restrictions br
    where br.user_id = ${bankUsersTable.id}
      and br.restriction_type = 'suspend_user'
      and br.status = 'active'
      and br.effective_at <= ${now}
      and (br.expires_at is null or br.expires_at > ${now})
  )`;
  if (parsed.data.accountStatus) {
    if (parsed.data.accountStatus === "active") {
      filters.push(
        and(eq(bankUsersTable.accountStatus, "active"), sql`not (${hasActiveRestriction})`),
      );
    } else if (parsed.data.accountStatus === "restricted") {
      filters.push(
        and(
          or(eq(bankUsersTable.accountStatus, "restricted"), hasActiveRestriction),
          sql`not (${hasActiveSuspension})`,
        ),
      );
    } else {
      filters.push(
        or(eq(bankUsersTable.accountStatus, "suspended"), hasActiveSuspension),
      );
    }
  }
  if (parsed.data.vaultSubscriptionStatus === "expired") {
    filters.push(
      and(
        eq(bankUsersTable.vaultSubscriptionStatus, "active"),
        lte(bankUsersTable.vaultSubscriptionExpiresAt, now),
      ),
    );
  } else if (parsed.data.vaultSubscriptionStatus === "active") {
    filters.push(
      and(
        eq(bankUsersTable.vaultSubscriptionStatus, "active"),
        or(
          isNull(bankUsersTable.vaultSubscriptionExpiresAt),
          gt(bankUsersTable.vaultSubscriptionExpiresAt, now),
        ),
      ),
    );
  } else if (parsed.data.vaultSubscriptionStatus) {
    filters.push(
      eq(bankUsersTable.vaultSubscriptionStatus, parsed.data.vaultSubscriptionStatus),
    );
  }
  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.limit ?? 50;
  const [totalRows] = await db
    .select({ value: count() })
    .from(bankUsersTable)
    .where(filters.length ? and(...filters) : undefined);
  const rows = await db
    .select({
      id: bankUsersTable.id,
      email: bankUsersTable.email,
      customerId: bankUsersTable.customerId,
      firstName: bankUsersTable.firstName,
      lastName: bankUsersTable.lastName,
      country: bankUsersTable.country,
      accountStatus: bankUsersTable.accountStatus,
      accountRestrictionReason: bankUsersTable.accountRestrictionReason,
      accountRestrictionNotes: bankUsersTable.accountRestrictionNotes,
      accountRestrictedAt: bankUsersTable.accountRestrictedAt,
      profileSetupCompletedAt: bankUsersTable.profileSetupCompletedAt,
      testingModeDisabled: bankUsersTable.testingModeDisabled,
      transferAccessGranted: bankUsersTable.transferAccessGranted,
      adminAccountTier: bankUsersTable.adminAccountTier,
      vaultSubscriptionStatus: bankUsersTable.vaultSubscriptionStatus,
      vaultSubscriptionExpiresAt: bankUsersTable.vaultSubscriptionExpiresAt,
      vaultSubscriptionPlan: bankUsersTable.vaultSubscriptionPlan,
      createdAt: bankUsersTable.createdAt,
      walletCount: count(bankWalletsTable.id),
    })
    .from(bankUsersTable)
    .leftJoin(bankWalletsTable, eq(bankWalletsTable.userId, bankUsersTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .groupBy(
      bankUsersTable.id,
      bankUsersTable.email,
      bankUsersTable.firstName,
      bankUsersTable.lastName,
      bankUsersTable.country,
      bankUsersTable.accountStatus,
      bankUsersTable.accountRestrictionReason,
      bankUsersTable.accountRestrictionNotes,
      bankUsersTable.accountRestrictedAt,
      bankUsersTable.profileSetupCompletedAt,
      bankUsersTable.testingModeDisabled,
      bankUsersTable.transferAccessGranted,
      bankUsersTable.adminAccountTier,
      bankUsersTable.vaultSubscriptionStatus,
      bankUsersTable.vaultSubscriptionExpiresAt,
      bankUsersTable.vaultSubscriptionPlan,
      bankUsersTable.createdAt,
    )
    .orderBy(desc(bankUsersTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const pageUserIds = rows.map((row) => row.id);
  const activeRestrictions = pageUserIds.length
    ? await db
        .select()
        .from(bankRestrictionsTable)
        .where(
          and(
            inArray(bankRestrictionsTable.userId, pageUserIds),
            eq(bankRestrictionsTable.status, "active"),
            lte(bankRestrictionsTable.effectiveAt, now),
            or(
              isNull(bankRestrictionsTable.expiresAt),
              gt(bankRestrictionsTable.expiresAt, now),
            ),
          ),
        )
        .orderBy(desc(bankRestrictionsTable.createdAt))
    : [];
  const restrictionsByUser = new Map<string, typeof activeRestrictions>();
  for (const restriction of activeRestrictions) {
    const list = restrictionsByUser.get(restriction.userId) ?? [];
    list.push(restriction);
    restrictionsByUser.set(restriction.userId, list);
  }

  res.json(
    ListAdminUsersResponse.parse(
      {
        items: rows.map((row) => ({
          ...row,
          accountTierName: getEffectiveAccountTier(row, now).name,
          accountTierSource: getEffectiveAccountTier(row, now).source,
          accountStatus:
            row.accountStatus === "suspended" ||
            restrictionsByUser.get(row.id)?.some((item) => item.type === "suspend_user")
              ? "suspended"
              : row.accountStatus === "restricted" || (restrictionsByUser.get(row.id)?.length ?? 0) > 0
                ? "restricted"
                : "active",
          accountRestrictionReason:
            row.accountRestrictionReason ??
            restrictionsByUser.get(row.id)?.[0]?.reason ??
            null,
          accountRestrictionNotes:
            row.accountRestrictionNotes ??
            restrictionsByUser.get(row.id)?.[0]?.internalNotes ??
            null,
          accountRestrictedAt:
            row.accountRestrictedAt?.toISOString() ??
            restrictionsByUser.get(row.id)?.[0]?.effectiveAt.toISOString() ??
            null,
          profileSetupCompletedAt:
            row.profileSetupCompletedAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
          walletCount: Number(row.walletCount),
        })),
        total: Number(totalRows?.value ?? 0),
        page,
        pageSize,
      },
    ),
  );
});

router.get(
  "/bank/admin/vault-access",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = ListAdminVaultAccessQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const search = parsed.data.search.trim();
    if (search.length < 2) {
      res.status(400).json({ error: "Enter at least two characters to search." });
      return;
    }
    const needle = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    const rows = await db
      .select({
        user: bankUsersTable,
        grant: bankVaultAdminEntitlementsTable,
      })
      .from(bankUsersTable)
      .leftJoin(
        bankVaultAdminEntitlementsTable,
        eq(bankVaultAdminEntitlementsTable.userId, bankUsersTable.id),
      )
      .where(
        or(
          ilike(bankUsersTable.email, needle),
          ilike(bankUsersTable.id, needle),
          ilike(bankUsersTable.customerId, needle),
        ),
      )
      .orderBy(desc(bankUsersTable.createdAt))
      .limit(25);
    res.json(
      ListAdminVaultAccessResponse.parse({
        items: rows.map(({ user, grant }) =>
          adminVaultAccessRecord(user, grant),
        ),
      }),
    );
  },
);

router.post(
  "/bank/admin/users/:userId/vault-access/grant",
  requireAdmin,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    const params = GrantAdminVaultAccessParams.safeParse(req.params);
    const parsed = GrantAdminVaultAccessBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid Private Vault grant.",
      });
      return;
    }
    if (!authUserId) {
      res.status(401).json({ error: "Sign in with an administrator account." });
      return;
    }
    const expiresAt = adminVaultGrantExpiry(parsed.data.duration);
    const reason = `${generatedAdminAuditReason(req)} Grant duration: ${parsed.data.duration}${expiresAt ? `; expires ${expiresAt.toISOString()}` : "; no expiry"}.`;
    const actor = await ensureBankUser(authUserId);
    const pinResult = await verifyTransactionPin(actor.id, parsed.data.transactionPin);
    if (pinResult !== "valid") {
      const status = pinResult === "locked" ? 429 : pinResult === "not_configured" ? 409 : 403;
      res.status(status).json({
        error: pinResult === "not_configured"
          ? "Set up an administrator transaction PIN before granting access."
          : pinResult === "locked"
            ? "Too many incorrect PIN attempts. Try again later."
            : "The administrator transaction PIN is incorrect.",
      });
      return;
    }
    const result = await applyAdminVaultEntitlementAction(
      actor.id,
      params.data.userId,
      reason,
      "grant",
      expiresAt,
    );
    if ("notFound" in result) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    if ("alreadyGranted" in result) {
      res.status(409).json({ error: "This user already has Admin-granted Vault access." });
      return;
    }
    if (!("target" in result) || !result.target) {
      res.status(500).json({ error: "The Vault entitlement change could not be confirmed." });
      return;
    }
    const [grant] = await db
      .select()
      .from(bankVaultAdminEntitlementsTable)
      .where(eq(bankVaultAdminEntitlementsTable.userId, result.target.id))
      .limit(1);
    res.json(
      GrantAdminVaultAccessResponse.parse(
        adminVaultAccessRecord(result.target, grant ?? null),
      ),
    );
  },
);

router.post(
  "/bank/admin/users/:userId/vault-access/revoke",
  requireAdmin,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    const params = RevokeAdminVaultAccessParams.safeParse(req.params);
    const parsed = RevokeAdminVaultAccessBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid Private Vault revocation.",
      });
      return;
    }
    if (!authUserId) {
      res.status(401).json({ error: "Sign in with an administrator account." });
      return;
    }
    if (params.data.userId === authUserId) {
      res.status(403).json({ error: "Administrators cannot manage their own Vault access." });
      return;
    }
    const reason = generatedAdminAuditReason(req);
    const actor = await ensureBankUser(authUserId);
    const pinResult = await verifyTransactionPin(actor.id, parsed.data.transactionPin);
    if (pinResult !== "valid") {
      const status = pinResult === "locked" ? 429 : pinResult === "not_configured" ? 409 : 403;
      res.status(status).json({
        error: pinResult === "not_configured"
          ? "Set up an administrator transaction PIN before revoking access."
          : pinResult === "locked"
            ? "Too many incorrect PIN attempts. Try again later."
            : "The administrator transaction PIN is incorrect.",
      });
      return;
    }
    const result = await applyAdminVaultEntitlementAction(
      actor.id,
      params.data.userId,
      reason,
      "revoke",
    );
    if ("selfRevoke" in result) {
      res.status(403).json({ error: "Administrators cannot manage their own Vault access." });
      return;
    }
    if ("notFound" in result) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    if ("notGranted" in result) {
      res.status(409).json({ error: "This user has no Admin-granted Vault access to revoke." });
      return;
    }
    if (!("target" in result) || !result.target) {
      res.status(500).json({ error: "The Vault entitlement change could not be confirmed." });
      return;
    }
    res.json(
      RevokeAdminVaultAccessResponse.parse(
        adminVaultAccessRecord(result.target, null),
      ),
    );
  },
);

router.get(
  "/bank/admin/users/:userId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = GetAdminUserDetailParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [user] = await db
      .select()
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, params.data.userId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    const now = new Date();
    const effectiveAccountTier = getEffectiveAccountTier(user, now);
    const [wallets, transactions, history, transactionCountRows, activeRestrictions] = await Promise.all([
      getWalletsForUser(user.id),
      listUserTransactions(user.id, { limit: 50 }),
      db
        .select()
        .from(bankAuditLogsTable)
        .where(eq(bankAuditLogsTable.targetUserId, user.id))
        .orderBy(desc(bankAuditLogsTable.createdAt))
        .limit(50),
      db
        .select({ value: count() })
        .from(bankTransactionsTable)
        .where(
          or(
            eq(bankTransactionsTable.fromUserId, user.id),
            eq(bankTransactionsTable.toUserId, user.id),
          ),
        ),
      db
        .select()
        .from(bankRestrictionsTable)
        .where(
          and(
            eq(bankRestrictionsTable.userId, user.id),
            eq(bankRestrictionsTable.status, "active"),
            lte(bankRestrictionsTable.effectiveAt, now),
            or(
              isNull(bankRestrictionsTable.expiresAt),
              gt(bankRestrictionsTable.expiresAt, now),
            ),
          ),
        )
        .orderBy(desc(bankRestrictionsTable.createdAt)),
    ]);
    const effectiveAccountStatus =
      user.accountStatus === "suspended" ||
      activeRestrictions.some((restriction) => restriction.type === "suspend_user")
        ? "suspended"
        : user.accountStatus === "restricted" || activeRestrictions.length > 0
          ? "restricted"
          : "active";
    const primaryRestriction = activeRestrictions[0];
    const actorIds = [...new Set(history.map((entry) => entry.actorUserId))];
    const actors = actorIds.length
      ? await db
          .select({
            id: bankUsersTable.id,
            email: bankUsersTable.email,
            firstName: bankUsersTable.firstName,
            lastName: bankUsersTable.lastName,
          })
          .from(bankUsersTable)
          .where(inArray(bankUsersTable.id, actorIds))
      : [];
    const actorById = new Map(actors.map((actor) => [actor.id, actor]));
    res.json(
      GetAdminUserDetailResponse.parse({
        user: {
          id: user.id,
          email: user.email,
          accountTierName: effectiveAccountTier.name,
        accountTierSource: effectiveAccountTier.source,
        adminAccountTier: user.adminAccountTier,
          customerId: user.customerId,
          firstName: user.firstName,
          lastName: user.lastName,
          country: user.country,
          accountStatus: effectiveAccountStatus,
          accountRestrictionReason:
            user.accountRestrictionReason ?? primaryRestriction?.reason ?? null,
          accountRestrictionNotes:
            user.accountRestrictionNotes ?? primaryRestriction?.internalNotes ?? null,
          accountRestrictedAt:
            user.accountRestrictedAt?.toISOString() ??
            primaryRestriction?.effectiveAt.toISOString() ??
            null,
          profileSetupCompletedAt:
            user.profileSetupCompletedAt?.toISOString() ?? null,
          testingModeDisabled: user.testingModeDisabled,
          transferAccessGranted: user.transferAccessGranted,
          vaultSubscriptionStatus: vaultSubscriptionStatus(
            user.vaultSubscriptionStatus,
            user.vaultSubscriptionExpiresAt,
          ),
          vaultSubscriptionRequestedAt:
            user.vaultSubscriptionRequestedAt?.toISOString() ?? null,
          vaultSubscriptionExpiresAt:
            user.vaultSubscriptionExpiresAt?.toISOString() ?? null,
          vaultSubscriptionReason: user.vaultSubscriptionReason,
          vaultSubscriptionPlan: user.vaultSubscriptionPlan,
          vaultSubscriptionAmountMinor: user.vaultSubscriptionAmountMinor,
          vaultSubscriptionAutoRenew: user.vaultSubscriptionAutoRenew,
          walletCount: wallets.length,
          createdAt: user.createdAt.toISOString(),
        },
        address: user.address,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        cityOfOrigin: user.cityOfOrigin,
        occupation: user.occupation,
        profileSetupCompletedAt:
          user.profileSetupCompletedAt?.toISOString() ?? null,
        testingModeDisabled: user.testingModeDisabled,
        transferAccessGranted: user.transferAccessGranted,
        supportAccessGranted: user.supportAccessGranted,
        transactionPinConfigured: !!user.transactionPinHash,
        transactionCount: Number(transactionCountRows[0]?.value ?? 0),
        wallets,
        transactions,
        administrativeHistory: history.map((entry) => {
          const actor = actorById.get(entry.actorUserId);
          return {
            id: entry.id,
            actorName:
              [actor?.firstName, actor?.lastName].filter(Boolean).join(" ") ||
              actor?.email ||
              "Unknown administrator",
            actorEmail: actor?.email ?? "unknown@invalid.local",
            targetName:
              [user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.email,
            targetEmail: user.email,
            action: entry.action,
            reason: entry.reason,
            createdAt: entry.createdAt.toISOString(),
          };
        }),
      }),
    );
  },
);

router.post(
  "/bank/admin/users/:userId/transaction-pin/reset",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ResetAdminUserTransactionPinParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = ResetAdminUserTransactionPinBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const authenticatedClerkId = getAuth(req).userId;
    if (!authenticatedClerkId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(authenticatedClerkId)).id;
    const reason = generatedAdminAuditReason(req);
    const reset = await db.transaction(async (tx) => {
      const [target] = await tx
        .update(bankUsersTable)
        .set({
          transactionPinHash: null,
          transactionPinFailedAttempts: 0,
          transactionPinLockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(bankUsersTable.id, params.data.userId))
        .returning({ id: bankUsersTable.id });
      if (!target) return false;
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: target.id,
        action: "reset_transaction_pin",
        reason,
      });
      return true;
    });
    if (!reset) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    res.json(ResetAdminUserTransactionPinResponse.parse({ configured: false }));
  },
);


router.post(
  "/bank/admin/users/:userId/vault-passcode-reset",
  requireAdmin,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const userId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
    if (!userId || userId.length > 256 || req.body?.confirmed !== true) {
      res.status(400).json({ error: "Confirm the Private Vault passcode reset request." });
      return;
    }

    const authenticatedClerkId = getAuth(req).userId;
    if (!authenticatedClerkId) {
      res.status(401).json({ error: "Sign in to access administrative controls." });
      return;
    }
    if (authenticatedClerkId === userId) {
      res.status(400).json({ error: "Administrators cannot send themselves a customer reset link." });
      return;
    }

    const actorUserId = (await ensureBankUser(authenticatedClerkId)).id;
    const [target] = await db
      .select({ id: bankUsersTable.id })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, userId))
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "Customer account not found." });
      return;
    }

    let recipientEmail: string | undefined;
    try {
      const identity = await clerkClient.users.getUser(target.id);
      const primary = identity.emailAddresses.find(
        (email) => email.id === identity.primaryEmailAddressId,
      );
      if (primary?.verification?.status === "verified") {
        recipientEmail = primary.emailAddress;
      }
    } catch {
      recipientEmail = undefined;
    }
    if (!recipientEmail) {
      res.status(409).json({ error: "The customer has no verified primary email address. No reset link was sent." });
      return;
    }

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    const configuredOrigin =
      process.env.GLOBUS_APP_ORIGIN?.trim() ||
      process.env.REPLIT_DOMAINS?.split(",")[0]?.trim() ||
      process.env.REPLIT_DEV_DOMAIN?.trim() ||
      "www.global-internetbanking.globus.website";
    let resetUrl: URL;
    try {
      const originUrl = new URL(
        configuredOrigin.includes("://") ? configuredOrigin : `https://${configuredOrigin}`,
      );
      if (originUrl.protocol !== "https:") {
        throw new Error("Secure reset application origin is unavailable.");
      }
      resetUrl = new URL("/private-vault/reset-passcode", originUrl.origin);
      resetUrl.searchParams.set("token", rawToken);
    } catch {
      await db
        .insert(bankAuditLogsTable)
        .values({
          actorUserId,
          targetUserId: target.id,
          action: "private_vault_passcode_reset_email_failed",
          reason: "Secure sender or application-origin configuration was unavailable; no reset token was issued.",
        });
      res.status(503).json({ error: "Secure reset email configuration is unavailable. No reset link was sent." });
      return;
    }

    let failedOperation:
      | "invalidate_previous_tokens"
      | "insert_reset_token"
      | "insert_audit_log" = "invalidate_previous_tokens";
    try {
      await db.transaction(async (tx) => {
        failedOperation = "invalidate_previous_tokens";
        await tx
          .update(bankVaultPasscodeResetTokensTable)
          .set({ usedAt: now })
          .where(
            and(
              eq(bankVaultPasscodeResetTokensTable.userId, target.id),
              isNull(bankVaultPasscodeResetTokensTable.usedAt),
            ),
          );

        failedOperation = "insert_reset_token";
        await tx.insert(bankVaultPasscodeResetTokensTable).values({
          userId: target.id,
          tokenHash,
          expiresAt,
          requestedByUserId: actorUserId,
          createdAt: now,
        });

        failedOperation = "insert_audit_log";
        await tx.insert(bankAuditLogsTable).values({
          actorUserId,
          targetUserId: target.id,
          action: "request_private_vault_passcode_reset",
          reason: "Administrator issued a single-use Private Vault passcode reset link to the customer's verified primary email. Vault access status and entitlements were not modified.",
        });
      });
    } catch (error: unknown) {
      const diagnosticId = randomUUID();
      const dbError =
        typeof error === "object" && error !== null
          ? error as Record<string, unknown>
          : {};
      const rootCause =
        typeof dbError.cause === "object" && dbError.cause !== null
          ? dbError.cause as Record<string, unknown>
          : {};
      const rootCauseMessage =
        typeof rootCause.message === "string"
          ? rootCause.message
              .replace(/'[^']{1,300}'/g, "'[redacted]'")
              .replace(/(?:postgres(?:ql)?:\/\/)[^\s]+/gi, "[database-url-redacted]")
              .slice(0, 240)
          : undefined;
      const safeDiagnostic = {
        diagnosticId,
        operation: failedOperation,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage:
          error instanceof Error && !error.message.startsWith("Failed query:")
            ? error.message
                .replace(/'[^']{1,300}'/g, "'[redacted]'")
                .slice(0, 240)
            : undefined,
        causeName:
          typeof rootCause.name === "string" ? rootCause.name : undefined,
        causeCode:
          typeof rootCause.code === "string" ? rootCause.code : undefined,
        causeMessage: rootCauseMessage,
        code: typeof dbError.code === "string" ? dbError.code : undefined,
        constraint: typeof dbError.constraint === "string" ? dbError.constraint : undefined,
        table: typeof dbError.table === "string" ? dbError.table : undefined,
        column: typeof dbError.column === "string" ? dbError.column : undefined,
        schema: typeof dbError.schema === "string" ? dbError.schema : undefined,
      };
      console.error("[vault-passcode-reset] transaction failed", safeDiagnostic);
      res.status(503).json({
        error: "The reset request could not be recorded. No email was sent.",
        diagnosticId,
      });
      return;
    }

    let emailSent = false;
    try {
      const resendApiKey = process.env.RESEND_API_KEY?.trim();
      const senderAddress = process.env.GLOBUS_SECURITY_EMAIL_FROM?.trim() || "security@globus.website";
      if (!resendApiKey) throw new Error("Resend API key is not configured.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderAddress)) {
        throw new Error("The configured security sender address is invalid.");
      }
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `GLOBUS BANK Security <${senderAddress}>`,
          to: [recipientEmail],
          subject: "Reset your GLOBUS BANK Private Vault passcode",
          text: `A Private Vault passcode reset was requested for your account.\n\nUse this one-time link within 30 minutes:\n${resetUrl.toString()}\n\nIf you did not expect this email, contact GLOBUS BANK support. Resetting the passcode does not change your Private Vault access status.`,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!emailResponse.ok) {
        const errorBody = await emailResponse.text().catch(() => "");
        throw new Error(`Resend rejected the reset email (${emailResponse.status}): ${errorBody.slice(0, 500)}`);
      }
      emailSent = true;
    } catch (error) {
      req.log.error({ error }, "Resend could not deliver the Private Vault passcode reset email");
    }

    if (!emailSent) {
      await db
        .update(bankVaultPasscodeResetTokensTable)
        .set({ usedAt: new Date() })
        .where(eq(bankVaultPasscodeResetTokensTable.tokenHash, tokenHash));
      await db.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: target.id,
        action: "private_vault_passcode_reset_email_failed",
        reason: "Reset-link email delivery failed; the token was invalidated.",
      });
      res.status(503).json({ error: "The reset link could not be delivered. Request a new link after checking email delivery configuration." });
      return;
    }

    await db.insert(bankAuditLogsTable).values({
      actorUserId,
      targetUserId: target.id,
      action: "private_vault_passcode_reset_email_sent",
      reason: "Reset link sent to the verified primary email address; token expires in 30 minutes.",
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({ sent: true, expiresAt: expiresAt.toISOString() });
  },
);

router.post(
  "/bank/admin/users/:userId/password-reset",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ResetAdminUserPasswordParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = ResetAdminUserPasswordBody.safeParse(req.body);
    if (!parsed.success || parsed.data.confirmed !== true) {
      res.status(400).json({
        error: parsed.success ? "Confirm the password reset action." : parsed.error.message,
      });
      return;
    }
    const authenticatedClerkId = getAuth(req).userId;
    if (!authenticatedClerkId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    if (authenticatedClerkId === params.data.userId) {
      res.status(400).json({
        error: "Use the customer password recovery flow to reset your own password.",
      });
      return;
    }

    const actorUserId = (await ensureBankUser(authenticatedClerkId)).id;
    const [target] = await db
      .select({ id: bankUsersTable.id })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, params.data.userId))
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "User record not found." });
      return;
    }

    const reason = generatedAdminAuditReason(req);
    const requestedAt = new Date().toISOString();
    await db.insert(bankAuditLogsTable).values({
      actorUserId,
      targetUserId: target.id,
      action: "request_password_reset",
      reason,
    });

    let primaryEmail: string | undefined;
    try {
      const identity = await clerkClient.users.getUser(target.id);
      const primaryEmailAddress = identity.emailAddresses.find(
        (email) => email.id === identity.primaryEmailAddressId,
      );
      if (primaryEmailAddress?.verification?.status === "verified") {
        primaryEmail = primaryEmailAddress.emailAddress;
      }
      await clerkClient.users.updateUserMetadata(target.id, {
        publicMetadata: {
          globusPasswordResetRequiredAt: requestedAt,
        },
      });
      setPasswordResetCache(target.id, true);

      const sessions = [];
      let offset = 0;
      while (true) {
        const page = await clerkClient.sessions.getSessionList({
          userId: target.id,
          status: "active",
          limit: 500,
          offset,
        });
        sessions.push(...page.data);
        if (page.data.length < 500) break;
        offset += page.data.length;
      }

      let sessionsRevoked = 0;
      let revokeFailures = 0;
      for (let index = 0; index < sessions.length; index += 25) {
        const batch = sessions.slice(index, index + 25);
        const results = await Promise.allSettled(
          batch.map((session) => clerkClient.sessions.revokeSession(session.id)),
        );
        sessionsRevoked += results.filter((result) => result.status === "fulfilled").length;
        revokeFailures += results.filter((result) => result.status === "rejected").length;
      }

      await db.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: target.id,
        action: revokeFailures === 0
          ? "password_reset_required_sessions_revoked"
          : "password_reset_required_session_revocation_incomplete",
        reason,
      });

      if (revokeFailures > 0) {
        res.status(503).json({
          error: "The reset requirement is active, but not all sessions could be ended. Retry the action.",
        });
        return;
      }

      let emailSent = false;
      let signInTokenId: string | undefined;
      try {
        if (primaryEmail) {
          const token = await clerkClient.signInTokens.createSignInToken({
            userId: target.id,
            expiresInSeconds: 15 * 60,
          });
          signInTokenId = token.id;
          emailSent = await sendPasswordResetEmail({
            recipient: primaryEmail,
            ticket: token.token,
          });
        }
      } catch {
        emailSent = false;
      }
      if (!emailSent && signInTokenId) {
        await clerkClient.signInTokens
          .revokeSignInToken(signInTokenId)
          .catch(() => undefined);
      }

      await db.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: target.id,
        action: emailSent
          ? "password_reset_email_sent"
          : "password_reset_email_failed",
        reason: "Delivery status only.",
      });

      res.json(
        ResetAdminUserPasswordResponse.parse({
          resetRequired: true,
          sessionsRevoked,
          requestedAt,
          emailSent,
        }),
      );
    } catch {
      res.status(503).json({
        error: "The reset requirement could not be fully applied. Retry the action.",
      });
    }
  },
);

router.patch(
  "/bank/admin/users/:userId/status",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateAdminUserStatusParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateAdminUserStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const authenticatedClerkId = getAuth(req).userId;
    if (!authenticatedClerkId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(authenticatedClerkId)).id;
    if (params.data.userId === actorUserId) {
      res.status(400).json({ error: "Administrators cannot change their own account status." });
      return;
    }

    const reason = generatedAdminAuditReason(req);
    const result = await db.transaction(async (tx) => {
      const now = new Date();
      const [user] = await tx
        .update(bankUsersTable)
        .set({
          accountStatus: parsed.data.accountStatus,
          accountRestrictionReason:
            parsed.data.accountStatus === "restricted" ? reason : null,
          accountRestrictionNotes: null,
          accountRestrictedByUserId:
            parsed.data.accountStatus === "restricted" ? actorUserId : null,
          accountRestrictedAt:
            parsed.data.accountStatus === "restricted" ? now : null,
          updatedAt: new Date(),
        })
        .where(eq(bankUsersTable.id, params.data.userId))
        .returning();
      if (!user) {
        return null;
      }

      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: user.id,
        action:
          parsed.data.accountStatus === "suspended"
            ? "suspend_user"
            : parsed.data.accountStatus === "restricted"
              ? "restrict_user"
              : "restore_user",
        reason,
      });

      return user;
    });

    if (!result) {
      res.status(404).json({ error: "User record not found." });
      return;
    }

    const [walletCount] = await db
      .select({ value: count() })
      .from(bankWalletsTable)
      .where(eq(bankWalletsTable.userId, result.id));

    res.json(
      UpdateAdminUserStatusResponse.parse({
        id: result.id,
        email: result.email,
        accountTierName: getEffectiveAccountTier(result).name,
        accountTierSource: getEffectiveAccountTier(result).source,
        adminAccountTier: result.adminAccountTier,
        customerId: result.customerId,
        firstName: result.firstName,
        lastName: result.lastName,
        country: result.country,
        accountStatus: result.accountStatus,
        accountRestrictionReason: result.accountRestrictionReason,
        accountRestrictionNotes: result.accountRestrictionNotes,
        accountRestrictedAt: result.accountRestrictedAt?.toISOString() ?? null,
        profileSetupCompletedAt:
          result.profileSetupCompletedAt?.toISOString() ?? null,
        testingModeDisabled: result.testingModeDisabled,
        transferAccessGranted: result.transferAccessGranted,
        vaultSubscriptionStatus: vaultSubscriptionStatus(
          result.vaultSubscriptionStatus,
          result.vaultSubscriptionExpiresAt,
        ),
        vaultSubscriptionRequestedAt:
          result.vaultSubscriptionRequestedAt?.toISOString() ?? null,
        vaultSubscriptionExpiresAt:
          result.vaultSubscriptionExpiresAt?.toISOString() ?? null,
        vaultSubscriptionReason: result.vaultSubscriptionReason,
        vaultSubscriptionPlan: result.vaultSubscriptionPlan,
        vaultSubscriptionAmountMinor: result.vaultSubscriptionAmountMinor,
        vaultSubscriptionAutoRenew: result.vaultSubscriptionAutoRenew,
        walletCount: walletCount?.value ?? 0,
        createdAt: result.createdAt.toISOString(),
      }),
    );
  },
);

router.patch(
  "/bank/admin/users/:userId/profile",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateAdminUserProfileParams.safeParse(req.params);
    const parsed = UpdateAdminUserProfileBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid request.",
      });
      return;
    }
    if (
      typeof parsed.data.address === "string" &&
      /[\u0000-\u001f\u007f-\u009f]/u.test(parsed.data.address)
    ) {
      res.status(400).json({
        error: "Address cannot contain control characters.",
      });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const reason = generatedAdminAuditReason(req);
    const profileFields = {
      ...(parsed.data.firstName !== undefined
        ? { firstName: parsed.data.firstName?.trim() || null }
        : {}),
      ...(parsed.data.lastName !== undefined
        ? { lastName: parsed.data.lastName?.trim() || null }
        : {}),
      ...(parsed.data.address !== undefined
        ? { address: parsed.data.address?.trim() || null }
        : {}),
      ...(parsed.data.phone !== undefined
        ? { phone: parsed.data.phone?.trim() || null }
        : {}),
      ...(parsed.data.country !== undefined
        ? { country: parsed.data.country?.trim() || null }
        : {}),
      ...(parsed.data.cityOfOrigin !== undefined
        ? { cityOfOrigin: parsed.data.cityOfOrigin?.trim() || null }
        : {}),
      ...(parsed.data.dateOfBirth !== undefined
        ? { dateOfBirth: parsed.data.dateOfBirth || null }
        : {}),
      ...(parsed.data.occupation !== undefined
        ? { occupation: parsed.data.occupation?.trim() || null }
        : {}),
    };
    if (Object.keys(profileFields).length === 0) {
      res.status(400).json({
        error: "Change at least one permitted profile field.",
      });
      return;
    }
    const updated = await db.transaction(async (tx) => {
      const [user] = await tx
        .update(bankUsersTable)
        .set({ ...profileFields, updatedAt: new Date() })
        .where(eq(bankUsersTable.id, params.data.userId))
        .returning();
      if (!user) return null;
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: user.id,
        action: "update_member_profile",
        reason,
      });
      const [walletCount] = await tx
        .select({ value: count() })
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.userId, user.id));
      return { user, walletCount: Number(walletCount?.value ?? 0) };
    });
    if (!updated) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    res.json(
      UpdateAdminUserProfileResponse.parse({
        id: updated.user.id,
        email: updated.user.email,
        accountTierName: getEffectiveAccountTier(updated.user).name,
        accountTierSource: getEffectiveAccountTier(updated.user).source,
        adminAccountTier: updated.user.adminAccountTier,
        customerId: updated.user.customerId,
        firstName: updated.user.firstName,
        lastName: updated.user.lastName,
        address: updated.user.address,
        country: updated.user.country,
        accountStatus: updated.user.accountStatus,
        accountRestrictionReason: updated.user.accountRestrictionReason,
        accountRestrictionNotes: updated.user.accountRestrictionNotes,
        accountRestrictedAt:
          updated.user.accountRestrictedAt?.toISOString() ?? null,
        profileSetupCompletedAt:
          updated.user.profileSetupCompletedAt?.toISOString() ?? null,
        testingModeDisabled: updated.user.testingModeDisabled,
        transferAccessGranted: updated.user.transferAccessGranted,
        vaultSubscriptionStatus: vaultSubscriptionStatus(
          updated.user.vaultSubscriptionStatus,
          updated.user.vaultSubscriptionExpiresAt,
        ),
        vaultSubscriptionRequestedAt:
          updated.user.vaultSubscriptionRequestedAt?.toISOString() ?? null,
        vaultSubscriptionExpiresAt:
          updated.user.vaultSubscriptionExpiresAt?.toISOString() ?? null,
        vaultSubscriptionReason: updated.user.vaultSubscriptionReason,
        vaultSubscriptionPlan: updated.user.vaultSubscriptionPlan,
        vaultSubscriptionAmountMinor: updated.user.vaultSubscriptionAmountMinor,
        vaultSubscriptionAutoRenew: updated.user.vaultSubscriptionAutoRenew,
        walletCount: updated.walletCount,
        createdAt: updated.user.createdAt.toISOString(),
      }),
    );
  },
);

router.patch(
  "/bank/admin/users/:userId/account-tier",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = AssignAdminUserAccountTierParams.safeParse(req.params);
    const parsed = AssignAdminUserAccountTierBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid account-tier assignment.",
      });
      return;
    }
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access administrative controls." });
      return;
    }
    const actor = await ensureBankUser(authUserId);
    const pinResult = await verifyTransactionPin(
      actor.id,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }

    const reason = generatedAdminAuditReason(req);
    const updated = await db.transaction(async (tx) => {
      const [target] = await tx
        .select({ id: bankUsersTable.id })
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, params.data.userId))
        .for("update");
      if (!target) return null;
      const [user] = await tx
        .update(bankUsersTable)
        .set({
          adminAccountTier: parsed.data.adminAccountTier,
          updatedAt: new Date(),
        })
        .where(eq(bankUsersTable.id, target.id))
        .returning();
      if (!user) return null;
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: actor.id,
        targetUserId: user.id,
        action: "assign_customer_account_tier",
        reason,
      });
      return user;
    });
    if (!updated) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    const effectiveTier = getEffectiveAccountTier(updated);
    res.json(
      AssignAdminUserAccountTierResponse.parse({
        userId: updated.id,
        adminAccountTier: updated.adminAccountTier,
        accountTierName: effectiveTier.name,
        accountTierSource: effectiveTier.source,
      }),
    );
  },
);

router.patch(
  "/bank/admin/users/:userId/access-controls",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateAdminUserAccessControlsParams.safeParse(req.params);
    const parsed = UpdateAdminUserAccessControlsBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid access-control request.",
      });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access administrative controls." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [target] = await tx
        .select({ id: bankUsersTable.id })
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, params.data.userId))
        .for("update");
      if (!target) return null;
      const [updated] = await tx
        .update(bankUsersTable)
        .set({
          testingModeDisabled: parsed.data.testingModeDisabled,
          transferAccessGranted: parsed.data.transferAccessGranted,
          supportAccessGranted: parsed.data.supportAccessGranted,
          updatedAt: new Date(),
        })
        .where(eq(bankUsersTable.id, target.id))
        .returning({
          id: bankUsersTable.id,
          testingModeDisabled: bankUsersTable.testingModeDisabled,
          transferAccessGranted: bankUsersTable.transferAccessGranted,
          supportAccessGranted: bankUsersTable.supportAccessGranted,
        });
      if (!updated) return null;
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: updated.id,
        action: "update_customer_access_controls",
        reason: `${generatedAdminAuditReason(req)} Neither setting grants Private Vault access.`,
      });
      return updated;
    });
    if (!result) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    res.json(
      UpdateAdminUserAccessControlsResponse.parse({
        userId: result.id,
        testingModeDisabled: result.testingModeDisabled,
        transferAccessGranted: result.transferAccessGranted,
        supportAccessGranted: result.supportAccessGranted,
      }),
    );
  },
);

router.patch(
  "/bank/admin/users/:userId/vault-subscription",
  requireAdmin,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in with an administrator account." });
      return;
    }
    const params = UpdateAdminUserVaultSubscriptionParams.safeParse(req.params);
    const parsed = UpdateAdminUserVaultSubscriptionBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid subscription decision.",
      });
      return;
    }
    if (String(parsed.data.status) !== "inactive") {
      res.status(409).json({
        error: "Administrators cannot manually approve or reject Vault subscriptions. Only confirmed Paystack payments activate access.",
      });
      return;
    }
    const admin = await ensureBankUser(authUserId);
    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, params.data.userId))
        .for("update");
      if (!user) return { notFound: true as const };
      if (user.vaultSubscriptionAutoRenew) {
        return { recurringActive: true as const };
      }
      const now = new Date();
      const [updated] = await tx
        .update(bankUsersTable)
        .set({
          vaultSubscriptionStatus: "inactive",
          vaultSubscriptionReviewedAt: now,
          vaultSubscriptionReviewedByUserId: admin.id,
          vaultSubscriptionReason: generatedAdminAuditReason(req),
          vaultSubscriptionExpiresAt: null,
          vaultSubscriptionPlan: null,
          vaultSubscriptionAmountMinor: null,
          updatedAt: now,
        })
        .where(eq(bankUsersTable.id, user.id))
        .returning();
      await tx
        .delete(bankVaultSessionsTable)
        .where(eq(bankVaultSessionsTable.userId, user.id));
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: admin.id,
        targetUserId: user.id,
        action: "revoke_private_vault_subscription",
        reason: generatedAdminAuditReason(req),
      });
      return { user: updated };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    if ("recurringActive" in result) {
      res.status(409).json({
        error: "The member must cancel Paystack renewal before an administrator can remove Vault access.",
      });
      return;
    }
    res.json(
      UpdateAdminUserVaultSubscriptionResponse.parse({
        userId: result.user.id,
        status: vaultSubscriptionStatus(
          result.user.vaultSubscriptionStatus,
          result.user.vaultSubscriptionExpiresAt,
        ),
        expiresAt: result.user.vaultSubscriptionExpiresAt?.toISOString() ?? null,
      }),
    );
  },
);

router.get(
  "/bank/admin/users/:userId/vault-subscription/proof",
  requireAdmin,
  (_req, res): void => {
    res.status(410).json({
      error: "Manual subscription proof review is disabled. Paystack confirmation controls Vault activation.",
    });
  },
);

router.post(
  "/bank/admin/users/:userId/funding",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = CreateAdminFundingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = CreateAdminFundingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (
      parsed.data.transactionDate &&
      !isIsoCalendarDate(parsed.data.transactionDate)
    ) {
      res.status(400).json({ error: "Enter a valid customer transaction date." });
      return;
    }

    const authenticatedClerkId = getAuth(req).userId;
    if (!authenticatedClerkId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(authenticatedClerkId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }

    const reason = generatedAdminAuditReason(req);
    const senderName = parsed.data.senderName.trim();
    const description = parsed.data.description.trim();
    if (!senderName || !description) {
      res.status(400).json({ error: "Enter a sender name and transaction description." });
      return;
    }

    let amountMinor: bigint;
    try {
      amountMinor = parseAmountToMinor(parsed.data.amount);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Enter a valid funding amount.",
      });
      return;
    }

    const settings = await getOrCreateAdminSettings();
    const fundingLimitMinor = parseAmountToMinor(settings.fundingLimit);
    const secondApprovalThresholdMinor = parseAmountToMinor(
      settings.secondApprovalThreshold,
    );
    if (amountMinor <= 0n || amountMinor > fundingLimitMinor) {
      res.status(400).json({
        error: `Funding must be greater than zero and no more than ${settings.fundingLimit}.`,
      });
      return;
    }
    const requiresSecondApproval = amountMinor >= secondApprovalThresholdMinor;

    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${parsed.data.idempotencyKey})::bigint)`,
      );

      const [duplicate] = await tx
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.idempotencyKey, parsed.data.idempotencyKey))
        .limit(1);
      if (duplicate) {
        const sameRequest =
          duplicate.initiatedByUserId === actorUserId &&
          (parsed.data.direction === "credit"
            ? duplicate.toUserId === params.data.userId &&
              duplicate.fromUserId === null
            : duplicate.fromUserId === params.data.userId &&
              duplicate.toUserId === null) &&
          duplicate.type === "admin_funding" &&
          duplicate.currency === parsed.data.currency &&
          duplicate.amountMinor === amountMinor &&
          duplicate.transactionDate === (parsed.data.transactionDate ?? null) &&
          duplicate.counterparty === senderName &&
          duplicate.description === description &&
          duplicate.adminReference === (parsed.data.internalReference?.trim() || null) &&
          duplicate.adminNotes === null;
        return sameRequest
          ? { transaction: duplicate }
          : { error: "That request reference is already in use." };
      }

      const [target] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, params.data.userId))
        .for("update");
      if (!target) {
        return { notFound: true as const };
      }
      if (target.accountStatus !== "active") {
        return { error: "Only active user accounts can receive balance adjustments." };
      }

      const wallet = await userWallet(tx, target.id, parsed.data.currency);
      if (
        !wallet ||
        (parsed.data.direction === "debit" && wallet.status !== "active")
      ) {
        return {
          error:
            parsed.data.direction === "debit"
              ? "A frozen wallet cannot be debited."
              : "A wallet for the selected currency is unavailable.",
        };
      }
      const restrictionError = await bankOperationRestrictionError(tx, {
        userId: target.id,
        walletId: wallet.id,
        operation:
          parsed.data.direction === "credit" ? "admin_credit" : "admin_debit",
      });
      if (restrictionError) return { error: restrictionError };
      await tx
        .select({ id: bankWalletsTable.id })
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, wallet.id))
        .for("update");
      if (parsed.data.direction === "debit") {
        const balance = await balanceForWallet(tx, wallet.id);
        const reserved = await reservedForWallet(tx, wallet.id);
        if (balance - reserved < amountMinor) {
          return { error: "The adjustment exceeds the member's available ledger balance." };
        }
      }

      const [transaction] = await tx
        .insert(bankTransactionsTable)
        .values(withCustomerReceiptTemplate({
          reference: createReference(),
          idempotencyKey: parsed.data.idempotencyKey,
          initiatedByUserId: actorUserId,
          fromUserId: parsed.data.direction === "debit" ? target.id : null,
          toUserId: parsed.data.direction === "credit" ? target.id : null,
          fromWalletId: parsed.data.direction === "debit" ? wallet.id : null,
          toWalletId: parsed.data.direction === "credit" ? wallet.id : null,
          type: "admin_funding",
          status: requiresSecondApproval ? "pending" : "completed",
          currency: parsed.data.currency,
          amountMinor,
          feeMinor: 0n,
          counterparty: senderName,
          description,
          adminReference: parsed.data.internalReference?.trim() || null,
          adminNotes: null,
          mode: "internal_ledger",
          transactionDate: parsed.data.transactionDate ?? null,
        }, target.preferredReceiptTemplate))
        .returning();

      if (!requiresSecondApproval) {
        await tx.insert(bankLedgerEntriesTable).values([
          {
            transactionId: transaction.id,
            accountCode: `internal:balance-adjustment:${parsed.data.currency}`,
            currency: parsed.data.currency,
            side: parsed.data.direction === "credit" ? "debit" : "credit",
            amountMinor,
          },
          {
            transactionId: transaction.id,
            walletId: wallet.id,
            accountCode: `wallet:${wallet.id}`,
            currency: parsed.data.currency,
            side: parsed.data.direction === "credit" ? "credit" : "debit",
            amountMinor,
          },
        ]);
      }

      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: target.id,
        action: requiresSecondApproval
          ? "request_admin_funding"
          : "adjust_user_balance",
        reason: `${requiresSecondApproval ? "Awaiting second-admin approval. " : ""}${parsed.data.direction} ${formatMinorAmount(amountMinor)} ${parsed.data.currency}${parsed.data.transactionDate ? `, customer transaction date ${parsed.data.transactionDate}` : ""}: ${reason}`,
      });

      return { transaction };
    });

    if ("notFound" in result) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }

    res.status(201).json(
      CreateAdminFundingResponse.parse(
        toBankTransaction(result.transaction, params.data.userId),
      ),
    );
  },
);

router.post(
  "/bank/admin/transactions/:transactionId/funding-review",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ReviewAdminFundingParams.safeParse(req.params);
    const parsed = ReviewAdminFundingBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid request.",
      });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const reason = generatedAdminAuditReason(req);
    const result = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.id, params.data.transactionId))
        .for("update");
      if (!transaction) return { notFound: true as const };
      if (
        (transaction.type !== "admin_funding" &&
          transaction.type !== "admin_adjustment") ||
        transaction.status !== "pending"
      ) {
        return { error: "This adjustment is not awaiting a second-admin decision." };
      }
      if (transaction.initiatedByUserId === actorUserId) {
        return { error: "A different administrator must review this funding request." };
      }
      const walletId = transaction.fromWalletId ?? transaction.toWalletId;
      if (!walletId) {
        return { error: "The funding request does not reference a wallet." };
      }
      const targetUserId = transaction.fromUserId ?? transaction.toUserId;
      if (!targetUserId) {
        return { error: "The funding request is missing its target customer." };
      }
      const [target] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, targetUserId))
        .for("update");
      const [wallet] = await tx
        .select()
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, walletId))
        .for("update");
      if (!wallet || !target) {
        return { error: "The funding wallet or customer account is unavailable." };
      }
      const isDebit = Boolean(transaction.fromWalletId);
      if (target.accountStatus !== "active") {
        return { error: "Funding cannot be approved for a restricted or suspended account." };
      }
      if (parsed.data.decision === "approve") {
        const restrictionError = await bankOperationRestrictionError(tx, {
          userId: target.id,
          walletId: wallet.id,
          operation: isDebit ? "admin_debit" : "admin_credit",
        });
        if (restrictionError) return { error: restrictionError };
      }
      if (isDebit && wallet.status !== "active") {
        return { error: "A frozen wallet cannot be debited." };
      }
      if (parsed.data.decision === "approve" && isDebit) {
        const balance = await balanceForWallet(tx, wallet.id);
        const allReserved = await reservedForWallet(tx, wallet.id);
        const otherReserved = allReserved - transaction.amountMinor;
        if (otherReserved < 0n || balance - otherReserved < transaction.amountMinor) {
          return { error: "The reserved balance is no longer available for this adjustment." };
        }
      }
      if (parsed.data.decision === "approve") {
        await tx.insert(bankLedgerEntriesTable).values([
          {
            transactionId: transaction.id,
            accountCode: `internal:balance-adjustment:${transaction.currency}`,
            currency: transaction.currency,
            side: isDebit ? "credit" : "debit",
            amountMinor: transaction.amountMinor,
          },
          {
            transactionId: transaction.id,
            walletId: wallet.id,
            accountCode: `wallet:${wallet.id}`,
            currency: transaction.currency,
            side: isDebit ? "debit" : "credit",
            amountMinor: transaction.amountMinor,
          },
        ]);
      }
      const [updated] = await tx
        .update(bankTransactionsTable)
        .set({
          status: parsed.data.decision === "approve" ? "completed" : "failed",
        })
        .where(eq(bankTransactionsTable.id, transaction.id))
        .returning();
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId,
        action:
          transaction.type === "admin_adjustment"
            ? parsed.data.decision === "approve"
              ? "approve_admin_adjustment"
              : "reject_admin_adjustment"
            : parsed.data.decision === "approve"
              ? "approve_admin_funding"
              : "reject_admin_funding",
        reason: `Funding ${transaction.reference}: ${parsed.data.decision}. ${reason}`,
      });
      return { transaction: updated, targetUserId };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "Funding request not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json(
      ReviewAdminFundingResponse.parse(
        toBankTransaction(result.transaction, result.targetUserId),
      ),
    );
  },
);

router.get(
  "/bank/admin/ledger-requests",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = ListAdminLedgerRequestsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const rows = await db
      .select({
        request: bankSandboxRequestsTable,
        transaction: bankTransactionsTable,
        user: bankUsersTable,
      })
      .from(bankSandboxRequestsTable)
      .innerJoin(
        bankTransactionsTable,
        eq(bankSandboxRequestsTable.transactionId, bankTransactionsTable.id),
      )
      .innerJoin(
        bankUsersTable,
        eq(bankSandboxRequestsTable.userId, bankUsersTable.id),
      )
      .where(
        and(
          inArray(bankSandboxRequestsTable.status, [
            "pending_review",
            "pending_provider_setup",
          ]),
          eq(bankSandboxRequestsTable.type, "withdrawal"),
          ...(parsed.data.userId
            ? [eq(bankSandboxRequestsTable.userId, parsed.data.userId)]
            : []),
        ),
      )
      .orderBy(desc(bankSandboxRequestsTable.createdAt))
      .limit(100);

    res.json(
      ListAdminLedgerRequestsResponse.parse(
        rows.map(({ request, transaction, user }) => ({
          id: request.id,
          transactionId: transaction.id,
          reference: request.reference,
          userId: user.id,
          memberName:
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            "Globus member",
          email: user.email,
          type: request.type,
          currency: request.currency,
          amount: formatMinorAmount(request.amountMinor),
          description: transaction.description,
          ...(request.paymentMethod ? { paymentMethod: request.paymentMethod } : {}),
          ...(request.paymentMethodSummary
            ? { paymentMethodSummary: request.paymentMethodSummary }
            : {}),
          status:
            request.status === "pending_provider_setup"
              ? "pending_review"
              : request.status,
          createdAt: request.createdAt.toISOString(),
        })),
      ),
    );
  },
);

router.patch(
  "/bank/admin/ledger-requests/:requestId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ReviewAdminLedgerRequestParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = ReviewAdminLedgerRequestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const authenticatedClerkId = getAuth(req).userId;
    if (!authenticatedClerkId) {
      res.status(401).json({ error: "Sign in to access operations." });
      return;
    }
    const actorUserId = (await ensureBankUser(authenticatedClerkId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const reason = generatedAdminAuditReason(req);

    const result = await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(bankSandboxRequestsTable)
        .where(eq(bankSandboxRequestsTable.id, params.data.requestId))
        .for("update");
      if (!request) return { notFound: true as const };
      if (request.type === "deposit") {
        return {
          error:
            "Deposit requests are no longer reviewed by administrators. Active Private Vault subscribers receive wallet credits when a new request passes validation.",
        };
      }
      if (request.type !== "withdrawal") {
        return { error: "Only withdrawal requests can be reviewed here." };
      }
      if (
        request.status !== "pending_review" &&
        request.status !== "pending_provider_setup"
      ) {
        return { error: "This request has already been reviewed." };
      }

      const [transaction] = await tx
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.id, request.transactionId))
        .for("update");
      if (!transaction) return { notFound: true as const };
      const [target] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, request.userId))
        .for("update");
      if (!target) return { notFound: true as const };
      if (parsed.data.decision === "approve" && target.accountStatus !== "active") {
        return { error: "Only active accounts can receive approved ledger requests." };
      }
      if (
        parsed.data.decision === "approve" &&
        !(await hasActiveVaultAccess(target, tx))
      ) {
        return {
          error:
            "An active Private Vault subscription is required before this deposit or withdrawal can be completed.",
        };
      }

      const savedWallet = transaction.fromWalletId;
      const wallet = savedWallet
        ? (
            await tx
              .select()
              .from(bankWalletsTable)
              .where(eq(bankWalletsTable.id, savedWallet))
              .limit(1)
          )[0]
        : await userWallet(tx, target.id, request.currency);
      if (
        !wallet ||
        wallet.status !== "active"
      ) {
        return {
          error: "A frozen wallet cannot be used for a withdrawal.",
        };
      }
      if (parsed.data.decision === "approve") {
        const restrictionError = await bankOperationRestrictionError(tx, {
          userId: target.id,
          walletId: wallet.id,
          operation: request.type,
        });
        if (restrictionError) return { error: restrictionError };
      }
      await tx
        .select({ id: bankWalletsTable.id })
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, wallet.id))
        .for("update");

      if (parsed.data.decision === "approve") {
        const balance = await balanceForWallet(tx, wallet.id);
        const reserved = await reservedForWallet(tx, wallet.id);
        if (balance < request.amountMinor || balance < reserved) {
          return {
            error:
              "The reserved ledger balance is no longer available. Resolve other balance changes before approving.",
          };
        }

        await tx.insert(bankLedgerEntriesTable).values([
          {
            transactionId: transaction.id,
            walletId: wallet.id,
            accountCode: `wallet:${wallet.id}`,
            currency: request.currency,
            side: "debit",
            amountMinor: request.amountMinor,
          },
          {
            transactionId: transaction.id,
            accountCode: `internal:withdrawal:${request.currency}`,
            currency: request.currency,
            side: "credit",
            amountMinor: request.amountMinor,
          },
        ]);
      }

      const requestStatus =
        parsed.data.decision === "approve" ? "approved" : "rejected";
      const [updatedRequest] = await tx
        .update(bankSandboxRequestsTable)
        .set({ status: requestStatus })
        .where(eq(bankSandboxRequestsTable.id, request.id))
        .returning();
      const [updatedTransaction] = await tx
        .update(bankTransactionsTable)
        .set({
          status: parsed.data.decision === "approve" ? "completed" : "failed",
          fromWalletId: wallet.id,
        })
        .where(eq(bankTransactionsTable.id, transaction.id))
        .returning();
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: target.id,
        action:
          parsed.data.decision === "approve"
            ? "approve_ledger_request"
            : "reject_ledger_request",
        reason: `${request.type} ${request.reference}: ${parsed.data.decision}. ${reason}`,
      });
      return {
        request: updatedRequest,
        transaction: updatedTransaction,
        user: target,
      };
    });

    if ("notFound" in result) {
      res.status(404).json({ error: "Ledger request not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json(
      ReviewAdminLedgerRequestResponse.parse({
        id: result.request.id,
        transactionId: result.transaction.id,
        reference: result.request.reference,
        userId: result.user.id,
        memberName:
          [result.user.firstName, result.user.lastName].filter(Boolean).join(" ") ||
          "Globus member",
        email: result.user.email,
        type: result.request.type,
        currency: result.request.currency,
        amount: formatMinorAmount(result.request.amountMinor),
        description: result.transaction.description,
        status: result.request.status,
        createdAt: result.request.createdAt.toISOString(),
      }),
    );
  },
);

router.get(
  "/bank/admin/transactions",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = ListAdminTransactionsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const page = parsed.data.page ?? 1;
    const pageSize = parsed.data.pageSize ?? 25;
    const filters = [];
    const search = parsed.data.search?.trim();
    const customer = parsed.data.customer?.trim();
    if (search) {
      const needle = `%${search}%`;
      filters.push(
        or(
          ilike(bankTransactionsTable.reference, needle),
          ilike(bankTransactionsTable.description, needle),
          ilike(bankTransactionsTable.counterparty, needle),
          sql`(${bankTransactionsTable.fromUserId} in (select id from bank_users where email ilike ${needle} or customer_id ilike ${needle} or first_name ilike ${needle} or last_name ilike ${needle}) or ${bankTransactionsTable.toUserId} in (select id from bank_users where email ilike ${needle} or customer_id ilike ${needle} or first_name ilike ${needle} or last_name ilike ${needle}))`,
        ),
      );
    }
    if (customer) {
      const needle = `%${customer}%`;
      filters.push(
        sql`(${bankTransactionsTable.fromUserId} in (select id from bank_users where email ilike ${needle} or customer_id ilike ${needle} or id ilike ${needle} or first_name ilike ${needle} or last_name ilike ${needle}) or ${bankTransactionsTable.toUserId} in (select id from bank_users where email ilike ${needle} or customer_id ilike ${needle} or id ilike ${needle} or first_name ilike ${needle} or last_name ilike ${needle}))`,
      );
    }
    if (parsed.data.currency) {
      filters.push(eq(bankTransactionsTable.currency, parsed.data.currency));
    }
    if (parsed.data.status) {
      filters.push(eq(bankTransactionsTable.status, parsed.data.status));
    }
    const type = parsed.data.type;
    if (type === "transfer_in" || type === "transfer_out") {
      filters.push(eq(bankTransactionsTable.type, "transfer"));
      filters.push(
        type === "transfer_in"
          ? sql`${bankTransactionsTable.toUserId} is not null`
          : sql`${bankTransactionsTable.fromUserId} is not null`,
      );
    } else if (type === "admin_debit") {
      filters.push(eq(bankTransactionsTable.type, "admin_funding"));
      filters.push(sql`${bankTransactionsTable.fromUserId} is not null`);
    } else if (type === "admin_funding") {
      filters.push(eq(bankTransactionsTable.type, "admin_funding"));
      filters.push(sql`${bankTransactionsTable.toUserId} is not null`);
    } else if (type === "simulation_credit") {
      filters.push(
        or(
          eq(bankTransactionsTable.type, "simulation_credit"),
          eq(bankTransactionsTable.type, "sandbox_credit"),
        ),
      );
    } else if (type) {
      filters.push(eq(bankTransactionsTable.type, type));
    }
    if (parsed.data.fromDate) {
      filters.push(
        sql`coalesce(${bankTransactionsTable.transactionDate}, (${bankTransactionsTable.createdAt} at time zone 'UTC')::date) >= ${parsed.data.fromDate}::date`,
      );
    }
    if (parsed.data.toDate) {
      filters.push(
        sql`coalesce(${bankTransactionsTable.transactionDate}, (${bankTransactionsTable.createdAt} at time zone 'UTC')::date) <= ${parsed.data.toDate}::date`,
      );
    }
    if (parsed.data.minimumAmount) {
      filters.push(
        gte(
          bankTransactionsTable.amountMinor,
          parseAmountToMinor(parsed.data.minimumAmount),
        ),
      );
    }
    if (parsed.data.maximumAmount) {
      filters.push(
        lte(
          bankTransactionsTable.amountMinor,
          parseAmountToMinor(parsed.data.maximumAmount),
        ),
      );
    }
    const where = filters.length ? and(...filters) : undefined;
    const [totalRows] = await db
      .select({ value: count() })
      .from(bankTransactionsTable)
      .where(where);
    const transactions = await db
      .select()
      .from(bankTransactionsTable)
      .where(where)
      .orderBy(desc(bankTransactionsTable.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    res.json(
      ListAdminTransactionsResponse.parse({
        items: transactions.map((transaction) =>
          toBankTransaction(
            transaction,
            transaction.fromUserId ?? transaction.toUserId ?? "",
          ),
        ),
        total: Number(totalRows?.value ?? 0),
        page,
        pageSize,
      }),
    );
  },
);

router.get(
  "/bank/admin/transactions/:transactionId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = GetAdminTransactionDetailParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [transaction] = await db
      .select()
      .from(bankTransactionsTable)
      .where(eq(bankTransactionsTable.id, params.data.transactionId))
      .limit(1);
    if (!transaction) {
      res.status(404).json({ error: "Transaction not found." });
      return;
    }
    const [initiator] = await db
      .select()
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, transaction.initiatedByUserId))
      .limit(1);
    const customerId = transaction.fromUserId ?? transaction.toUserId;
    const [customer] = customerId
      ? await db
          .select()
          .from(bankUsersTable)
          .where(eq(bankUsersTable.id, customerId))
          .limit(1)
      : [];
    const entries = await db
      .select()
      .from(bankLedgerEntriesTable)
      .where(eq(bankLedgerEntriesTable.transactionId, transaction.id))
      .orderBy(asc(bankLedgerEntriesTable.createdAt));
    res.json(
      GetAdminTransactionDetailResponse.parse({
        transaction: toBankTransaction(
          transaction,
          transaction.fromUserId ?? transaction.toUserId ?? "",
        ),
        initiatorName:
          [initiator?.firstName, initiator?.lastName].filter(Boolean).join(" ") ||
          initiator?.email ||
          "Unknown administrator",
        initiatorEmail: initiator?.email ?? "unknown@invalid.local",
        customerName:
          [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") ||
          customer?.email ||
          "Internal ledger",
        customerEmail: customer?.email ?? "unknown@invalid.local",
        ledgerEntries: entries.map((entry) => ({
          id: entry.id,
          walletId: entry.walletId,
          accountCode: entry.accountCode,
          currency: entry.currency,
          side: entry.side,
          amount: formatMinorAmount(entry.amountMinor),
          createdAt: entry.createdAt.toISOString(),
        })),
        correctionOfTransactionId: transaction.correctionOfTransactionId,
        reversalOfTransactionId: transaction.reversalOfTransactionId,
        correctionReason: transaction.correctionReason,
        adminReference: transaction.adminReference,
        adminNotes: transaction.adminNotes,
        statusHistory: [],
      }),
    );
  },
);

router.post(
  "/bank/admin/transactions/:transactionId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = CreateAdminTransactionCorrectionParams.safeParse(req.params);
    const parsed = CreateAdminTransactionCorrectionBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid request.",
      });
      return;
    }
    if (
      parsed.data.transactionDate &&
      !isIsoCalendarDate(parsed.data.transactionDate)
    ) {
      res.status(400).json({ error: "Enter a real transaction calendar date." });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const reason = generatedAdminAuditReason(req);
    let adjustmentMinor: bigint | null = null;
    if (parsed.data.kind === "adjustment") {
      if (!parsed.data.walletId || !parsed.data.direction || !parsed.data.amount) {
        res.status(400).json({
          error: "Choose an original transaction wallet, adjustment direction, and amount.",
        });
        return;
      }
      try {
        adjustmentMinor = parseAmountToMinor(parsed.data.amount);
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : "Enter a valid amount.",
        });
        return;
      }
      if (adjustmentMinor <= 0n) {
        res.status(400).json({ error: "Adjustment amount must be greater than zero." });
        return;
      }
    }
    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${parsed.data.idempotencyKey})::bigint)`,
      );
      const [duplicate] = await tx
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.idempotencyKey, parsed.data.idempotencyKey))
        .limit(1);
      if (duplicate) {
        return duplicate.correctionOfTransactionId === params.data.transactionId &&
          duplicate.initiatedByUserId === actorUserId
          ? { transaction: duplicate }
          : { error: "That correction reference is already in use." };
      }
      const [original] = await tx
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.id, params.data.transactionId))
        .for("update");
      if (!original) return { notFound: true as const };
      if (original.status !== "completed") {
        return { error: "Only a completed transaction with posted ledger entries can be corrected." };
      }
      const originalEntries = await tx
        .select()
        .from(bankLedgerEntriesTable)
        .where(eq(bankLedgerEntriesTable.transactionId, original.id));
      if (originalEntries.length === 0) {
        return { error: "This record has no posted ledger entries to correct." };
      }
      const walletIds = [
        ...new Set(
          originalEntries.flatMap((entry) => (entry.walletId ? [entry.walletId] : [])),
        ),
      ].sort();

      if (parsed.data.kind === "reversal") {
        if (walletIds.length) {
          await tx
            .select({ id: bankWalletsTable.id })
            .from(bankWalletsTable)
            .where(inArray(bankWalletsTable.id, walletIds))
            .orderBy(asc(bankWalletsTable.id))
            .for("update");
        }
        const [priorReversal] = await tx
          .select({ id: bankTransactionsTable.id })
          .from(bankTransactionsTable)
          .where(eq(bankTransactionsTable.reversalOfTransactionId, original.id))
          .limit(1);
        if (priorReversal) {
          return { error: "This transaction already has a recorded reversal." };
        }
        const debitByWallet = new Map<string, bigint>();
        for (const entry of originalEntries) {
          if (entry.walletId && entry.side === "credit") {
            debitByWallet.set(
              entry.walletId,
              (debitByWallet.get(entry.walletId) ?? 0n) + entry.amountMinor,
            );
          }
        }
        for (const [walletId, debitAmount] of debitByWallet) {
          const balance = await balanceForWallet(tx, walletId);
          const reserved = await reservedForWallet(tx, walletId);
          if (balance - debitAmount < reserved) {
            return {
              error:
                "This transaction's credited balance has already been spent or reserved. Resolve later activity before reversal.",
            };
          }
        }
        const [reversal] = await tx
          .insert(bankTransactionsTable)
          .values(withCustomerReceiptTemplate({
            reference: createReference(),
            idempotencyKey: parsed.data.idempotencyKey,
            initiatedByUserId: actorUserId,
            fromUserId: original.toUserId,
            toUserId: original.fromUserId,
            fromWalletId: original.toWalletId,
            toWalletId: original.fromWalletId,
            type: "reversal",
            status: "completed",
            currency: original.currency,
            amountMinor: original.amountMinor,
            feeMinor: original.feeMinor,
            counterparty: original.reference,
            description: `Reversal of ${original.reference}`,
            correctionOfTransactionId: original.id,
            reversalOfTransactionId: original.id,
            correctionReason: reason,
            mode: "internal_ledger",
            transactionDate: parsed.data.transactionDate ?? null,
          }, original.receiptTemplate))
          .returning();
        await tx.insert(bankLedgerEntriesTable).values(
          originalEntries.map((entry) => ({
            transactionId: reversal.id,
            walletId: entry.walletId,
            accountCode: entry.accountCode,
            currency: entry.currency,
            side: entry.side === "credit" ? "debit" : "credit",
            amountMinor: entry.amountMinor,
          })),
        );
        await tx
          .update(bankTransactionsTable)
          .set({ status: "reversed" })
          .where(eq(bankTransactionsTable.id, original.id));
        const targetUserId =
          original.fromUserId ?? original.toUserId ?? actorUserId;
        await tx.insert(bankAuditLogsTable).values({
          actorUserId,
          targetUserId,
          action: "reverse_transaction",
          reason: `Transaction ${original.reference} reversed by ${reversal.reference}. ${reason}`,
        });
        return { transaction: reversal };
      }

      if (!parsed.data.walletId || !parsed.data.direction || !adjustmentMinor) {
        return { error: "An adjustment wallet, direction, and amount are required." };
      }
      const walletEntry = originalEntries.find(
        (entry) => entry.walletId === parsed.data.walletId,
      );
      if (!walletEntry) {
        return { error: "Choose a wallet affected by the original transaction." };
      }
      const correctionSettings = await getOrCreateAdminSettings();
      const correctionLimitMinor = parseAmountToMinor(
        correctionSettings.fundingLimit,
      );
      const correctionApprovalThreshold = parseAmountToMinor(
        correctionSettings.secondApprovalThreshold,
      );
      if (adjustmentMinor > correctionLimitMinor) {
        return { error: "Adjustment exceeds the configured per-currency funding cap." };
      }
      const requiresSecondApproval =
        adjustmentMinor >= correctionApprovalThreshold;
      const [walletSnapshot] = await tx
        .select()
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, parsed.data.walletId))
        .limit(1);
      const [target] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, walletSnapshot?.userId ?? ""))
        .for("update");
      const [wallet] = walletSnapshot
        ? await tx
            .select()
            .from(bankWalletsTable)
            .where(eq(bankWalletsTable.id, walletSnapshot.id))
            .for("update")
        : [];
      if (!wallet) return { error: "The affected wallet is unavailable." };
      if (!target || target.accountStatus !== "active") {
        return { error: "Only active customer accounts can receive adjustments." };
      }
      const restrictionError = await bankOperationRestrictionError(tx, {
        userId: target.id,
        walletId: wallet.id,
        operation: parsed.data.direction === "debit" ? "admin_debit" : "admin_credit",
      });
      if (restrictionError) return { error: restrictionError };
      if (parsed.data.direction === "debit") {
        if (wallet.status !== "active") {
          return { error: "A frozen wallet cannot be debited." };
        }
        const balance = await balanceForWallet(tx, wallet.id);
        const reserved = await reservedForWallet(tx, wallet.id);
        if (balance - reserved < adjustmentMinor) {
          return { error: "The adjustment exceeds the available wallet balance." };
        }
      }
      const isCredit = parsed.data.direction === "credit";
      const [adjustment] = await tx
        .insert(bankTransactionsTable)
        .values(withCustomerReceiptTemplate({
          reference: createReference(),
          idempotencyKey: parsed.data.idempotencyKey,
          initiatedByUserId: actorUserId,
          fromUserId: isCredit ? null : target.id,
          toUserId: isCredit ? target.id : null,
          fromWalletId: isCredit ? null : wallet.id,
          toWalletId: isCredit ? wallet.id : null,
          type: "admin_adjustment",
          status: requiresSecondApproval ? "pending" : "completed",
          currency: wallet.currency,
          amountMinor: adjustmentMinor,
          feeMinor: 0n,
          counterparty: original.reference,
          description: `Adjustment for ${original.reference}`,
          correctionOfTransactionId: original.id,
          correctionReason: reason,
          mode: "internal_ledger",
          transactionDate: parsed.data.transactionDate ?? null,
        }, target.preferredReceiptTemplate))
        .returning();
      if (!requiresSecondApproval) {
        await tx.insert(bankLedgerEntriesTable).values([
          {
            transactionId: adjustment.id,
            accountCode: `internal:balance-adjustment:${wallet.currency}`,
            currency: wallet.currency,
            side: isCredit ? "debit" : "credit",
            amountMinor: adjustmentMinor,
          },
          {
            transactionId: adjustment.id,
            walletId: wallet.id,
            accountCode: `wallet:${wallet.id}`,
            currency: wallet.currency,
            side: isCredit ? "credit" : "debit",
            amountMinor: adjustmentMinor,
          },
        ]);
      }
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: target.id,
        action: requiresSecondApproval
          ? "request_admin_adjustment"
          : "adjust_transaction",
        reason: `${requiresSecondApproval ? "Awaiting second-admin approval. " : ""}Adjustment ${adjustment.reference} references transaction ${original.reference}: ${parsed.data.direction} ${formatMinorAmount(adjustmentMinor)} ${wallet.currency}${parsed.data.transactionDate ? `, customer transaction date ${parsed.data.transactionDate}` : ""}. ${reason}`,
      });
      return { transaction: adjustment };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "Original transaction not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.status(201).json(
      CreateAdminTransactionCorrectionResponse.parse(
        toBankTransaction(
          result.transaction,
          result.transaction.fromUserId ??
            result.transaction.toUserId ??
            actorUserId,
        ),
      ),
    );
  },
);

router.get("/bank/admin/ledger", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListAdminLedgerQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(bankTransactionsTable)
    .where(
      parsed.data.currency
        ? eq(bankTransactionsTable.currency, parsed.data.currency)
        : undefined,
    )
    .orderBy(desc(bankTransactionsTable.createdAt))
    .limit(parsed.data.limit ?? 50);

  res.json(
    ListAdminLedgerResponse.parse(
      rows.map((transaction) =>
        toBankTransaction(
          transaction,
          transaction.fromUserId ?? transaction.toUserId ?? "",
        ),
      ),
    ),
  );
});

router.get(
  "/bank/admin/transactions/:transactionId/status-history",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ListAdminTransactionStatusHistoryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [transaction] = await db
      .select({
        id: bankTransactionsTable.id,
        reference: bankTransactionsTable.reference,
      })
      .from(bankTransactionsTable)
      .where(eq(bankTransactionsTable.id, params.data.transactionId));
    if (!transaction) {
      res.status(404).json({ error: "Transaction not found." });
      return;
    }

    const reasonPrefix = `Transaction ${transaction.reference}: `;
    const auditRows = await db
      .select()
      .from(bankAuditLogsTable)
      .where(
        and(
            inArray(bankAuditLogsTable.action, [
              "override_transaction_status",
              "process_internal_transfer",
            ]),
          sql`left(${bankAuditLogsTable.reason}, ${reasonPrefix.length}) = ${reasonPrefix}`,
        ),
      )
      .orderBy(asc(bankAuditLogsTable.createdAt), asc(bankAuditLogsTable.id));

    const userIds = [
      ...new Set(
        auditRows.flatMap((row) => [row.actorUserId, row.targetUserId]),
      ),
    ];
    const users = userIds.length
      ? await db
          .select({
            id: bankUsersTable.id,
            email: bankUsersTable.email,
            firstName: bankUsersTable.firstName,
            lastName: bankUsersTable.lastName,
          })
          .from(bankUsersTable)
          .where(inArray(bankUsersTable.id, userIds))
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));
    const history = new Map<
      string,
      {
        actor: NonNullable<ReturnType<typeof usersById.get>>;
        timestamp: Date;
        previousStatus: string;
        newStatus: string;
        reason: string;
        affectedMembers: Map<string, NonNullable<ReturnType<typeof usersById.get>>>;
      }
    >();

    for (const row of auditRows) {
      const actor = usersById.get(row.actorUserId);
      const affectedMember = usersById.get(row.targetUserId);
      const details = row.reason.slice(reasonPrefix.length);
      const match =
        /^(pending|completed|failed|rejected|reversed) → (pending|completed|failed|rejected|reversed)\. ([\s\S]*)$/.exec(
          details,
        );
      if (!actor || !affectedMember || !match) {
        req.log.error(
          { transactionId: transaction.id, auditLogId: row.id },
          "Could not read transaction status audit entry",
        );
        res.status(500).json({ error: "Transaction status history is unavailable." });
        return;
      }

      const eventKey = `${row.createdAt.toISOString()}|${row.actorUserId}|${row.reason}`;
      let event = history.get(eventKey);
      if (!event) {
        event = {
          actor,
          timestamp: row.createdAt,
          previousStatus: match[1],
          newStatus: match[2],
          reason: match[3],
          affectedMembers: new Map(),
        };
        history.set(eventKey, event);
      }
      event.affectedMembers.set(affectedMember.id, affectedMember);
    }

    res.json(
      ListAdminTransactionStatusHistoryResponse.parse(
        [...history.values()].map((event) => ({
          actorName:
            [event.actor.firstName, event.actor.lastName].filter(Boolean).join(" ") ||
            event.actor.email,
          actorEmail: event.actor.email,
          timestamp: event.timestamp.toISOString(),
          previousStatus: event.previousStatus,
          newStatus: event.newStatus,
          reason: event.reason,
          affectedMembers: [...event.affectedMembers.values()].map((user) => ({
            name:
              [user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.email,
            email: user.email,
          })),
        })),
      ),
    );
  },
);

router.post(
  "/bank/admin/transactions/:transactionId/process",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ProcessAdminInternalTransferParams.safeParse(req.params);
    const parsed = ProcessAdminInternalTransferBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid request.",
      });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access administrative controls." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.id, params.data.transactionId))
        .for("update");
      if (!transaction) return { notFound: true as const };
      if (transaction.type !== "external_transfer" || transaction.status !== "pending") {
        return { error: "Only pending internal transfer requests can be processed." };
      }
      const [request] = await tx
        .select()
        .from(bankInternationalTransferRequestsTable)
        .where(eq(bankInternationalTransferRequestsTable.transactionId, transaction.id))
        .for("update");
      if (!request) {
        return { error: "The internal transfer request details are unavailable." };
      }
      const restrictionError = await bankOperationRestrictionError(tx, {
        userId: request.userId,
        walletId: request.sourceWalletId,
        operation: "outgoing_transfer",
      });
      if (restrictionError) return { error: restrictionError };
      const [wallet] = await tx
        .select()
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, request.sourceWalletId))
        .for("update");
      if (!wallet || wallet.userId !== request.userId || wallet.status !== "active") {
        return { error: "The source wallet is unavailable or frozen." };
      }
      if (!wallet.transfersEnabled) {
        return { error: "Outgoing transfers are disabled for this wallet in the member’s private vault." };
      }
      const finalRestrictionError = await bankOperationRestrictionError(tx, {
        userId: request.userId,
        walletId: wallet.id,
        operation: "outgoing_transfer",
      });
      if (finalRestrictionError) return { error: finalRestrictionError };
      const existingEntries = await tx
        .select({ id: bankLedgerEntriesTable.id })
        .from(bankLedgerEntriesTable)
        .where(eq(bankLedgerEntriesTable.transactionId, transaction.id))
        .limit(1);
      if (existingEntries.length) {
        return { error: "This transfer already has ledger entries and cannot be posted again." };
      }
      const balance = await balanceForWallet(tx, wallet.id);
      const reserved = await reservedForWallet(tx, wallet.id);
      if (balance - reserved < request.sourceAmountMinor) {
        return { error: "The customer no longer has enough available balance to process this request." };
      }
      await tx.insert(bankLedgerEntriesTable).values([
        {
          transactionId: transaction.id,
          walletId: wallet.id,
          accountCode: `wallet:${wallet.id}`,
          currency: request.sourceCurrency,
          side: "debit",
          amountMinor: request.sourceAmountMinor,
        },
        {
          transactionId: transaction.id,
          accountCode: `internal:transfer-clearing:${request.sourceCurrency}`,
          currency: request.sourceCurrency,
          side: "credit",
          amountMinor: request.sourceAmountMinor,
        },
      ]);
      const [updated] = await tx
        .update(bankTransactionsTable)
        .set({ status: "completed" })
        .where(eq(bankTransactionsTable.id, transaction.id))
        .returning();
      await tx.insert(bankAuditLogsTable).values(
        [...new Set([request.userId, actorUserId])].map((targetUserId) => ({
          actorUserId,
          targetUserId,
          action: "process_internal_transfer",
          reason: `${generatedAdminAuditReason(req)} Transaction ${transaction.reference}: pending → completed.`,
        })),
      );
      const notification = await storeNotification(tx, {
        userId: request.userId,
        category: "transfer",
        title: "Transfer recorded",
        body: `${formatMinorAmount(request.sourceAmountMinor, request.sourceCurrency)} ${request.sourceCurrency} was recorded in Globus after review.`,
        reference: transaction.reference,
      });
      return { transaction: updated, request, notification };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "Transaction not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    if (result.notification) {
      void sendPushToUser(result.request.userId, result.notification);
      const emailSent = await notifyTransferRecipient({
        notificationId: result.notification.id,
        senderUserId: result.request.userId,
        encryptedEmail: result.request.recipientEmailEncrypted,
        recipientName: result.request.recipientAccountName,
        bankName: result.request.recipientBank,
        destinationCountry: result.request.destinationCountry,
        amount: formatMinorAmount(
          result.request.destinationAmountMinor,
          result.request.destinationCurrency,
        ),
        currency: result.request.destinationCurrency,
        reference: result.transaction.reference,
        status: result.transaction.status,
        createdAt: result.transaction.createdAt,
      });
      if (!emailSent) {
        req.log.warn({ reference: result.transaction.reference }, "Transfer alert email could not be delivered");
      }
    }
    res.json(
      ProcessAdminInternalTransferResponse.parse(
        toBankTransaction(
          result.transaction,
          result.transaction.fromUserId ??
            result.transaction.toUserId ??
            actorUserId,
        ),
      ),
    );
  },
);

router.patch(
  "/bank/admin/transactions/:transactionId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateAdminTransactionStatusParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateAdminTransactionStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const authenticatedClerkId = getAuth(req).userId;
    if (!authenticatedClerkId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(authenticatedClerkId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const reason = generatedAdminAuditReason(req);

    const result = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.id, params.data.transactionId))
        .for("update");
      if (!transaction) {
        return { notFound: true as const };
      }
      const ledgerEntries = await tx
        .select({
          currency: bankLedgerEntriesTable.currency,
          side: bankLedgerEntriesTable.side,
          amountMinor: bankLedgerEntriesTable.amountMinor,
        })
        .from(bankLedgerEntriesTable)
        .where(eq(bankLedgerEntriesTable.transactionId, transaction.id))
        .for("update");
      const ledgerPosted = ledgerPostingsBalanced(ledgerEntries);
      if (transaction.status === parsed.data.status) {
        return { transaction, notification: null, transferRequest: null };
      }
      if (transaction.status === "completed" || transaction.status === "reversed") {
        return {
          error:
            "Completed and reversed transaction history is immutable. Use the compensating reversal workflow for corrections.",
        };
      }
      if (parsed.data.status === "completed" && !ledgerPosted) {
        return {
          error:
            "A transaction can be marked completed only when its existing ledger entries are balanced and posted. Status overrides never post entries.",
        };
      }
      if (
        ledgerEntries.length > 0 &&
        parsed.data.status !== "completed"
      ) {
        return {
          error:
            "A transaction with ledger entries cannot be changed to a non-completed state. Use a compensating reversal if the posting was incorrect.",
        };
      }
      const permittedTransition =
        (transaction.status === "pending" &&
          ["failed", "rejected"].includes(parsed.data.status)) ||
        (transaction.status === "failed" && parsed.data.status === "pending") ||
        (parsed.data.status === "completed" && ledgerPosted);
      if (!permittedTransition) {
        return {
          error:
            "This status transition is not permitted. Pending operations may fail or be rejected; failed operations may be reopened only when no ledger entries exist.",
        };
      }
      if (
        transaction.type === "deposit_request" ||
        transaction.type === "withdrawal_request"
      ) {
        const [request] = await tx
          .select()
          .from(bankSandboxRequestsTable)
          .where(eq(bankSandboxRequestsTable.transactionId, transaction.id))
          .for("update");
        if (
          request &&
          (request.status === "pending_review" ||
            request.status === "pending_provider_setup")
        ) {
          return {
            error: request.type === "deposit"
              ? "Deposit requests are not manually reviewed. Existing uncredited requests remain unchanged; customers must submit a new request with active Private Vault access."
              : "Pending withdrawals must be approved or rejected in the withdrawal review queue.",
          };
        }
      }
      const [updated] = await tx
        .update(bankTransactionsTable)
        .set({ status: parsed.data.status })
        .where(eq(bankTransactionsTable.id, transaction.id))
        .returning();
      const targetUserIds = [
        ...new Set(
          [
            transaction.fromUserId,
            transaction.toUserId,
            transaction.initiatedByUserId,
          ].filter((userId): userId is string => Boolean(userId)),
        ),
      ];
      await tx.insert(bankAuditLogsTable).values(
        targetUserIds.map((targetUserId) => ({
          actorUserId,
          targetUserId,
          action: "override_transaction_status",
          reason: `Transaction ${transaction.reference}: ${transaction.status} → ${parsed.data.status}. ${reason}`,
        })),
      );
      let notification: Awaited<ReturnType<typeof storeNotification>> | null = null;
      let transferRequest: typeof bankInternationalTransferRequestsTable.$inferSelect | null = null;
      if (transaction.type === "external_transfer" && transaction.fromUserId) {
        const [request] = await tx
          .select()
          .from(bankInternationalTransferRequestsTable)
          .where(eq(bankInternationalTransferRequestsTable.transactionId, transaction.id))
          .for("update");
        if (request) {
          transferRequest = request;
          const statusMessage =
            parsed.data.status === "pending"
              ? "The transfer was reopened for review. No wallet balance changed."
              : parsed.data.status === "failed" || parsed.data.status === "rejected"
                ? "The transfer was not posted to the Globus wallet."
                : "The transfer status was updated in Globus.";
          notification = await storeNotification(tx, {
            userId: transaction.fromUserId,
            category: "transfer",
            title: `Transfer status: ${parsed.data.status}`,
            body: statusMessage,
            reference: transaction.reference,
          });
        }
      }
      return { transaction: updated, notification, transferRequest };
    });

    if ("notFound" in result) {
      res.status(404).json({ error: "Transaction not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    if ("notification" in result && result.notification && result.transferRequest) {
      void sendPushToUser(result.transferRequest.userId, result.notification);
      const emailSent = await notifyTransferRecipient({
        notificationId: result.notification.id,
        senderUserId: result.transferRequest.userId,
        encryptedEmail: result.transferRequest.recipientEmailEncrypted,
        recipientName: result.transferRequest.recipientAccountName,
        bankName: result.transferRequest.recipientBank,
        destinationCountry: result.transferRequest.destinationCountry,
        amount: formatMinorAmount(
          result.transferRequest.destinationAmountMinor,
          result.transferRequest.destinationCurrency,
        ),
        currency: result.transferRequest.destinationCurrency,
        reference: result.transaction.reference,
        status: result.transaction.status,
        createdAt: result.transaction.createdAt,
      });
      if (!emailSent) {
        req.log.warn({ reference: result.transaction.reference }, "Transfer alert email could not be delivered");
      }
    }
    res.json(
      UpdateAdminTransactionStatusResponse.parse(
        toBankTransaction(
          result.transaction,
          result.transaction.fromUserId ??
            result.transaction.toUserId ??
            actorUserId,
        ),
      ),
    );
  },
);

router.patch(
  "/bank/admin/transactions/:transactionId/date",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateAdminTransactionDateParams.safeParse(req.params);
    const parsed = UpdateAdminTransactionDateBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Enter a valid transaction date.",
      });
      return;
    }
    if (
      parsed.data.transactionDate &&
      !isIsoCalendarDate(parsed.data.transactionDate)
    ) {
      res.status(400).json({ error: "Enter a real calendar date." });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access administrative controls." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.id, params.data.transactionId))
        .for("update");
      if (!transaction) return { notFound: true as const };
      if (transaction.transactionDate === parsed.data.transactionDate) {
        return { transaction };
      }
      const [updated] = await tx
        .update(bankTransactionsTable)
        .set({ transactionDate: parsed.data.transactionDate })
        .where(eq(bankTransactionsTable.id, transaction.id))
        .returning();
      const targetUserIds = [
        ...new Set(
          [
            transaction.fromUserId,
            transaction.toUserId,
            transaction.initiatedByUserId,
          ].filter((userId): userId is string => Boolean(userId)),
        ),
      ];
      await tx.insert(bankAuditLogsTable).values(
        targetUserIds.map((targetUserId) => ({
          actorUserId,
          targetUserId,
          action: "update_transaction_date",
          reason: `Transaction ${transaction.reference}: customer-facing date changed from ${transaction.transactionDate ?? "recorded date"} to ${parsed.data.transactionDate ?? "recorded date"}. Original record timestamp and ledger postings were not changed. ${generatedAdminAuditReason(req)}`,
        })),
      );
      return { transaction: updated };
    });

    if ("notFound" in result) {
      res.status(404).json({ error: "Transaction not found." });
      return;
    }
    res.json(
      UpdateAdminTransactionDateResponse.parse(
        toBankTransaction(
          result.transaction,
          result.transaction.fromUserId ??
            result.transaction.toUserId ??
            actorUserId,
        ),
      ),
    );
  },
);

router.get(
  "/bank/admin/support/conversations",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = ListAdminSupportConversationsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Choose a valid support inbox filter." });
      return;
    }
    const filters = [];
    if (parsed.data.status) {
      filters.push(eq(bankSupportConversationsTable.status, parsed.data.status));
    }
    if (parsed.data.category) {
      filters.push(eq(bankSupportConversationsTable.category, parsed.data.category));
    }
    if (parsed.data.search?.trim()) {
      const needle = `%${parsed.data.search.trim()}%`;
      filters.push(
        or(
          ilike(bankSupportConversationsTable.subject, needle),
          sql`${bankSupportConversationsTable.userId} in (
            select id from bank_users
            where email ilike ${needle}
              or first_name ilike ${needle}
              or last_name ilike ${needle}
              or customer_id ilike ${needle}
          )`,
        )!,
      );
    }
    const conversations = await db
      .select({
        id: bankSupportConversationsTable.id,
        userId: bankSupportConversationsTable.userId,
        firstName: bankUsersTable.firstName,
        lastName: bankUsersTable.lastName,
        customerEmail: bankUsersTable.email,
        subject: bankSupportConversationsTable.subject,
        category: bankSupportConversationsTable.category,
        transferReference: bankSupportConversationsTable.transferReference,
        status: bankSupportConversationsTable.status,
        adminUnread: bankSupportConversationsTable.adminUnread,
        lastMessagePreview: sql<string | null>`(
          select left(body, 160)
          from bank_support_messages
          where conversation_id = ${bankSupportConversationsTable.id}
          order by created_at desc
          limit 1
        )`,
        lastMessageAt: bankSupportConversationsTable.lastMessageAt,
        createdAt: bankSupportConversationsTable.createdAt,
        updatedAt: bankSupportConversationsTable.updatedAt,
      })
      .from(bankSupportConversationsTable)
      .innerJoin(
        bankUsersTable,
        eq(bankUsersTable.id, bankSupportConversationsTable.userId),
      )
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(bankSupportConversationsTable.lastMessageAt))
      .limit(100);
    res.setHeader("Cache-Control", "no-store");
    res.json(
      ListAdminSupportConversationsResponse.parse({
        conversations: conversations.map((conversation) => ({
          id: conversation.id,
          userId: conversation.userId,
          customerName:
            [conversation.firstName, conversation.lastName].filter(Boolean).join(" ") ||
            "Globus member",
          customerEmail: conversation.customerEmail,
          subject: conversation.subject,
          category: conversation.category as "general" | "private_vault" | "transfer",
          transferReference: conversation.transferReference,
          status: conversation.status as "open" | "closed",
          adminUnread: conversation.adminUnread,
          lastMessagePreview: conversation.lastMessagePreview,
          lastMessageAt: conversation.lastMessageAt.toISOString(),
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
        })),
      }),
    );
  },
);

router.get(
  "/bank/admin/support/conversations/:conversationId/messages",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ListAdminSupportMessagesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "The conversation link is invalid." });
      return;
    }
    const [conversation] = await db
      .select({ id: bankSupportConversationsTable.id })
      .from(bankSupportConversationsTable)
      .where(eq(bankSupportConversationsTable.id, params.data.conversationId))
      .limit(1);
    if (!conversation) {
      res.status(404).json({ error: "That support conversation was not found." });
      return;
    }
    const messages = await db
      .select()
      .from(bankSupportMessagesTable)
      .where(eq(bankSupportMessagesTable.conversationId, conversation.id))
      .orderBy(asc(bankSupportMessagesTable.createdAt))
      .limit(500);
    res.setHeader("Cache-Control", "no-store");
    res.json(
      ListAdminSupportMessagesResponse.parse({
        messages: messages.map((message) => ({
          id: message.id,
          conversationId: message.conversationId,
          senderRole: message.senderRole as "customer" | "admin",
          senderName: message.senderRole === "admin" ? "You" : "Customer",
          body: message.body,
          createdAt: message.createdAt.toISOString(),
        })),
      }),
    );
  },
);

router.post(
  "/bank/admin/support/conversations/:conversationId/messages",
  requireAdmin,
  supportMessageLimiter,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    const params = ReplyAdminSupportMessageParams.safeParse(req.params);
    const parsed = ReplyAdminSupportMessageBody.safeParse({
      body: typeof req.body?.body === "string" ? req.body.body.trim() : req.body?.body,
    });
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to reply to support conversations." });
      return;
    }
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Enter a message of 1 to 4,000 characters." });
      return;
    }
    const actor = await ensureBankUser(authUserId);
    const now = new Date();
    const created = await db.transaction(async (tx) => {
      const [conversation] = await tx
        .select({ id: bankSupportConversationsTable.id, userId: bankSupportConversationsTable.userId })
        .from(bankSupportConversationsTable)
        .where(eq(bankSupportConversationsTable.id, params.data.conversationId))
        .for("update");
      if (!conversation) return null;
      const [message] = await tx
        .insert(bankSupportMessagesTable)
        .values({
          conversationId: conversation.id,
          senderUserId: actor.id,
          senderRole: "admin",
          body: parsed.data.body,
          createdAt: now,
        })
        .returning();
      await tx
        .update(bankSupportConversationsTable)
        .set({
          status: "open",
          customerUnread: true,
          adminUnread: false,
          lastMessageAt: now,
          updatedAt: now,
        })
        .where(eq(bankSupportConversationsTable.id, conversation.id));
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: actor.id,
        targetUserId: conversation.userId,
        action: "support_reply",
        reason: "Authorized administrator replied to a customer support conversation.",
      });
      return message;
    });
    if (!created) {
      res.status(404).json({ error: "That support conversation was not found." });
      return;
    }
    res.status(201).json(
      ReplyAdminSupportMessageResponse.parse({
        message: {
          id: created.id,
          conversationId: created.conversationId,
          senderRole: "admin",
          senderName: "You",
          body: created.body,
          createdAt: created.createdAt.toISOString(),
        },
      }),
    );
  },
);

router.post(
  "/bank/admin/support/conversations/:conversationId/read",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = MarkAdminSupportConversationReadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "The conversation link is invalid." });
      return;
    }
    const [conversation] = await db
      .update(bankSupportConversationsTable)
      .set({ adminUnread: false, updatedAt: new Date() })
      .where(eq(bankSupportConversationsTable.id, params.data.conversationId))
      .returning({ id: bankSupportConversationsTable.id });
    if (!conversation) {
      res.status(404).json({ error: "That support conversation was not found." });
      return;
    }
    res.json(MarkAdminSupportConversationReadResponse.parse({ markedRead: true }));
  },
);


// Permanently erase a customer's personal data while retaining only the
// minimum pseudonymous account linkage required for financial ledger integrity.
router.post(
  "/bank/admin/users/:userId/delete",
  requireAdmin,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const userId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
    const confirmation = req.body?.confirmation;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!userId || userId.length > 256 || confirmation !== "DELETE" || reason.length < 10 || reason.length > 500) {
      res.status(400).json({ error: "Enter DELETE and provide a deletion reason of 10–500 characters." });
      return;
    }

    const authenticatedClerkId = getAuth(req).userId;
    if (!authenticatedClerkId) {
      res.status(401).json({ error: "Sign in to access administrative controls." });
      return;
    }
    if (authenticatedClerkId === userId) {
      res.status(400).json({ error: "Administrators cannot delete their own account." });
      return;
    }

    const actor = await ensureBankUser(authenticatedClerkId);
    const [target] = await db
      .select({ id: bankUsersTable.id, email: bankUsersTable.email, accountStatus: bankUsersTable.accountStatus })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, userId))
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "Customer account not found." });
      return;
    }
    const protectedAdminEmails = (process.env.GLOBUS_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const protectedAdminIds = (process.env.GLOBUS_ADMIN_CLERK_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (protectedAdminIds.includes(target.id) || protectedAdminEmails.includes(target.email.toLowerCase())) {
      res.status(409).json({ error: "Allowlisted administrator accounts cannot be deleted through customer management." });
      return;
    }

    const now = new Date();
    const tombstoneEmail = `erased+${createHash("sha256").update(target.id).digest("hex").slice(0, 24)}@invalid.local`;
    try {
      await db.transaction(async (tx) => {
        // Remove customer-authored support content and private Vault reset/session material.
        const conversations = await tx
          .select({ id: bankSupportConversationsTable.id })
          .from(bankSupportConversationsTable)
          .where(eq(bankSupportConversationsTable.userId, target.id));
        if (conversations.length) {
          await tx.delete(bankSupportMessagesTable).where(
            inArray(bankSupportMessagesTable.conversationId, conversations.map((item) => item.id)),
          );
          await tx.delete(bankSupportConversationsTable).where(eq(bankSupportConversationsTable.userId, target.id));
        }
        await tx.delete(bankVaultSessionsTable).where(eq(bankVaultSessionsTable.userId, target.id));
        await tx.delete(bankVaultPasscodeResetTokensTable).where(eq(bankVaultPasscodeResetTokensTable.userId, target.id));

        // Financial transactions/ledger entries are intentionally retained where
        // statutory, accounting, dispute, or fraud-retention rules require them.
        await tx.update(bankUsersTable).set({
          email: tombstoneEmail,
          customerId: null,
          firstName: null,
          lastName: null,
          address: null,
          phone: null,
          country: null,
          cityOfOrigin: null,
          dateOfBirth: null,
          occupation: null,
          profileSetupCompletedAt: null,
          transactionPinHash: null,
          transactionPinFailedAttempts: 0,
          transactionPinLockedUntil: null,
          vaultPasscodeHash: null,
          vaultPasscodeFailedAttempts: 0,
          vaultPasscodeLockedUntil: null,
          vaultSubscriptionReason: null,
          vaultSubscriptionPaymentReference: null,
          vaultPaystackCustomerCode: null,
          vaultPaystackSubscriptionCode: null,
          vaultSubscriptionProofObjectPath: null,
          vaultSubscriptionProofContentType: null,
          vaultSubscriptionProofSizeBytes: null,
          vaultSubscriptionProofFileName: null,
          vaultSubscriptionProofUploadedAt: null,
          vaultEmailSupportUrl: null,
          vaultEmailSupportLabel: "Contact support",
          vaultEmailSenderLocalPart: null,
          verificationNote: null,
          accountRestrictionReason: null,
          accountRestrictionNotes: null,
          accountRestrictedByUserId: null,
          acceptedTermsAt: null,
          transferAccessGranted: false,
          supportAccessGranted: false,
          testingModeDisabled: true,
          vaultSubscriptionStatus: "inactive",
          vaultSubscriptionPlan: null,
          vaultSubscriptionAmountMinor: null,
          vaultSubscriptionAutoRenew: false,
          vaultPaystackPlanCode: null,
          vaultEmailAlertsEnabled: false,
          vaultEmailIncludeSupportLink: false,
          pushTransferAlertsEnabled: false,
          pushWalletAlertsEnabled: false,
          pushSecurityAlertsEnabled: false,
          accountStatus: "deletion_pending",
          updatedAt: now,
        }).where(eq(bankUsersTable.id, target.id));
        await tx.insert(bankAuditLogsTable).values({
          actorUserId: actor.id,
          targetUserId: target.id,
          action: "customer_personal_data_erasure_requested",
          reason: reason.slice(0, 500),
        });
      });
    } catch {
      res.status(500).json({ error: "Customer data erasure could not be prepared. No success was recorded." });
      return;
    }

    try {
      await clerkClient.users.deleteUser(target.id);
      await db.update(bankUsersTable)
        .set({ accountStatus: "deleted", updatedAt: new Date() })
        .where(eq(bankUsersTable.id, target.id));
      res.json({
        deleted: true,
        userId: target.id,
        retainedRecords: "Financial ledger and transaction records may be retained where legally required; personal profile and Vault authentication data were erased.",
      });
    } catch (error: unknown) {
      const status = typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: unknown }).status)
        : 0;
      if (status === 404) {
        await db.update(bankUsersTable)
          .set({ accountStatus: "deleted", updatedAt: new Date() })
          .where(eq(bankUsersTable.id, target.id));
        res.json({ deleted: true, userId: target.id, retainedRecords: "Required financial records may remain in pseudonymous form." });
        return;
      }
      res.status(202).json({
        deleted: false,
        pending: true,
        userId: target.id,
        error: "Personal data has been scrubbed from the application profile, but identity-provider deletion is pending. Retry this operation after checking the Clerk connection.",
      });
    }
  },
);

export default router;
