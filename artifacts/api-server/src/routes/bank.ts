import { Router, type IRouter, type Request, type RequestHandler, type Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { rateLimit } from "express-rate-limit";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import {
  DeleteBankVaultTransactionNoteHeader,
  DeleteBankVaultTransactionNoteParams,
  DeleteBankVaultTransactionNoteResponse,
  DeleteBankPushSubscriptionParams,
  DeleteBankPushSubscriptionResponse,
  CreateBankSavedPaymentMethodBody,
  CreateBankSavedPaymentMethodResponse,
  CompleteRequiredPasswordResetBody,
  CompleteRequiredPasswordResetResponse,
  CreateExternalTransferBody,
  CreateExternalTransferResponse,
  CreateIncomingExternalTransferBody,
  CreateLedgerRequestBody,
  DeleteBankSavedPaymentMethodParams,
  DeleteBankSavedPaymentMethodResponse,
  CreateIncomingExternalTransferResponse,
  CreateInternationalTransferRequestBody,
  CreateInternationalTransferRequestResponse,
  CreateLedgerRequestResponse,
  GetBankDashboardResponse,
  GetBankExchangeRateQuoteQueryParams,
  GetBankExchangeRateQuoteResponse,
  GetBankProfileResponse,
  GetBankReceiptPreferencesResponse,
  GetBankPushConfigResponse,
  GetBankPushPreferencesResponse,
  GetBankVaultStatusResponse,
  GetBankVaultSessionResponse,
  GetBankVaultTransferEmailAlertResponse,
  InitializeBankVaultPaystackPaymentBody,
  InitializeBankVaultPaystackPaymentHeader,
  InitializeBankVaultPaystackPaymentResponse,
  VerifyBankVaultPaystackPaymentBody,
  VerifyBankVaultPaystackPaymentHeader,
  VerifyBankVaultPaystackPaymentResponse,
  GetBankVaultBillingHeader,
  GetBankVaultBillingResponse,
  GetBankVaultEmailPreferencesHeader,
  GetBankVaultEmailPreferencesResponse,
  GetBankVaultReceiptPreferenceHeader,
  GetBankVaultReceiptPreferenceResponse,
  ClearBankNotificationsResponse,
  InitializeBankVaultPasscodeBody,
  InitializeBankVaultPasscodeResponse,
  ListBankNotificationsResponse,
  ListBankVaultWalletControlsHeader,
  ListBankVaultWalletControlsResponse,
  ListBankExchangeRatesResponse,
  ListInternationalTransferRequestsResponse,
  ListBankTransactionsQueryParams,
  ListBankTransactionsResponse,
  ListBankVaultTransactionNotesHeader,
  ListBankVaultTransactionNotesResponse,
  ListBankWalletsResponse,
  ListBankSavedPaymentMethodsResponse,
  LookupCustomerIdBody,
  LookupCustomerIdResponse,
  UpdateTransactionPinBody,
  UpdateTransactionPinResponse,
  UpdateBankProfileBody,
  UpdateBankProfileResponse,
  UpdateBankReceiptPreferencesBody,
  UpdateBankReceiptPreferencesResponse,
  UpdateBankVaultPasscodeBody,
  UpdateBankVaultPasscodeHeader,
  UpdateBankVaultPasscodeResponse,
  UpdateBankVaultEmailPreferencesBody,
  UpdateBankVaultEmailPreferencesHeader,
  UpdateBankVaultEmailPreferencesResponse,
  UpdateBankVaultReceiptPreferenceBody,
  UpdateBankVaultReceiptPreferenceHeader,
  UpdateBankVaultReceiptPreferenceResponse,
  UpdateBankVaultTransactionNoteBody,
  UpdateBankVaultTransactionNoteHeader,
  UpdateBankVaultTransactionNoteParams,
  UpdateBankVaultTransactionNoteResponse,
  UpdateBankVaultWalletControlBody,
  UpdateBankVaultWalletControlHeader,
  UpdateBankVaultWalletControlParams,
  UpdateBankVaultWalletControlResponse,
  UpdateBankPushPreferencesBody,
  UpdateBankPushPreferencesHeader,
  UpdateBankPushPreferencesResponse,
  UnlockBankVaultBody,
  UnlockBankVaultResponse,
  LockBankVaultSessionResponse,
  ClearIncompleteBankVaultSubscriptionResponse,
  ListBankSupportConversationsResponse,
  CreateBankSupportConversationBody,
  CreateBankSupportConversationResponse,
  ListBankSupportMessagesParams,
  ListBankSupportMessagesResponse,
  SendBankSupportMessageParams,
  SendBankSupportMessageBody,
  SendBankSupportMessageResponse,
  MarkBankSupportConversationReadParams,
  MarkBankSupportConversationReadResponse,
  MarkBankNotificationReadParams,
  MarkBankNotificationReadResponse,
  SaveBankPushSubscriptionBody,
  SaveBankPushSubscriptionResponse,
  SaveSignupProfileBody,
} from "@workspace/api-zod";
import {
  bankAuditLogsTable,
  bankAdminSettingsTable,
  bankNotificationsTable,
  bankPushSubscriptionsTable,
  bankVaultTransactionNotesTable,
  bankVaultPasscodeResetTokensTable,
  bankExchangeRatesTable,
  bankInternationalTransferRequestsTable,
  bankLedgerEntriesTable,
  bankSandboxRequestsTable,
  bankTransactionsTable,
  bankUsersTable,
  bankSavedPaymentMethodsTable,
  bankSupportConversationsTable,
  bankSupportMessagesTable,
  bankVaultPaystackEventsTable,
  bankVaultPaystackPlansTable,
  bankWalletsTable,
  db,
} from "@workspace/db";
import {
  balanceForWallet,
  bankOperationRestrictionError,
  convertMinorAmount,
  createReference,
  currencies,
  ensureBankUser,
  formatMinorAmount,
  conversionRatesMatch,
  getEffectiveBankAccountStatus,
  getBankOperationEligibility,
  getRecentTransactions,
  getWalletsForUser,
  listUserTransactions,
  parseAmountToMinor,
  reservedForWallet,
  toBankTransaction,
  userWallet,
  isOutgoingTransferEnabled,
} from "../lib/bank";
import {
  CUSTOMER_EMAIL_SENDER_DOMAIN,
  CUSTOMER_EMAIL_SENDER_DISPLAY_NAME,
  normalizeCustomerEmailSenderLocalPart,
} from "../lib/customer-email-sender";
import {
  normalizeRequiredProfileName,
  sanitizeBankProfileUpdateDetails,
  sanitizeSignupProfileDetails,
} from "../lib/signup-profile";
import { getExchangeRate } from "../lib/exchange-rates";
import {
  addVaultSubscriptionMonths,
  getVaultPlanPriceMinor,
  getVaultSubscriptionPlan,
  isVaultSubscriptionPlanCode,
} from "../lib/vault-subscription";
import {
  createPaystackVaultPlan,
  getPaystackSecretKey,
  isPaystackVaultRecurringEnabled,
  isNewPaystackWebhookEvent,
  initializePaystackVaultCheckout,
  isValidPaystackWebhookSignature,
  paystackVaultEventKey,
  sendPaystackSubscriptionManagementEmail,
  verifyPaystackVaultCheckout,
} from "../lib/paystack-vault";
import {
  updateTransactionPin as saveTransactionPin,
  verifyTransactionPin,
  type TransactionPinResult,
} from "../lib/transaction-pin";
import { createVaultSubscriberTopUp } from "../lib/vault-subscriber-deposit";
import { withCustomerReceiptTemplate } from "../lib/customer-receipt-template";
import {
  BankDetailsEncryptionUnavailableError,
  encryptBankAccountNumber,
  normalizeBankAccountNumber,
} from "../lib/sensitive-bank-details";
import {
  isPasswordResetRequired,
  setPasswordResetCache,
} from "../lib/password-reset";
import {
  classifyVaultPaystackChargeFailure,
  initializeVaultPasscode,
  completeVaultPasscodeReset,
  resetVaultPasscodeAfterClerkVerification,
  getEffectiveAccountTier,
  getVaultAccessSource,
  hasActiveVaultAccess,
  isVaultTestingMode,
  isVaultPasscodeSessionValid,
  isVaultSessionActive,
  getVaultPasscodeSessionExpiry,
  revokeVaultPasscodeSession,
  normalizeFutureTransferMode,
  resolveFutureTransferStatus,
  unlockVault,
  updateVaultPasscode,
  vaultTransferEmailAlertsEnabled,
  vaultSubscriptionStatus,
} from "../lib/bank-vault";
import {
  classifyIncompleteVaultAttempt,
  isTerminalUnpaidPaystackStatus,
  VAULT_DEVICE_COOKIE_NAME,
  VAULT_DEVICE_COOKIE_PATH,
  VAULT_REMEMBERED_SESSION_DURATION_MS,
} from "../lib/vault-session-policy";
import { decryptPrivateData, encryptPrivateData } from "../lib/private-data";
import { getVaultPasscodeResetSenderAddress } from "../lib/vault-passcode-reset-email";
import { sendVaultPasscodeResetEmail } from "../lib/vault-passcode-reset-smtp";
import {
  normalizeSupportLabel,
  normalizeSupportUrl,
  notificationResponse,
  WebpushrSubscriberAlreadyLinkedError,
  getPushConfig,
  notifyTransferRecipient,
  savePushSubscription,
  sendPushToUser,
  storeNotification,
} from "../lib/transfer-notifications";

const router: IRouter = Router();
const vaultDeviceCookieOptions = () => ({
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: VAULT_DEVICE_COOKIE_PATH,
});

function clearVaultDeviceCookie(res: Response): void {
  res.clearCookie(VAULT_DEVICE_COOKIE_NAME, vaultDeviceCookieOptions());
}

function getVaultDeviceCookieToken(req: Request): string {
  const cookies = (req as Request & { cookies?: Record<string, unknown> }).cookies;
  const token = cookies?.[VAULT_DEVICE_COOKIE_NAME];
  return typeof token === "string" ? token : "";
}
const customerIdLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Unable to verify those details. Try again later." },
});
const supportMessageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many support messages. Try again in a few minutes." },
});
const exchangeRateQuoteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Rate quotes are temporarily limited. Please try again shortly." },
});
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many password updates. Try again later." },
});
const vaultAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many vault attempts. Try again later." },
});
const transferSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many transfer submissions. Try again later." },
});
const pushSubscriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many notification setup attempts. Try again later." },
});
const vaultSubscriptionRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many private vault access requests. Try again later." },
});

async function getOrCreateAdminSettings() {
  const [existing] = await db
    .select()
    .from(bankAdminSettingsTable)
    .where(eq(bankAdminSettingsTable.id, "operations"))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(bankAdminSettingsTable)
    .values({ id: "operations" })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [retried] = await db
    .select()
    .from(bankAdminSettingsTable)
    .where(eq(bankAdminSettingsTable.id, "operations"))
    .limit(1);
  if (!retried) throw new Error("Private vault billing settings are unavailable.");
  return retried;
}

async function bankVaultStatusPayload(user: typeof bankUsersTable.$inferSelect) {
  const legacyManualRequest =
    user.vaultSubscriptionStatus === "pending" &&
    user.vaultSubscriptionPaymentStatus !== "pending" &&
    user.vaultSubscriptionPaymentStatus !== "success";
  const subscriptionStatus = vaultSubscriptionStatus(
    legacyManualRequest ? "inactive" : user.vaultSubscriptionStatus,
    user.vaultSubscriptionExpiresAt,
  );
  const accessSource = await getVaultAccessSource(user);
  return {
    configured: Boolean(user.vaultPasscodeHash),
    subscriptionStatus,
    subscriptionActive: subscriptionStatus === "active",
    adminGrantActive: accessSource === "admin_grant",
    accessActive: accessSource !== "none",
    accessSource,
    requestedAt: legacyManualRequest
      ? null
      : user.vaultSubscriptionRequestedAt?.toISOString() ?? null,
    expiresAt: user.vaultSubscriptionExpiresAt?.toISOString() ?? null,
    planCode: legacyManualRequest ? null : user.vaultSubscriptionPlan,
    amountMinor: legacyManualRequest ? null : user.vaultSubscriptionAmountMinor,
    proofUploadedAt: null,
    paymentStatus: ["pending", "failed", "success"].includes(
      user.vaultSubscriptionPaymentStatus,
    )
      ? user.vaultSubscriptionPaymentStatus
      : "none",
    paymentReference: user.vaultSubscriptionPaymentReference,
    autoRenew:
      user.vaultSubscriptionPaymentStatus === "success" &&
      user.vaultSubscriptionAutoRenew,
    renewalManagementReady: Boolean(
      user.vaultSubscriptionPaymentStatus === "success" &&
      user.vaultSubscriptionAutoRenew &&
      user.vaultPaystackSubscriptionCode,
    ),
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

async function getOrCreatePaystackVaultPlan(
  secretKey: string,
  planCode: "1m" | "1y",
  amountMinor: string,
): Promise<string> {
  const [existing] = await db
    .select()
    .from(bankVaultPaystackPlansTable)
    .where(and(
      eq(bankVaultPaystackPlansTable.planCode, planCode),
      eq(bankVaultPaystackPlansTable.amountMinor, amountMinor),
    ))
    .limit(1);
  if (existing) return existing.providerPlanCode;
  const plan = getVaultSubscriptionPlan(planCode);
  if (!plan) throw new Error("The recurring Vault plan is unavailable.");
  const providerPlan = await createPaystackVaultPlan({
    secretKey,
    name: `Globus Private Vault ${plan.label}`,
    amountMinor,
    interval: planCode === "1m" ? "monthly" : "annually",
  });
  await db
    .insert(bankVaultPaystackPlansTable)
    .values({
      planCode,
      amountMinor,
      providerPlanCode: providerPlan.planCode,
    })
    .onConflictDoNothing();
  const [stored] = await db
    .select()
    .from(bankVaultPaystackPlansTable)
    .where(and(
      eq(bankVaultPaystackPlansTable.planCode, planCode),
      eq(bankVaultPaystackPlansTable.amountMinor, amountMinor),
    ))
    .limit(1);
  if (!stored) throw new Error("The recurring Vault plan could not be stored.");
  return stored.providerPlanCode;
}

function paystackPlanCodeFromEvent(data: Record<string, unknown>): string | null {
  const plan = asObject(data.plan);
  const planObject = asObject(data.plan_object);
  const candidate =
    (typeof data.plan === "string" ? data.plan : null) ??
    (typeof data.plan_code === "string" ? data.plan_code : null) ??
    (typeof plan?.plan_code === "string" ? plan.plan_code : null) ??
    (typeof planObject?.plan_code === "string" ? planObject.plan_code : null);
  return candidate && /^PLN_[A-Za-z0-9]+$/.test(candidate) ? candidate : null;
}

function paystackSubscriptionCodeFromEvent(
  data: Record<string, unknown>,
): string | null {
  const subscription = asObject(data.subscription);
  const candidate =
    (typeof data.subscription_code === "string" ? data.subscription_code : null) ??
    (typeof subscription?.subscription_code === "string"
      ? subscription.subscription_code
      : null);
  return candidate && /^SUB_[A-Za-z0-9]+$/.test(candidate) ? candidate : null;
}

function paystackCustomerFromEvent(data: Record<string, unknown>) {
  const customer = asObject(data.customer);
  return {
    code:
      typeof customer?.customer_code === "string"
        ? customer.customer_code
        : null,
    email:
      typeof customer?.email === "string"
        ? customer.email.trim().toLowerCase()
        : null,
  };
}

async function bankVaultEmailPreferencesPayload(user: typeof bankUsersTable.$inferSelect) {
  return {
    transactionEmailAlertsEnabled: await vaultTransferEmailAlertsEnabled(user),
    bannerTheme: user.vaultEmailBannerTheme,
    bannerHeadline: user.vaultEmailBannerHeadline,
    bannerBackgroundColor: user.vaultEmailBannerBackgroundColor,
    includeSupportLink: user.vaultEmailIncludeSupportLink,
    supportUrl: user.vaultEmailSupportUrl,
    supportLabel: user.vaultEmailSupportLabel,
    senderLocalPart: user.vaultEmailSenderLocalPart,
    senderDomain: CUSTOMER_EMAIL_SENDER_DOMAIN,
    senderDisplayName: CUSTOMER_EMAIL_SENDER_DISPLAY_NAME,
  };
}

function bankReceiptPreferencesPayload(user: typeof bankUsersTable.$inferSelect) {
  return { preferredTemplate: user.preferredReceiptTemplate };
}

function bankVaultTransactionNoteResponse(
  note: typeof bankVaultTransactionNotesTable.$inferSelect,
) {
  return {
    id: note.id,
    transactionId: note.transactionId,
    note: decryptPrivateData(note.note, "vault-transaction-note"),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

function bankPushPreferencesPayload(user: typeof bankUsersTable.$inferSelect) {
  return {
    transferEnabled: user.pushTransferAlertsEnabled,
    walletEnabled: user.pushWalletAlertsEnabled,
    securityEnabled: user.pushSecurityAlertsEnabled,
  };
}

function rejectExternalTransfer(res: Response, kind: "deposit" | "payout"): boolean {
  res.status(410).json({
    error:
      kind === "deposit"
        ? "External deposits are not available. Submit an internal ledger deposit request instead."
        : "External payouts are not available. Submit a ledger withdrawal request instead.",
  });
  return true;
}

function respondWithTransactionPinError(
  res: Response,
  result: Exclude<TransactionPinResult, "valid">,
): void {
  if (result === "not_configured") {
    res.status(409).json({
      error: "Set a 6-digit transaction PIN in Settings before making transactions.",
    });
    return;
  }
  if (result === "locked") {
    res.status(429).json({
      error: "Too many incorrect PIN attempts. Try again in 15 minutes.",
    });
    return;
  }
  if (result === "invalid") {
    res.status(403).json({ error: "The transaction PIN is incorrect." });
    return;
  }
  res.status(404).json({ error: "The account for this transaction was not found." });
}

const requireSignedIn: RequestHandler = async (req, res, next) => {
  const normalizedPath = req.originalUrl
    .split("?")[0]
    .replace(/^\/api(?=\/)/, "");
  if (normalizedPath === "/bank/vault/paystack/webhook") {
    next();
    return;
  }
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  if (req.originalUrl.split("?")[0] === "/bank/me/password-reset/complete") {
    next();
    return;
  }
  try {
    if (await isPasswordResetRequired(userId)) {
      res.status(423).json({
        error: "Update your password before accessing your Globus account.",
      });
      return;
    }
  } catch {
    res.status(503).json({
      error: "Account security could not be verified right now.",
    });
    return;
  }
  next();
};

async function getOrCreateBankUser(clerkUserId: string) {
  return ensureBankUser(clerkUserId);
}

function bankSupportMessageResponse(
  message: typeof bankSupportMessagesTable.$inferSelect,
  viewerRole: "customer" | "admin",
) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderRole: message.senderRole as "customer" | "admin",
    senderName: message.senderRole === viewerRole
      ? "You"
      : message.senderRole === "admin" ? "Globus support" : "Customer",
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

function internationalTransferRequestResponse(
  request: typeof bankInternationalTransferRequestsTable.$inferSelect,
  transaction: typeof bankTransactionsTable.$inferSelect,
  recipientEmailNotificationSkipped = false,
) {
  let recipientEmail: string | null = null;
  if (request.recipientEmailEncrypted) {
    try {
      recipientEmail = decryptPrivateData(
        request.recipientEmailEncrypted,
        "transfer-recipient-email",
      );
    } catch {
      recipientEmail = null;
    }
  }
  return {
    id: transaction.id,
    reference: transaction.reference,
    status: transaction.status,
    receiptTemplate: transaction.receiptTemplate,
    transferType: request.transferType as "local_routing" | "international_wire",
    destinationCountry: request.destinationCountry,
    recipientBank: request.recipientBank,
    routingCode: request.routingCode,
    swiftBic: request.swiftBic,
    senderName: request.senderName,
    sourceWalletLast4: request.sourceWalletId
      .replaceAll("-", "")
      .slice(-4)
      .toUpperCase(),
    recipientAccountName: request.recipientAccountName,
    recipientEmail,
    recipientEmailNotificationSkipped,
    recipientAccountLast4: request.recipientAccountLast4,
    sourceCurrency: request.sourceCurrency,
    sourceAmount: formatMinorAmount(request.sourceAmountMinor),
    destinationCurrency: request.destinationCurrency,
    destinationAmount: formatMinorAmount(request.destinationAmountMinor, request.destinationCurrency),
    exchangeRate: request.exchangeRate,
    rateUpdatedAt: request.rateUpdatedAt.toISOString(),
    remark: request.remark,
    createdAt: request.createdAt.toISOString(),
  };
}

router.post(
  "/bank/customer-id/lookup",
  customerIdLookupLimiter,
  async (req, res): Promise<void> => {
    const parsed = LookupCustomerIdBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Enter a valid seven-character Customer ID." });
      return;
    }

    const [user] = await db
      .select({ email: bankUsersTable.email })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.customerId, parsed.data.customerId.toUpperCase()))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "Customer ID or password could not be verified." });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.json(LookupCustomerIdResponse.parse({ email: user.email }));
  },
);

router.use("/bank/vault/receipt-preference", (_req, res, next): void => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

router.post(
  "/bank/vault/passcode-reset/complete",
  passwordResetLimiter,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const newPasscode = typeof req.body?.newPasscode === "string" ? req.body.newPasscode : "";
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(token) || !/^\d{4}$/.test(newPasscode)) {
      res.status(400).json({ error: "Enter a valid reset link and a four-digit passcode." });
      return;
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const [tokenRecord] = await db
      .select({
        userId: bankVaultPasscodeResetTokensTable.userId,
        requestedByUserId: bankVaultPasscodeResetTokensTable.requestedByUserId,
      })
      .from(bankVaultPasscodeResetTokensTable)
      .where(
        and(
          eq(bankVaultPasscodeResetTokensTable.tokenHash, tokenHash),
          isNull(bankVaultPasscodeResetTokensTable.usedAt),
          gt(bankVaultPasscodeResetTokensTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!tokenRecord) {
      res.status(400).json({ error: "This reset link is invalid, expired, or has already been used. Request a new link." });
      return;
    }

    const completed = await completeVaultPasscodeReset(token, newPasscode);
    if (!completed) {
      res.status(400).json({ error: "This reset link is invalid, expired, or has already been used. Request a new link." });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({ reset: true, message: "Your Private Vault passcode has been reset. Sign in and unlock your vault using the new passcode." });
  },
);


const clerkOtpVaultPasscodeResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many PIN reset attempts. Try again later." },
});

// Authenticated recovery uses Clerk session reverification. The signed session
// token must contain a fresh fva claim and the configured reverification_id claim.
router.post(
  "/bank/vault/passcode-reset/complete-otp",
  requireSignedIn,
  clerkOtpVaultPasscodeResetLimiter,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const auth = getAuth(req);
    const userId = auth.userId;
    const claims = auth.sessionClaims as Record<string, unknown> | undefined;
    const fva = claims?.fva;
    const reverificationId = claims?.reverification_id;
    const customerId = typeof req.body?.customerId === "string"
      ? req.body.customerId.trim().toUpperCase()
      : "";
    const suppliedEmail = typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
    const suppliedUsername = typeof req.body?.username === "string"
      ? req.body.username.trim()
      : "";
    const newPasscode = typeof req.body?.newPasscode === "string"
      ? req.body.newPasscode
      : "";

    if (
      !userId ||
      !auth.sessionId ||
      !Array.isArray(fva) ||
      typeof fva[0] !== "number" ||
      fva[0] < 0 ||
      fva[0] > 1 ||
      typeof reverificationId !== "string" ||
      !/^[A-Za-z0-9_-]{8,200}$/.test(reverificationId) ||
      !/^[A-Z0-9]{7}$/.test(customerId) ||
      !suppliedEmail ||
      suppliedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suppliedEmail) ||
      !suppliedUsername ||
      suppliedUsername.length > 128 ||
      !/^\d{4}$/.test(newPasscode)
    ) {
      res.status(403).json({ error: "Complete Clerk email verification and confirm your account details before resetting your Vault PIN." });
      return;
    }

    try {
      const [customer] = await db
        .select({
          id: bankUsersTable.id,
          customerId: bankUsersTable.customerId,
          email: bankUsersTable.email,
        })
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, userId))
        .limit(1);
      if (!customer || customer.customerId?.toUpperCase() !== customerId ||
          customer.email.trim().toLowerCase() !== suppliedEmail) {
        res.status(403).json({ error: "The account details could not be verified." });
        return;
      }

      const identity = await clerkClient.users.getUser(userId);
      const primaryEmail = identity.emailAddresses.find(
        (address) => address.id === identity.primaryEmailAddressId,
      );
      if (
        identity.id !== userId ||
        !identity.username ||
        identity.username.toLowerCase() !== suppliedUsername.toLowerCase() ||
        !primaryEmail ||
        primaryEmail.verification?.status !== "verified" ||
        primaryEmail.emailAddress.trim().toLowerCase() !== suppliedEmail
      ) {
        res.status(403).json({ error: "The account details could not be verified." });
        return;
      }

      const reset = await resetVaultPasscodeAfterClerkVerification(
        userId,
        reverificationId,
        newPasscode,
      );
      if (!reset) {
        res.status(409).json({ error: "This verification has already been used. Request a new email code and try again." });
        return;
      }

      res.json({
        reset: true,
        message: "Your Private Vault PIN has been updated. Unlock your Vault using the new PIN.",
      });
    } catch (error) {
      req.log.error({ error, userId }, "Clerk-verified Private Vault PIN reset failed");
      res.status(503).json({ error: "Your Vault PIN could not be updated right now. Please try again." });
    }
  },
);

const publicVaultPasscodeResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { sent: true, message: "If the email matches a GLOBUS BANK account, a reset link will be sent." },
});

// This route deliberately sits before requireSignedIn so a customer who cannot
// sign in can recover only their Vault PIN using their verified primary email.
router.post(
  "/bank/vault/passcode-reset/request-by-email",
  publicVaultPasscodeResetLimiter,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const genericResponse = {
      sent: true,
      message: "If the email matches a GLOBUS BANK account, a reset link will be sent to its verified primary email.",
    };
    const suppliedEmail = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const email = suppliedEmail.toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.json(genericResponse);
      return;
    }

    try {
      const [customer] = await db
        .select()
        .from(bankUsersTable)
        .where(sql`lower(${bankUsersTable.email}) = ${email}`)
        .limit(1);
      if (!customer) {
        res.json(genericResponse);
        return;
      }

      const identities = await clerkClient.users.getUserList({ emailAddress: [email], limit: 10 });
      const identity = identities.data.find((candidate) => {
        const primary = candidate.emailAddresses.find(
          (address) => address.id === candidate.primaryEmailAddressId,
        );
        return Boolean(
          primary &&
          primary.emailAddress.toLowerCase() === email &&
          primary.verification?.status === "verified",
        );
      });
      if (!identity || identity.id !== customer.id) {
        res.json(genericResponse);
        return;
      }

      const resendApiKey = process.env.RESEND_API_KEY?.trim();
      let senderAddress: string;
      try {
        senderAddress = getVaultPasscodeResetSenderAddress();
        if (!resendApiKey) throw new Error("RESEND_API_KEY is not configured.");
      } catch (error) {
        req.log.error({ error }, "Public Private Vault passcode reset email configuration is invalid");
        res.json(genericResponse);
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
      const originUrl = new URL(
        configuredOrigin.includes("://") ? configuredOrigin : `https://${configuredOrigin}`,
      );
      if (originUrl.protocol !== "https:") throw new Error("Secure reset application origin is unavailable.");
      const resetUrl = new URL("/private-vault/reset-passcode", originUrl.origin);
      resetUrl.searchParams.set("token", rawToken);

      await db.transaction(async (tx) => {
        await tx
          .update(bankVaultPasscodeResetTokensTable)
          .set({ usedAt: now })
          .where(and(
            eq(bankVaultPasscodeResetTokensTable.userId, customer.id),
            isNull(bankVaultPasscodeResetTokensTable.usedAt),
          ));
        await tx.insert(bankVaultPasscodeResetTokensTable).values({
          userId: customer.id,
          tokenHash,
          expiresAt,
          requestedByUserId: customer.id,
          createdAt: now,
        });
        await tx.insert(bankAuditLogsTable).values({
          actorUserId: customer.id,
          targetUserId: customer.id,
          action: "request_private_vault_passcode_reset",
          reason: "Customer requested a PIN reset without signing in; identity was verified against the account's verified primary email. Vault access status and entitlements were not modified.",
        });
      });

      try {
        await sendVaultPasscodeResetEmail({
          apiKey: resendApiKey,
          senderAddress,
          recipientAddress: email,
          subject: "Reset your GLOBUS BANK Private Vault passcode",
          text: `A Private Vault passcode reset was requested for your account.\n\nUse this one-time link within 30 minutes:\n${resetUrl.toString()}\n\nIf you did not request this email, you can ignore it. Resetting your passcode does not change your Private Vault access status.`,
        });
        await db.insert(bankAuditLogsTable).values({
          actorUserId: customer.id,
          targetUserId: customer.id,
          action: "private_vault_passcode_reset_email_sent",
          reason: "Password-free customer PIN recovery link sent to the account's verified primary email; token expires in 30 minutes.",
        });
      } catch (error) {
        req.log.error({ error }, "Public Private Vault passcode reset email delivery failed");
        await db
          .update(bankVaultPasscodeResetTokensTable)
          .set({ usedAt: new Date() })
          .where(eq(bankVaultPasscodeResetTokensTable.tokenHash, tokenHash));
        await db.insert(bankAuditLogsTable).values({
          actorUserId: customer.id,
          targetUserId: customer.id,
          action: "private_vault_passcode_reset_email_failed",
          reason: "Password-free customer PIN recovery email delivery failed; the reset token was invalidated.",
        });
      }
    } catch (error) {
      req.log.error({ error }, "Public Private Vault passcode reset request failed");
    }
    res.json(genericResponse);
  },
);

router.use("/bank", requireSignedIn);

router.post(
  "/bank/vault/passcode-reset/request",
  passwordResetLimiter,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to request a Private Vault passcode reset." });
      return;
    }

    let recipientEmail: string | undefined;
    try {
      const identity = await clerkClient.users.getUser(clerkUserId);
      const primary = identity.emailAddresses.find(
        (email) => email.id === identity.primaryEmailAddressId,
      );
      if (primary?.verification?.status === "verified") {
        recipientEmail = primary.emailAddress;
      }
    } catch (error) {
      req.log.error({ error }, "Could not retrieve the signed-in customer's verified email");
    }
    if (!recipientEmail) {
      res.status(409).json({ error: "Add and verify a primary email address to receive a Private Vault reset link." });
      return;
    }

    // Validate all delivery configuration before creating or storing a reset token.
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    let senderAddress: string;
    try {
      senderAddress = getVaultPasscodeResetSenderAddress();
      if (!resendApiKey) throw new Error("RESEND_API_KEY is not configured.");
    } catch (error) {
      req.log.error({ error }, "Private Vault passcode reset email configuration is invalid");
      res.status(503).json({ error: "Secure reset email delivery is not configured correctly. No reset link was created or sent." });
      return;
    }

    const customer = await ensureBankUser(clerkUserId);
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
      if (originUrl.protocol !== "https:") throw new Error("Secure reset application origin is unavailable.");
      resetUrl = new URL("/private-vault/reset-passcode", originUrl.origin);
      resetUrl.searchParams.set("token", rawToken);
    } catch (error) {
      req.log.error({ error }, "Private Vault reset application origin is invalid");
      res.status(503).json({ error: "Secure reset email configuration is unavailable. No reset link was sent." });
      return;
    }

    try {
      await db.transaction(async (tx) => {
        await tx
          .update(bankVaultPasscodeResetTokensTable)
          .set({ usedAt: now })
          .where(
            and(
              eq(bankVaultPasscodeResetTokensTable.userId, customer.id),
              isNull(bankVaultPasscodeResetTokensTable.usedAt),
            ),
          );
        await tx.insert(bankVaultPasscodeResetTokensTable).values({
          userId: customer.id,
          tokenHash,
          expiresAt,
          requestedByUserId: customer.id,
          createdAt: now,
        });
        await tx.insert(bankAuditLogsTable).values({
          actorUserId: customer.id,
          targetUserId: customer.id,
          action: "request_private_vault_passcode_reset",
          reason: "Customer requested a single-use Private Vault passcode reset link for their verified primary email. Vault access status and entitlements were not modified.",
        });
      });
    } catch (error) {
      req.log.error({ error }, "Could not record the customer's Private Vault passcode reset request");
      res.status(503).json({ error: "Your reset request could not be recorded. Please try again." });
      return;
    }

    let emailSent = false;
    try {
      await sendVaultPasscodeResetEmail({
        apiKey: resendApiKey,
        senderAddress,
        recipientAddress: recipientEmail,
        subject: "Reset your GLOBUS BANK Private Vault passcode",
        text: `A Private Vault passcode reset was requested for your account.\n\nUse this one-time link within 30 minutes:\n${resetUrl.toString()}\n\nIf you did not request this email, you can ignore it. Resetting your passcode does not change your Private Vault access status.`,
      });
      emailSent = true;
    } catch (error) {
      req.log.error({ error }, "Resend could not deliver the customer's Private Vault passcode reset email");
    }

    if (!emailSent) {
      await db
        .update(bankVaultPasscodeResetTokensTable)
        .set({ usedAt: new Date() })
        .where(eq(bankVaultPasscodeResetTokensTable.tokenHash, tokenHash));
      await db.insert(bankAuditLogsTable).values({
        actorUserId: customer.id,
        targetUserId: customer.id,
        action: "private_vault_passcode_reset_email_failed",
        reason: "Customer-requested reset-link email delivery failed; the token was invalidated.",
      });
      res.status(503).json({ error: "The reset link could not be delivered. Please try again later." });
      return;
    }

    await db.insert(bankAuditLogsTable).values({
      actorUserId: customer.id,
      targetUserId: customer.id,
      action: "private_vault_passcode_reset_email_sent",
      reason: "Customer's reset link was sent to their verified primary email address; token expires in 30 minutes.",
    });
    res.json({ sent: true, expiresAt: expiresAt.toISOString() });
  },
);
router.use("/bank", (req, _res, next): void => {
  if (req.get("X-Globus-Vault-Session")) {
    next();
    return;
  }
  const cookieToken = getVaultDeviceCookieToken(req);
  if (cookieToken) req.headers["x-globus-vault-session"] = cookieToken;
  next();
});

router.get("/bank/support/conversations", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to contact Globus support." });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  const conversations = await db
    .select({
      id: bankSupportConversationsTable.id,
      subject: bankSupportConversationsTable.subject,
      category: bankSupportConversationsTable.category,
      transferReference: bankSupportConversationsTable.transferReference,
      status: bankSupportConversationsTable.status,
      customerUnread: bankSupportConversationsTable.customerUnread,
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
    .where(eq(bankSupportConversationsTable.userId, user.id))
    .orderBy(desc(bankSupportConversationsTable.lastMessageAt))
    .limit(100);
  res.setHeader("Cache-Control", "no-store");
  res.json(
    ListBankSupportConversationsResponse.parse({
      conversations: conversations.map((conversation) => ({
        ...conversation,
        category: conversation.category as "general" | "private_vault" | "transfer",
        transferReference: conversation.transferReference,
        status: conversation.status as "open" | "closed",
        lastMessageAt: conversation.lastMessageAt.toISOString(),
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      })),
    }),
  );
});

router.post(
  "/bank/support/conversations",
  supportMessageLimiter,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to contact Globus support." });
      return;
    }
    const parsed = CreateBankSupportConversationBody.safeParse({
      subject: typeof req.body?.subject === "string" ? req.body.subject.trim() : req.body?.subject,
      message: typeof req.body?.message === "string" ? req.body.message.trim() : req.body?.message,
      category: req.body?.category,
      transferReference: typeof req.body?.transferReference === "string" ? req.body.transferReference.trim() : req.body?.transferReference,
    });
    if (!parsed.success) {
      res.status(400).json({ error: "Enter a subject and message within the stated limits." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    const category = parsed.data.category ?? "general";
    const transferReference = parsed.data.transferReference ?? null;
    if (category !== "general" && !hasActiveVaultAccess(user) && !user.supportAccessGranted) {
      res.status(403).json({ error: "Active Private Vault or support access is required for this conversation." });
      return;
    }
    if (category === "transfer") {
      if (!transferReference) {
        res.status(400).json({ error: "Choose the transfer this conversation is about." });
        return;
      }
      const [ownedTransfer] = await db
        .select({ reference: bankTransactionsTable.reference })
        .from(bankTransactionsTable)
        .where(and(
          eq(bankTransactionsTable.reference, transferReference),
          eq(bankTransactionsTable.fromUserId, user.id),
        ))
        .limit(1);
      if (!ownedTransfer) {
        res.status(404).json({ error: "That transfer was not found in your account." });
        return;
      }
    } else if (transferReference) {
      res.status(400).json({ error: "A transfer reference is only valid for transfer support." });
      return;
    }
    const now = new Date();
    const created = await db.transaction(async (tx) => {
      const [conversation] = await tx
        .insert(bankSupportConversationsTable)
        .values({
          userId: user.id,
          subject: parsed.data.subject,
          category,
          transferReference,
          status: "open",
          customerUnread: false,
          adminUnread: true,
          lastMessageAt: now,
          updatedAt: now,
        })
        .returning();
      const [message] = await tx
        .insert(bankSupportMessagesTable)
        .values({
          conversationId: conversation.id,
          senderUserId: user.id,
          senderRole: "customer",
          body: parsed.data.message,
          createdAt: now,
        })
        .returning();
      return { conversation, message };
    });
    res.status(201).json(
      CreateBankSupportConversationResponse.parse({
        conversation: {
          id: created.conversation.id,
          subject: created.conversation.subject,
          status: "open",
          customerUnread: false,
          lastMessagePreview: created.message.body.slice(0, 160),
          lastMessageAt: now.toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      }),
    );
  },
);

router.get(
  "/bank/support/conversations/:conversationId/messages",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to view this support conversation." });
      return;
    }
    const params = ListBankSupportMessagesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "The conversation link is invalid." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    const [conversation] = await db
      .select({ id: bankSupportConversationsTable.id })
      .from(bankSupportConversationsTable)
      .where(
        and(
          eq(bankSupportConversationsTable.id, params.data.conversationId),
          eq(bankSupportConversationsTable.userId, user.id),
        ),
      )
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
      ListBankSupportMessagesResponse.parse({
        messages: messages.map((message) => bankSupportMessageResponse(message, "customer")),
      }),
    );
  },
);

router.post(
  "/bank/support/conversations/:conversationId/messages",
  supportMessageLimiter,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to reply to this support conversation." });
      return;
    }
    const params = SendBankSupportMessageParams.safeParse(req.params);
    const parsed = SendBankSupportMessageBody.safeParse({
      body: typeof req.body?.body === "string" ? req.body.body.trim() : req.body?.body,
    });
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Enter a message of 1 to 4,000 characters." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    const now = new Date();
    const created = await db.transaction(async (tx) => {
      const [conversation] = await tx
        .select({
          id: bankSupportConversationsTable.id,
          category: bankSupportConversationsTable.category,
        })
        .from(bankSupportConversationsTable)
        .where(
          and(
            eq(bankSupportConversationsTable.id, params.data.conversationId),
            eq(bankSupportConversationsTable.userId, user.id),
          ),
        )
        .for("update");
      if (!conversation) return null;
      if (
        conversation.category !== "general" &&
        !hasActiveVaultAccess(user) &&
        !user.transferAccessGranted
      ) {
        return { accessDenied: true as const };
      }
      const [message] = await tx
        .insert(bankSupportMessagesTable)
        .values({
          conversationId: conversation.id,
          senderUserId: user.id,
          senderRole: "customer",
          body: parsed.data.body,
          createdAt: now,
        })
        .returning();
      await tx
        .update(bankSupportConversationsTable)
        .set({
          status: "open",
          customerUnread: false,
          adminUnread: true,
          lastMessageAt: now,
          updatedAt: now,
        })
        .where(eq(bankSupportConversationsTable.id, conversation.id));
      return { message };
    });
    if (!created) {
      res.status(404).json({ error: "That support conversation was not found." });
      return;
    }
    if ("accessDenied" in created) {
      res.status(403).json({ error: "Active Private Vault or support access is required to reply here." });
      return;
    }
    res.status(201).json(
      SendBankSupportMessageResponse.parse({
        message: bankSupportMessageResponse(created.message, "customer"),
      }),
    );
  },
);

router.post(
  "/bank/support/conversations/:conversationId/read",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to update support messages." });
      return;
    }
    const params = MarkBankSupportConversationReadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "The conversation link is invalid." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    const [conversation] = await db
      .update(bankSupportConversationsTable)
      .set({ customerUnread: false, updatedAt: new Date() })
      .where(
        and(
          eq(bankSupportConversationsTable.id, params.data.conversationId),
          eq(bankSupportConversationsTable.userId, user.id),
        ),
      )
      .returning({ id: bankSupportConversationsTable.id });
    if (!conversation) {
      res.status(404).json({ error: "That support conversation was not found." });
      return;
    }
    res.json(MarkBankSupportConversationReadResponse.parse({ markedRead: true }));
  },
);

router.get("/bank/vault/session", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const token = getVaultDeviceCookieToken(req);
  if (!token) {
    res.json(GetBankVaultSessionResponse.parse({ active: false, expiresAt: null }));
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  const expiresAt = await getVaultPasscodeSessionExpiry(user.id, token);
  if (!expiresAt) {
    clearVaultDeviceCookie(res);
    res.json(GetBankVaultSessionResponse.parse({ active: false, expiresAt: null }));
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(
    GetBankVaultSessionResponse.parse({
      active: true,
      expiresAt: expiresAt.toISOString(),
    }),
  );
});

router.post("/bank/vault/session/lock", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const token = req.get("X-Globus-Vault-Session") ?? "";
  if (token) {
    const user = await getOrCreateBankUser(authUserId);
    await revokeVaultPasscodeSession(user.id, token);
  }
  clearVaultDeviceCookie(res);
  res.json(LockBankVaultSessionResponse.parse({ locked: true }));
});

router.post(
  "/bank/vault/subscription/clear-incomplete",
  vaultSubscriptionRequestLimiter,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to manage your Private Vault subscription." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const user = await getOrCreateBankUser(authUserId);
    if (!(await isVaultPasscodeSessionValid(user.id, sessionToken))) {
      res.status(403).json({ error: "Unlock your Private Vault before clearing an unfinished checkout." });
      return;
    }

    const initialClassification = classifyIncompleteVaultAttempt({
      subscriptionStatus: vaultSubscriptionStatus(
        user.vaultSubscriptionStatus,
        user.vaultSubscriptionExpiresAt,
      ),
      paymentStatus: user.vaultSubscriptionPaymentStatus,
      paymentReference: user.vaultSubscriptionPaymentReference,
      paymentVerifiedAt: user.vaultSubscriptionPaymentVerifiedAt,
      autoRenew: user.vaultSubscriptionAutoRenew,
      providerSubscriptionCode: user.vaultPaystackSubscriptionCode,
    });
    let confirmedUnpaidReference: string | null = null;
    if (initialClassification === "protected") {
      res.status(409).json({
        error: "An active or verified Vault subscription cannot be cleared.",
      });
      return;
    }
    if (initialClassification === "verify_with_paystack") {
      const secretKey = getPaystackSecretKey();
      const reference = user.vaultSubscriptionPaymentReference;
      if (!secretKey || !reference) {
        res.status(503).json({
          error: "Payment status cannot be confirmed right now. Your attempt was not changed.",
        });
        return;
      }
      let payment;
      try {
        payment = await verifyPaystackVaultCheckout({ secretKey, reference });
      } catch (error) {
        req.log.error({ error }, "Could not verify an unfinished Vault checkout before clearing it");
        res.status(503).json({
          error: "Payment status cannot be confirmed right now. Your attempt was not changed.",
        });
        return;
      }
      if (
        payment.amount !== Number(user.vaultSubscriptionAmountMinor) ||
        payment.currency !== "NGN" ||
        payment.metadata?.userId !== user.id ||
        payment.metadata?.planCode !== user.vaultSubscriptionPlan ||
        String(payment.metadata?.autoRenew) !== String(user.vaultSubscriptionAutoRenew)
      ) {
        req.log.warn({ reference }, "Vault checkout details did not match before cleanup");
        res.status(409).json({
          error: "The checkout could not be safely matched to this account. Your attempt was not changed.",
        });
        return;
      }
      if (!isTerminalUnpaidPaystackStatus(payment.status)) {
        res.status(409).json({
          error: payment.status === "success"
            ? "Paystack reports a completed payment. Verify it to activate Vault access."
            : "Paystack is still processing this payment. Check again before clearing it.",
        });
        return;
      }
      confirmedUnpaidReference = reference;
    } else if (initialClassification === "none") {
      res.json(
        ClearIncompleteBankVaultSubscriptionResponse.parse({
          cleared: false,
          subscriptionStatus: "inactive",
          paymentStatus: "none",
        }),
      );
      return;
    }

    const clearResult = await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, user.id))
        .for("update");
      if (!lockedUser) return "missing" as const;
      if (
        confirmedUnpaidReference &&
        lockedUser.vaultSubscriptionPaymentReference !== confirmedUnpaidReference
      ) {
        return "changed" as const;
      }
      const classification = classifyIncompleteVaultAttempt({
        subscriptionStatus: vaultSubscriptionStatus(
          lockedUser.vaultSubscriptionStatus,
          lockedUser.vaultSubscriptionExpiresAt,
        ),
        paymentStatus: lockedUser.vaultSubscriptionPaymentStatus,
        paymentReference: lockedUser.vaultSubscriptionPaymentReference,
        paymentVerifiedAt: lockedUser.vaultSubscriptionPaymentVerifiedAt,
        autoRenew: lockedUser.vaultSubscriptionAutoRenew,
        providerSubscriptionCode: lockedUser.vaultPaystackSubscriptionCode,
      });
      const paystackFailureWasConfirmed =
        classification === "verify_with_paystack" &&
        confirmedUnpaidReference === lockedUser.vaultSubscriptionPaymentReference;
      if (
        classification === "protected" ||
        (classification === "verify_with_paystack" && !paystackFailureWasConfirmed) ||
        classification === "none"
      ) {
        return "changed" as const;
      }
      const now = new Date();
      await tx
        .update(bankUsersTable)
        .set({
          vaultSubscriptionStatus: "inactive",
          vaultSubscriptionRequestedAt: null,
          vaultSubscriptionReviewedAt: null,
          vaultSubscriptionReviewedByUserId: null,
          vaultSubscriptionReason: null,
          vaultSubscriptionExpiresAt: null,
          vaultSubscriptionPlan: null,
          vaultSubscriptionAmountMinor: null,
          vaultSubscriptionPaymentReference: null,
          vaultSubscriptionPaymentStatus: "none",
          vaultSubscriptionPaymentInitializedAt: null,
          vaultSubscriptionPaymentVerifiedAt: null,
          vaultSubscriptionAutoRenew: false,
          vaultPaystackPlanCode: null,
          vaultPaystackSubscriptionCode: null,
          vaultPaystackCustomerCode: null,
          updatedAt: now,
        })
        .where(eq(bankUsersTable.id, user.id));
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "clear_incomplete_private_vault_subscription",
        reason: "Member cleared an unfinished, unpaid Private Vault subscription attempt.",
      });
      return "cleared" as const;
    });
    if (clearResult === "missing") {
      res.status(404).json({ error: "The Globus account could not be found." });
      return;
    }
    if (clearResult === "changed") {
      res.status(409).json({
        error: "The subscription changed while it was being checked. Refresh its status and try again.",
      });
      return;
    }
    res.json(
      ClearIncompleteBankVaultSubscriptionResponse.parse({
        cleared: true,
        subscriptionStatus: "inactive",
        paymentStatus: "none",
      }),
    );
  },
);
router.post("/bank/me/password-reset/complete", passwordResetLimiter, async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const parsed = CompleteRequiredPasswordResetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let identity;
  try {
    identity = await clerkClient.users.getUser(userId);
  } catch {
    res.status(404).json({ error: "The account could not be verified." });
    return;
  }
  const resetRequiredAt = identity.publicMetadata?.globusPasswordResetRequiredAt;
  if (typeof resetRequiredAt !== "string" || !resetRequiredAt) {
    res.json(CompleteRequiredPasswordResetResponse.parse({ completed: false }));
    return;
  }

  try {
    await clerkClient.users.updateUser(userId, {
      password: parsed.data.newPassword,
      signOutOfOtherSessions: true,
    });
    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: { globusPasswordResetRequiredAt: null },
    });
    setPasswordResetCache(userId, false);
  } catch {
    res.status(400).json({
      error: "The new password could not be saved. Choose a different password and try again.",
    });
    return;
  }

  res.json(CompleteRequiredPasswordResetResponse.parse({ completed: true }));
});

router.get("/bank/me", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const user = await getOrCreateBankUser(userId);
  const [accountStatus, operationEligibility, accountTier] = await Promise.all([
    getEffectiveBankAccountStatus(
      user.id,
      user.accountStatus as "active" | "restricted" | "suspended",
    ),
    getBankOperationEligibility(
      user.id,
      user.accountStatus as "active" | "restricted" | "suspended",
    ),
    getEffectiveAccountTier(user),
  ]);
  res.json(
    GetBankProfileResponse.parse({
      id: user.id,
      email: user.email,
      customerId: user.customerId,
      firstName: user.firstName,
      lastName: user.lastName,
       address: user.address,
      profileSetupComplete: Boolean(user.profileSetupCompletedAt),
      transferAccessGranted: user.transferAccessGranted,
      phone: user.phone,
      country: user.country,
      cityOfOrigin: user.cityOfOrigin,
      dateOfBirth: user.dateOfBirth,
      occupation: user.occupation,
      transactionPinConfigured: !!user.transactionPinHash,
      accountStatus,
      ...operationEligibility,
      accountTier,
      createdAt: user.createdAt.toISOString(),
    }),
  );
});

router.put("/bank/signup-profile", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const parsed = SaveSignupProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const firstName = normalizeRequiredProfileName(parsed.data.firstName);
  const lastName = normalizeRequiredProfileName(parsed.data.lastName);
  if (!firstName || !lastName) {
    res.status(400).json({ error: "Enter your first and last name to save your profile." });
    return;
  }

  const currentUser = await getOrCreateBankUser(authUserId);
  if (currentUser.profileSetupCompletedAt) {
    res.status(409).json({
      error: "Initial profile setup is complete. Contact an administrator to update personal details.",
    });
    return;
  }
  const optionalDetails = sanitizeSignupProfileDetails(parsed.data);
  const [user] = await db
    .update(bankUsersTable)
    .set({
      firstName,
      lastName,
      profileSetupCompletedAt: new Date(),
      ...optionalDetails,
      ...(parsed.data.acceptedTerms === true
        ? { acceptedTermsAt: new Date() }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(
      eq(bankUsersTable.id, currentUser.id),
      isNull(bankUsersTable.profileSetupCompletedAt),
    ))
    .returning();
  if (!user) {
    res.status(409).json({
      error: "Initial profile setup has already been completed.",
    });
    return;
  }

  const [accountStatus, operationEligibility, accountTier] = await Promise.all([
    getEffectiveBankAccountStatus(
      user.id,
      user.accountStatus as "active" | "restricted" | "suspended",
    ),
    getBankOperationEligibility(
      user.id,
      user.accountStatus as "active" | "restricted" | "suspended",
    ),
    getEffectiveAccountTier(user),
  ]);

  res.json(
    GetBankProfileResponse.parse({
      id: user.id,
      email: user.email,
      customerId: user.customerId,
      firstName: user.firstName,
      lastName: user.lastName,
       address: user.address,
      profileSetupComplete: Boolean(user.profileSetupCompletedAt),
      transferAccessGranted: user.transferAccessGranted,
      phone: user.phone,
      country: user.country,
      cityOfOrigin: user.cityOfOrigin,
      dateOfBirth: user.dateOfBirth,
      occupation: user.occupation,
      transactionPinConfigured: !!user.transactionPinHash,
      accountStatus,
      ...operationEligibility,
      accountTier,
      createdAt: user.createdAt.toISOString(),
    }),
  );
});

router.get("/bank/receipt-preferences", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  res.json(
    GetBankReceiptPreferencesResponse.parse(
      bankReceiptPreferencesPayload(user),
    ),
  );
});

router.patch("/bank/receipt-preferences", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const parsed = UpdateBankReceiptPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  const [updated] = await db
    .update(bankUsersTable)
    .set({
      preferredReceiptTemplate: parsed.data.preferredTemplate,
      updatedAt: new Date(),
    })
    .where(eq(bankUsersTable.id, user.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "The customer profile could not be found." });
    return;
  }
  res.json(
    UpdateBankReceiptPreferencesResponse.parse(
      bankReceiptPreferencesPayload(updated),
    ),
  );
});

router.get("/bank/dashboard", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const profile = await getOrCreateBankUser(authUserId);
  const [
    wallets,
    recentTransactions,
    accountStatus,
    operationEligibility,
    effectiveAccountTier,
  ] = await Promise.all([
    getWalletsForUser(profile.id),
    getRecentTransactions(profile.id),
    getEffectiveBankAccountStatus(
      profile.id,
      profile.accountStatus as "active" | "restricted" | "suspended",
    ),
    getBankOperationEligibility(
      profile.id,
      profile.accountStatus as "active" | "restricted" | "suspended",
    ),
    getEffectiveAccountTier(profile),
  ]);
  const accessSource = operationEligibility.vaultAccessSource;

  res.json(
    GetBankDashboardResponse.parse({
      profile: {
        id: profile.id,
        email: profile.email,
        customerId: profile.customerId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        address: profile.address,
        profileSetupComplete: Boolean(profile.profileSetupCompletedAt),
        transferAccessGranted: profile.transferAccessGranted,
        phone: profile.phone,
        country: profile.country,
        cityOfOrigin: profile.cityOfOrigin,
        dateOfBirth: profile.dateOfBirth,
        occupation: profile.occupation,
        transactionPinConfigured: !!profile.transactionPinHash,
        accountStatus,
        ...operationEligibility,
        accountTier: effectiveAccountTier,
        testingMode: isVaultTestingMode(
          accessSource,
          profile.testingModeDisabled,
        ),
        vaultAccessActive: accessSource !== "none",
        vaultAccessSource: accessSource,
        createdAt: profile.createdAt.toISOString(),
      },
      wallets,
      recentTransactions,
      referenceCurrency: "USD",
      internalLedger: true,
    }),
  );
});

router.get("/bank/wallets", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const user = await getOrCreateBankUser(authUserId);
  res.json(ListBankWalletsResponse.parse(await getWalletsForUser(user.id)));
});

router.get("/bank/saved-payment-methods", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  const destinations = await db
    .select()
    .from(bankSavedPaymentMethodsTable)
    .where(
      and(
        eq(bankSavedPaymentMethodsTable.userId, user.id),
        isNull(bankSavedPaymentMethodsTable.deletedAt),
      ),
    )
    .orderBy(desc(bankSavedPaymentMethodsTable.createdAt))
    .limit(20);
  res.json(
    ListBankSavedPaymentMethodsResponse.parse(
      destinations.map((destination) => ({
        id: destination.id,
        method: destination.method,
        ...(destination.cardBrand ? { cardBrand: destination.cardBrand } : {}),
        ...(destination.bankName ? { bankName: destination.bankName } : {}),
        ...(destination.accountHolder
          ? { accountHolder: destination.accountHolder }
          : {}),
        ...(destination.country ? { country: destination.country } : {}),
        lastFour: destination.lastFour,
        createdAt: destination.createdAt.toISOString(),
      })),
    ),
  );
});

router.post(
  "/bank/saved-payment-methods",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const parsed = CreateBankSavedPaymentMethodBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (user.accountStatus !== "active" || !user.acceptedTermsAt) {
      res.status(409).json({ error: "Complete account setup before saving a payment method." });
      return;
    }
    if (!(await hasActiveVaultAccess(user))) {
      res.status(403).json({ error: "Active Private Vault access is required to save payment methods." });
      return;
    }

    const method = parsed.data.method;
    let lastFour = "";
    let accountNumberEncrypted: string | null = null;
    if (
      method === "bank_card" &&
      (!parsed.data.cardBrand ||
        !parsed.data.lastFour ||
        !/^[0-9]{4}$/.test(parsed.data.lastFour.trim()))
    ) {
      res.status(400).json({
        error: "Choose a card brand and enter only the card's last four digits.",
      });
      return;
    }
    if (method === "bank_card") {
      lastFour = parsed.data.lastFour!.trim();
    } else {
      if (
        !parsed.data.bankName?.trim() ||
        !parsed.data.accountHolder?.trim() ||
        !parsed.data.bankAccountNumber?.trim()
      ) {
        res.status(400).json({
          error: "Enter the bank, account holder, and full account number or IBAN.",
        });
        return;
      }
      let normalizedAccountNumber: string;
      try {
        normalizedAccountNumber = normalizeBankAccountNumber(
          parsed.data.bankAccountNumber,
        );
      } catch (error) {
        res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Enter a valid full bank account number or IBAN.",
        });
        return;
      }
      try {
        accountNumberEncrypted = encryptBankAccountNumber(
          normalizedAccountNumber,
        );
      } catch (error) {
        if (error instanceof BankDetailsEncryptionUnavailableError) {
          req.log.error({ error: error.message }, "Bank account encryption is unavailable");
          res.status(503).json({
            error: "Secure bank-account storage is temporarily unavailable.",
          });
          return;
        }
        throw error;
      }
      lastFour = normalizedAccountNumber.slice(-4);
    }
    const saved = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`saved-payment-methods:${user.id}`})::bigint)`,
      );
      const [activeCount] = await tx
        .select({ total: count() })
        .from(bankSavedPaymentMethodsTable)
        .where(
          and(
            eq(bankSavedPaymentMethodsTable.userId, user.id),
            isNull(bankSavedPaymentMethodsTable.deletedAt),
          ),
        );
      if ((activeCount?.total ?? 0) >= 10) return null;

      const [row] = await tx
        .insert(bankSavedPaymentMethodsTable)
        .values({
          userId: user.id,
          method,
          cardBrand: method === "bank_card" ? parsed.data.cardBrand ?? null : null,
          bankName:
            method === "bank_transfer" ? parsed.data.bankName?.trim() ?? null : null,
          accountHolder:
            method === "bank_transfer"
              ? parsed.data.accountHolder?.trim() ?? null
              : null,
          accountNumberEncrypted,
          country:
            method === "bank_transfer" ? parsed.data.country?.trim() || null : null,
          lastFour,
        })
        .returning();
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "save_payment_method",
        reason:
          method === "bank_card"
            ? `Member saved a masked card reference ending ${lastFour}.`
            : `Member saved an encrypted bank-account reference ending ${lastFour}.`,
      });
      return row;
    });
    if (!saved) {
      res.status(409).json({ error: "You can save up to 10 payment methods." });
      return;
    }

    res.status(201).json(
      CreateBankSavedPaymentMethodResponse.parse({
        id: saved.id,
        method: saved.method,
        ...(saved.cardBrand ? { cardBrand: saved.cardBrand } : {}),
        ...(saved.bankName ? { bankName: saved.bankName } : {}),
        ...(saved.accountHolder ? { accountHolder: saved.accountHolder } : {}),
        ...(saved.country ? { country: saved.country } : {}),
        lastFour: saved.lastFour,
        createdAt: saved.createdAt.toISOString(),
      }),
    );
  },
);

router.delete(
  "/bank/saved-payment-methods/:paymentMethodId",
  async (req, res): Promise<void> => {
    const params = DeleteBankSavedPaymentMethodParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    const removed = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(bankSavedPaymentMethodsTable)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(bankSavedPaymentMethodsTable.id, params.data.paymentMethodId),
            eq(bankSavedPaymentMethodsTable.userId, user.id),
            isNull(bankSavedPaymentMethodsTable.deletedAt),
          ),
        )
        .returning({
          id: bankSavedPaymentMethodsTable.id,
          lastFour: bankSavedPaymentMethodsTable.lastFour,
        });
      if (!row) return null;
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "remove_payment_method",
        reason: `Member removed a saved masked payment method ending ${row.lastFour}.`,
      });
      return row;
    });
    if (!removed) {
      res.status(404).json({ error: "Saved payment method not found." });
      return;
    }
    res.json(DeleteBankSavedPaymentMethodResponse.parse({ id: removed.id, deleted: true }));
  },
);

router.get("/bank/transactions", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const user = await getOrCreateBankUser(authUserId);
  const parsed = ListBankTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const transactions = await listUserTransactions(user.id, {
    currency: parsed.data.currency,
    status: parsed.data.status,
    search: parsed.data.search,
    limit: parsed.data.limit ?? 25,
  });

  res.json(ListBankTransactionsResponse.parse(transactions));
});

router.put("/bank/profile", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const parsed = UpdateBankProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const firstName = normalizeRequiredProfileName(parsed.data.firstName);
  const lastName = normalizeRequiredProfileName(parsed.data.lastName);
  if (!firstName || !lastName) {
    res.status(400).json({ error: "Enter both your first and last name to update your profile." });
    return;
  }

  const currentUser = await getOrCreateBankUser(authUserId);
  if (currentUser.profileSetupCompletedAt) {
    res.status(403).json({
      error: "Personal details are read-only after initial setup. Contact an administrator to request a change.",
    });
    return;
  }
  const profileUpdates = {
    firstName,
    lastName,
    profileSetupCompletedAt: new Date(),
    ...sanitizeBankProfileUpdateDetails(parsed.data),
    ...(parsed.data.acceptedTerms === true
      ? { acceptedTermsAt: new Date() }
      : {}),
    updatedAt: new Date(),
  };
  const [user] = await db
    .update(bankUsersTable)
    .set(profileUpdates)
    .where(and(
      eq(bankUsersTable.id, currentUser.id),
      isNull(bankUsersTable.profileSetupCompletedAt),
    ))
    .returning();
  if (!user) {
    res.status(403).json({
      error: "Personal details are read-only after initial setup. Contact an administrator to request a change.",
    });
    return;
  }

  const [accountStatus, operationEligibility] = await Promise.all([
    getEffectiveBankAccountStatus(
      user.id,
      user.accountStatus as "active" | "restricted" | "suspended",
    ),
    getBankOperationEligibility(
      user.id,
      user.accountStatus as "active" | "restricted" | "suspended",
    ),
  ]);

  res.json(
    UpdateBankProfileResponse.parse({
      id: user.id,
      email: user.email,
      customerId: user.customerId,
      firstName: user.firstName,
      lastName: user.lastName,
      address: user.address,
      profileSetupComplete: Boolean(user.profileSetupCompletedAt),
      transferAccessGranted: user.transferAccessGranted,
      phone: user.phone,
      country: user.country,
      cityOfOrigin: user.cityOfOrigin,
      dateOfBirth: user.dateOfBirth,
      occupation: user.occupation,
      transactionPinConfigured: !!user.transactionPinHash,
      accountStatus,
      ...operationEligibility,
      createdAt: user.createdAt.toISOString(),
    }),
  );
});

router.put("/bank/transaction-pin", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const parsed = UpdateTransactionPinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  const result = await saveTransactionPin(
    user.id,
    parsed.data.pin,
    parsed.data.currentPin,
  );
  if (result === "updated") {
    res.json(UpdateTransactionPinResponse.parse({ configured: true }));
    return;
  }
  if (result === "current_pin_required") {
    res.status(400).json({ error: "Enter your current transaction PIN to change it." });
    return;
  }
  if (result === "locked") {
    res.status(429).json({
      error: "Too many incorrect PIN attempts. Try again in 15 minutes.",
    });
    return;
  }
  if (result === "invalid") {
    res.status(403).json({ error: "The current transaction PIN is incorrect." });
    return;
  }
  res.status(404).json({ error: "The account for this transaction was not found." });
});

router.post("/bank/transfers", (_req, res): void => {
  res.status(410).json({
    error: "Member-to-member transfers are no longer available.",
  });
});

router.get(
  "/bank/exchange-rates/quote",
  requireSignedIn,
  exchangeRateQuoteLimiter,
  async (req, res): Promise<void> => {
    const parsed = GetBankExchangeRateQuoteQueryParams.safeParse({
      sourceCurrency: req.query.sourceCurrency,
      destinationCurrency: req.query.destinationCurrency,
    });
    if (!parsed.success) {
      res.status(400).json({ error: "Choose valid source and destination currencies." });
      return;
    }

    const { sourceCurrency, destinationCurrency } = parsed.data;
    if (sourceCurrency === destinationCurrency) {
      res.json(
        GetBankExchangeRateQuoteResponse.parse({
          sourceCurrency,
          destinationCurrency,
          rate: "1.0000000000",
          provider: "Globus",
          checkedAt: new Date().toISOString(),
        }),
      );
      return;
    }

    try {
      const quote = await getExchangeRate(sourceCurrency, destinationCurrency);
      res.json(
        GetBankExchangeRateQuoteResponse.parse({
          sourceCurrency,
          destinationCurrency,
          rate: quote.rate,
          provider: quote.provider,
          checkedAt: quote.checkedAt.toISOString(),
        }),
      );
    } catch {
      req.log.warn(
        { sourceCurrency, destinationCurrency },
        "Frankfurter and Grey rate quotes unavailable",
      );
      res.status(503).json({
        error: `No rate source could provide a ${sourceCurrency} to ${destinationCurrency} quote. Choose another supported currency pair.`,
      });
    }
  },
);

router.get("/bank/exchange-rates", async (req, res): Promise<void> => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const rates = await db
    .select()
    .from(bankExchangeRatesTable)
    .orderBy(
      asc(bankExchangeRatesTable.sourceCurrency),
      asc(bankExchangeRatesTable.destinationCurrency),
    );
  res.json(
    ListBankExchangeRatesResponse.parse(
      rates.map((rate) => ({
        sourceCurrency: rate.sourceCurrency,
        destinationCurrency: rate.destinationCurrency,
        rate: rate.rate,
        updatedAt: rate.updatedAt.toISOString(),
      })),
    ),
  );
});

router.get("/bank/international-transfer-requests", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  const records = await db
    .select({
      request: bankInternationalTransferRequestsTable,
      transaction: bankTransactionsTable,
    })
    .from(bankInternationalTransferRequestsTable)
    .innerJoin(
      bankTransactionsTable,
      eq(
        bankTransactionsTable.id,
        bankInternationalTransferRequestsTable.transactionId,
      ),
    )
    .where(eq(bankInternationalTransferRequestsTable.userId, user.id))
    .orderBy(desc(bankInternationalTransferRequestsTable.createdAt))
    .limit(50);
  res.json(
    ListInternationalTransferRequestsResponse.parse(
      records.map(({ request, transaction }) =>
        internationalTransferRequestResponse(request, transaction),
      ),
    ),
  );
});

router.post(
  "/bank/international-transfer-requests",
  transferSubmissionLimiter,
  async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const parsed = CreateInternationalTransferRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const sender = await getOrCreateBankUser(authUserId);
  if (sender.accountStatus !== "active") {
    res.status(409).json({ error: "This account is currently restricted." });
    return;
  }
  let amountMinor: bigint;
  try {
    amountMinor = parseAmountToMinor(parsed.data.amount);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Enter a valid transfer amount.",
    });
    return;
  }
  if (amountMinor <= 0n) {
    res.status(400).json({ error: "The transfer amount must be greater than zero." });
    return;
  }
  if (parsed.data.transferType === "local_routing" && !parsed.data.routingCode?.trim()) {
    res.status(400).json({ error: "Enter the local bank routing code." });
    return;
  }
  if (
    parsed.data.transferType === "international_wire" &&
    !/^[A-Za-z0-9]{8}(?:[A-Za-z0-9]{3})?$/.test(parsed.data.swiftBic?.trim() ?? "")
  ) {
    res.status(400).json({ error: "Enter a valid 8- or 11-character SWIFT/BIC code." });
    return;
  }
  const accountNumber = parsed.data.recipientAccountNumber
    .replace(/\s+/g, "")
    .toUpperCase();
  const requestedRecipientEmail =
    parsed.data.recipientEmail?.trim().toLowerCase() ?? "";
  const recipientEmailAlertsEnabled = requestedRecipientEmail
    ? await vaultTransferEmailAlertsEnabled(sender)
    : false;
  if (
    requestedRecipientEmail &&
    !recipientEmailAlertsEnabled &&
    !sender.transferAccessGranted
  ) {
    res.status(409).json({
      error: "Recipient email alerts are turned off. Enable them in your Private Vault before adding an email.",
    });
    return;
  }
  const recipientEmail = recipientEmailAlertsEnabled
    ? requestedRecipientEmail
    : "";
  let recipientEmailEncrypted: string | null = null;
  let recipientEmailNotificationSkipped =
    Boolean(requestedRecipientEmail) && !recipientEmailAlertsEnabled;
  if (recipientEmail) {
    try {
      recipientEmailEncrypted = encryptPrivateData(
        recipientEmail,
        "transfer-recipient-email",
      );
    } catch {
      req.log.warn(
        "Recipient email could not be secured; transfer was not submitted",
      );
      res.status(503).json({
        error:
          "Recipient email delivery is temporarily unavailable. No transfer was submitted; try again later.",
      });
      return;
    }
  }
  const transactionPinResult = await verifyTransactionPin(
    sender.id,
    parsed.data.transactionPin,
  );
  if (transactionPinResult !== "valid") {
    respondWithTransactionPinError(res, transactionPinResult);
    return;
  }

  let rate = "1.0000000000";
  let rateUpdatedAt = new Date();
  if (parsed.data.sourceCurrency !== parsed.data.destinationCurrency) {
    try {
      const quote = await getExchangeRate(
        parsed.data.sourceCurrency,
        parsed.data.destinationCurrency,
      );
      rate = quote.rate;
      rateUpdatedAt = quote.checkedAt;
    } catch {
      res.status(503).json({
        error: `No rate source could provide a ${parsed.data.sourceCurrency} to ${parsed.data.destinationCurrency} quote. The transfer was not submitted.`,
      });
      return;
    }
  }
  if (
    parsed.data.expectedExchangeRate !== undefined &&
    !conversionRatesMatch(parsed.data.expectedExchangeRate, rate)
  ) {
    res.status(409).json({
      error: "The conversion rate changed. Review the updated quote and confirm again.",
    });
    return;
  }

  const routingCode = parsed.data.routingCode?.trim().toUpperCase() || null;
  const swiftBic = parsed.data.swiftBic?.trim().toUpperCase() || null;
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
      if (
        duplicate.initiatedByUserId !== sender.id ||
        duplicate.type !== "external_transfer"
      ) {
        return { error: "That request reference is already in use." };
      }
      const [existingRequest] = await tx
        .select()
        .from(bankInternationalTransferRequestsTable)
        .where(
          eq(
            bankInternationalTransferRequestsTable.transactionId,
            duplicate.id,
          ),
        )
        .limit(1);
      return existingRequest
        ? { request: existingRequest, transaction: duplicate, notifications: [] }
        : { error: "The existing request record could not be loaded." };
    }

    const [lockedSender] = await tx
      .select()
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, sender.id))
      .for("update");
    if (!lockedSender) return { error: "The Globus account could not be found." };
    if (
      recipientEmailEncrypted &&
      !(await vaultTransferEmailAlertsEnabled(lockedSender, tx))
    ) {
      recipientEmailEncrypted = null;
      recipientEmailNotificationSkipped = true;
    }
    if (lockedSender.accountStatus !== "active") {
      return { error: "This account is currently restricted." };
    }

    let destinationAmountMinor: bigint;
    try {
      destinationAmountMinor = convertMinorAmount(amountMinor, rate, parsed.data.destinationCurrency);
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "The destination amount could not be calculated.",
      };
    }
    if (destinationAmountMinor <= 0n) {
      return { error: "The converted amount is below the minimum supported amount." };
    }

    const wallet = await userWallet(tx, sender.id, parsed.data.sourceCurrency);
    if (!wallet || wallet.status !== "active") {
      return { error: "An active wallet for the selected source currency is unavailable." };
    }
    const restrictionError = await bankOperationRestrictionError(tx, {
      userId: sender.id,
      walletId: wallet.id,
      operation: "outgoing_transfer",
      bypassOutgoingTransferRestriction: lockedSender.transferAccessGranted,
    });
    if (restrictionError) return { error: restrictionError };
    if (
      !isOutgoingTransferEnabled(
        wallet.transfersEnabled,
        lockedSender.transferAccessGranted,
      )
    ) {
      return { error: "Outgoing transfers are disabled for this wallet in your private vault." };
    }
    const [lockedWallet] = await tx
      .select()
      .from(bankWalletsTable)
      .where(and(
        eq(bankWalletsTable.id, wallet.id),
        eq(bankWalletsTable.userId, sender.id),
      ))
      .for("update");
    if (!lockedWallet || lockedWallet.status !== "active") {
      return { error: "The selected wallet is unavailable or frozen." };
    }
    if (
      !isOutgoingTransferEnabled(
        lockedWallet.transfersEnabled,
        lockedSender.transferAccessGranted,
      )
    ) {
      return { error: "Outgoing transfers are disabled for this wallet in your private vault." };
    }
    const commitRestrictionError = await bankOperationRestrictionError(tx, {
      userId: sender.id,
      walletId: lockedWallet.id,
      operation: "outgoing_transfer",
      bypassOutgoingTransferRestriction: lockedSender.transferAccessGranted,
    });
    if (commitRestrictionError) return { error: commitRestrictionError };
    const available = await balanceForWallet(tx, lockedWallet.id);
    const reserved = await reservedForWallet(tx, lockedWallet.id);
    if (available - reserved < amountMinor) {
      return { error: "There is not enough available ledger balance for this request." };
    }

    const status = resolveFutureTransferStatus(
      lockedWallet.futureTransferMode,
      await hasActiveVaultAccess(lockedSender, tx),
    );
    const reference = createReference();
    const conversionSummary = `${formatMinorAmount(amountMinor)} ${parsed.data.sourceCurrency} converted to ${formatMinorAmount(destinationAmountMinor, parsed.data.destinationCurrency)} ${parsed.data.destinationCurrency} at ${rate}`;
    const [transaction] = await tx
      .insert(bankTransactionsTable)
      .values(withCustomerReceiptTemplate({
        reference,
        idempotencyKey: parsed.data.idempotencyKey,
        initiatedByUserId: sender.id,
        fromUserId: sender.id,
        fromWalletId: lockedWallet.id,
        type: "external_transfer",
        status,
        currency: parsed.data.sourceCurrency,
        amountMinor,
        feeMinor: 0n,
        counterparty: `${parsed.data.recipientAccountName.trim()} · ${parsed.data.recipientBank.trim()} · ****${accountNumber.slice(-4)} · ${parsed.data.destinationCountry.trim()}${routingCode ? ` · Routing ${routingCode}` : ""}${swiftBic ? ` · SWIFT/BIC ${swiftBic}` : ""}`,
        description: `${parsed.data.transferType === "local_routing" ? "Local routing" : "International wire"} transfer${parsed.data.remark?.trim() ? ` · ${parsed.data.remark.trim()}` : ""} · ${conversionSummary}`,
        mode: "internal_ledger",
      }, lockedSender.preferredReceiptTemplate))
      .returning();
    const [request] = await tx
      .insert(bankInternationalTransferRequestsTable)
      .values({
        transactionId: transaction.id,
        transferType: parsed.data.transferType,
        userId: sender.id,
        sourceWalletId: wallet.id,
        sourceCurrency: parsed.data.sourceCurrency,
        sourceAmountMinor: amountMinor,
        destinationCurrency: parsed.data.destinationCurrency,
        destinationAmountMinor,
        exchangeRate: rate,
        rateUpdatedAt,
        destinationCountry: parsed.data.destinationCountry.trim(),
        recipientBank: parsed.data.recipientBank.trim(),
        routingCode,
        swiftBic,
        senderName:
          [lockedSender.firstName, lockedSender.lastName].filter(Boolean).join(" ") ||
          "Globus member",
        recipientAccountName: parsed.data.recipientAccountName.trim(),
        recipientAccountLast4: accountNumber.slice(-4),
        recipientEmailEncrypted,
        remark: parsed.data.remark?.trim() ?? "",
      })
      .returning();
    if (status === "completed") {
      await tx.insert(bankLedgerEntriesTable).values([
        {
          transactionId: transaction.id,
          walletId: lockedWallet.id,
          accountCode: `wallet:${lockedWallet.id}`,
          currency: parsed.data.sourceCurrency,
          side: "debit",
          amountMinor,
        },
        {
          transactionId: transaction.id,
          accountCode: `internal:transfer-clearing:${parsed.data.sourceCurrency}`,
          currency: parsed.data.sourceCurrency,
          side: "credit",
          amountMinor,
        },
      ]);
    }
    const notificationTitle =
      status === "completed"
        ? "Transfer recorded"
        : status === "failed"
          ? "Transfer not processed"
          : "Transfer sent for review";
    const notificationBody =
      status === "completed"
        ? `${formatMinorAmount(amountMinor, parsed.data.sourceCurrency)} ${parsed.data.sourceCurrency} was recorded in Globus.`
        : status === "failed"
          ? "This wallet is configured to fail future transfers. No wallet balance changed."
          : "Your transfer is pending review. No wallet balance has changed.";
    const senderNotification = await storeNotification(tx, {
      userId: sender.id,
      category: "transfer",
      title: notificationTitle,
      body: notificationBody,
      reference,
    });
    const notifications = [senderNotification];
    const recipientUsers = recipientEmailEncrypted
      ? await tx
          .select({ id: bankUsersTable.id })
          .from(bankUsersTable)
          .where(sql`lower(${bankUsersTable.email}) = ${recipientEmail}`)
          .limit(1)
      : [];
    if (recipientUsers[0] && recipientUsers[0].id !== sender.id) {
      notifications.push(
        await storeNotification(tx, {
          userId: recipientUsers[0].id,
          category: "transfer",
          title: "Transfer notice",
          body: `${formatMinorAmount(destinationAmountMinor, parsed.data.destinationCurrency)} ${parsed.data.destinationCurrency} was referenced for you in a Globus transfer record. This is not confirmation of an outside bank payment.`,
          reference,
        }),
      );
    }
    return { request, transaction, notifications };
  });

  if ("error" in result) {
    res.status(409).json({ error: result.error });
    return;
  }
  for (const notification of result.notifications) {
    void sendPushToUser(notification.userId, notification);
  }
  if (result.request.recipientEmailEncrypted) {
    const emailSent = await notifyTransferRecipient({
      notificationId: result.notifications[0]?.id,
      senderUserId: sender.id,
      encryptedEmail: result.request.recipientEmailEncrypted,
      recipientName: result.request.recipientAccountName,
      bankName: result.request.recipientBank,
      destinationCountry: result.request.destinationCountry,
      amount: formatMinorAmount(result.request.destinationAmountMinor, result.request.destinationCurrency),
      currency: result.request.destinationCurrency,
      reference: result.transaction.reference,
      status: result.transaction.status,
      createdAt: result.transaction.createdAt,
    });
    if (!emailSent) {
      recipientEmailNotificationSkipped = true;
      req.log.warn({ reference: result.transaction.reference }, "Transfer alert email could not be delivered");
    }
  }
  res.status(201).json(
    CreateInternationalTransferRequestResponse.parse(
      internationalTransferRequestResponse(
        result.request,
        result.transaction,
        recipientEmailNotificationSkipped,
      ),
    ),
  );
  },
);

router.post("/bank/external-transfers", async (req, res): Promise<void> => {
  if (rejectExternalTransfer(res, "payout")) return;
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const parsed = CreateExternalTransferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const recipientName = parsed.data.recipientName.trim();
  const destinationCountry = parsed.data.destinationCountry.trim();
  const bankName = parsed.data.bankName.trim();
  const accountNumberLast4 = parsed.data.accountNumberLast4.trim().toUpperCase();
  if (
    !recipientName ||
    !destinationCountry ||
    !bankName ||
    !/^[A-Z0-9]{4}$/.test(accountNumberLast4)
  ) {
    res.status(400).json({
      error: "Enter the recipient, destination country, bank name, and last four account characters.",
    });
    return;
  }

  const sender = await getOrCreateBankUser(authUserId);
  const userId = sender.id;
  if (sender.accountStatus !== "active") {
    res.status(409).json({ error: "This account is currently restricted." });
    return;
  }
  let amountMinor: bigint;
  try {
    amountMinor = parseAmountToMinor(parsed.data.amount);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Enter a valid transfer amount.",
    });
    return;
  }
  if (amountMinor <= 0n) {
    res.status(400).json({ error: "The transfer amount must be greater than zero." });
    return;
  }

  const transfer = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${parsed.data.idempotencyKey})::bigint)`,
    );
    const [duplicate] = await tx
      .select()
      .from(bankTransactionsTable)
      .where(eq(bankTransactionsTable.idempotencyKey, parsed.data.idempotencyKey))
      .limit(1);
    if (duplicate) {
      return duplicate.initiatedByUserId === userId
        ? { transaction: duplicate }
        : { error: "That request reference is already in use." };
    }

    const wallet = await userWallet(tx, userId, parsed.data.currency);
    if (!wallet) {
      return { error: "A wallet for the selected currency is unavailable." };
    }
    await tx
      .select({ id: bankWalletsTable.id })
      .from(bankWalletsTable)
      .where(eq(bankWalletsTable.id, wallet.id))
      .for("update");

    if ((await balanceForWallet(tx, wallet.id)) < amountMinor) {
      return { error: "There are not enough simulated funds available." };
    }

    const [transaction] = await tx
      .insert(bankTransactionsTable)
      .values(withCustomerReceiptTemplate({
        reference: createReference(),
        idempotencyKey: parsed.data.idempotencyKey,
        initiatedByUserId: userId,
        fromUserId: userId,
        fromWalletId: wallet.id,
        type: "external_transfer",
        status: "completed",
        currency: parsed.data.currency,
        amountMinor,
        feeMinor: 0n,
        counterparty: `${recipientName} · ${bankName} · ****${accountNumberLast4} · ${destinationCountry}`,
        description: parsed.data.description?.trim() || "Simulated external transfer",
        mode: "internal_ledger",
      }, sender.preferredReceiptTemplate))
      .returning();

    await tx.insert(bankLedgerEntriesTable).values([
      {
        transactionId: transaction.id,
        walletId: wallet.id,
        accountCode: `wallet:${wallet.id}`,
        currency: parsed.data.currency,
        side: "debit",
        amountMinor,
      },
      {
        transactionId: transaction.id,
        accountCode: `simulation:external-clearing:${parsed.data.currency}`,
        currency: parsed.data.currency,
        side: "credit",
        amountMinor,
      },
    ]);

    return { transaction };
  });

  if ("error" in transfer) {
    res.status(409).json({ error: transfer.error });
    return;
  }

  res.status(201).json(
    CreateExternalTransferResponse.parse(
      toBankTransaction(transfer.transaction, userId),
    ),
  );
});

router.post("/bank/incoming-external-transfers", async (req, res): Promise<void> => {
  if (rejectExternalTransfer(res, "deposit")) return;
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const parsed = CreateIncomingExternalTransferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const sourceName = parsed.data.sourceName.trim();
  const sourceCountry = parsed.data.sourceCountry.trim();
  if (!sourceName || sourceCountry.length < 2) {
    res.status(400).json({ error: "Enter the source name and country." });
    return;
  }

  const user = await getOrCreateBankUser(authUserId);
  const userId = user.id;
  if (user.accountStatus !== "active") {
    res.status(409).json({ error: "This account is currently restricted." });
    return;
  }
  let amountMinor: bigint;
  try {
    amountMinor = parseAmountToMinor(parsed.data.amount);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Enter a valid transfer amount.",
    });
    return;
  }
  if (amountMinor <= 0n) {
    res.status(400).json({ error: "The transfer amount must be greater than zero." });
    return;
  }

  const transfer = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${parsed.data.idempotencyKey})::bigint)`,
    );
    const [duplicate] = await tx
      .select()
      .from(bankTransactionsTable)
      .where(eq(bankTransactionsTable.idempotencyKey, parsed.data.idempotencyKey))
      .limit(1);
    if (duplicate) {
      return duplicate.initiatedByUserId === userId &&
        duplicate.type === "external_transfer_in"
        ? { transaction: duplicate }
        : { error: "That request reference is already in use." };
    }

    const wallet = await userWallet(tx, userId, parsed.data.currency);
    if (!wallet) {
      return { error: "A wallet for the selected currency is unavailable." };
    }
    await tx
      .select({ id: bankWalletsTable.id })
      .from(bankWalletsTable)
      .where(eq(bankWalletsTable.id, wallet.id))
      .for("update");

    const [transaction] = await tx
      .insert(bankTransactionsTable)
      .values(withCustomerReceiptTemplate({
        reference: createReference(),
        idempotencyKey: parsed.data.idempotencyKey,
        initiatedByUserId: userId,
        toUserId: userId,
        toWalletId: wallet.id,
        type: "external_transfer_in",
        status: "completed",
        currency: parsed.data.currency,
        amountMinor,
        feeMinor: 0n,
        counterparty: `${sourceName} · ${sourceCountry} (simulated source)`,
        description: parsed.data.description?.trim() || "Simulated incoming external transfer",
        mode: "internal_ledger",
      }, user.preferredReceiptTemplate))
      .returning();

    await tx.insert(bankLedgerEntriesTable).values([
      {
        transactionId: transaction.id,
        accountCode: `simulation:external-source:${parsed.data.currency}`,
        currency: parsed.data.currency,
        side: "debit",
        amountMinor,
      },
      {
        transactionId: transaction.id,
        walletId: wallet.id,
        accountCode: `wallet:${wallet.id}`,
        currency: parsed.data.currency,
        side: "credit",
        amountMinor,
      },
    ]);

    return { transaction };
  });

  if ("error" in transfer) {
    res.status(409).json({ error: transfer.error });
    return;
  }

  res.status(201).json(
    CreateIncomingExternalTransferResponse.parse(
      toBankTransaction(transfer.transaction, userId),
    ),
  );
});

router.post("/bank/ledger-requests", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const parsed = CreateLedgerRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const requiresSavedMethod = parsed.data.type === "withdrawal";
  if (
    parsed.data.type === "deposit" &&
    (parsed.data.savedPaymentMethodId || parsed.data.paymentMethod)
  ) {
    res.status(400).json({
      error: "Wallet top-ups do not collect card or bank-account details.",
    });
    return;
  }
  if (
    (requiresSavedMethod &&
      (!parsed.data.savedPaymentMethodId || !parsed.data.paymentMethod)) ||
    (!!parsed.data.savedPaymentMethodId !== !!parsed.data.paymentMethod)
  ) {
    res.status(400).json({
      error:
        "Choose a saved withdrawal destination before submitting.",
    });
    return;
  }

  const user = await getOrCreateBankUser(authUserId);
  const userId = user.id;
  if (user.accountStatus !== "active") {
    res.status(409).json({ error: "This account is currently restricted." });
    return;
  }
  let amountMinor: bigint;
  try {
    amountMinor = parseAmountToMinor(
      parsed.data.amount,
      parsed.data.type === "deposit" ? 16 : 12,
    );
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Enter a valid amount.",
    });
    return;
  }

  if (amountMinor <= 0n) {
    res.status(400).json({ error: "The amount must be greater than zero." });
    return;
  }
  const existing = await db
    .select()
    .from(bankSandboxRequestsTable)
    .where(eq(bankSandboxRequestsTable.idempotencyKey, parsed.data.idempotencyKey))
    .limit(1);

  if (existing[0]) {
    if (
      existing[0].userId !== userId ||
      existing[0].type !== parsed.data.type ||
      existing[0].currency !== parsed.data.currency ||
      existing[0].amountMinor !== amountMinor ||
      existing[0].savedPaymentMethodId !==
        (parsed.data.savedPaymentMethodId ?? null) ||
      existing[0].paymentMethod !== (parsed.data.paymentMethod ?? null)
    ) {
      res.status(409).json({ error: "That request reference is already in use." });
      return;
    }
    const existingStatus =
      existing[0].status === "approved" || existing[0].status === "rejected"
        ? existing[0].status
        : "pending_review";
    if (
      existing[0].type === "deposit" &&
      existingStatus !== "approved"
    ) {
      res.status(409).json({
        error:
          "This earlier deposit was not credited. Submit a new top-up request with active Private Vault access.",
      });
      return;
    }
    res.status(201).json(
      CreateLedgerRequestResponse.parse({
        id: existing[0].id,
        reference: existing[0].reference,
        type: existing[0].type,
        currency: existing[0].currency,
        amount: formatMinorAmount(existing[0].amountMinor),
        status: existingStatus,
        message:
          existing[0].type === "deposit" && existingStatus === "approved"
            ? "Your internal Globus ledger credit was posted."
            : existingStatus === "pending_review"
              ? "Your withdrawal request is waiting for an administrator to review it."
              : `Your request was ${existingStatus}.`,
        createdAt: existing[0].createdAt.toISOString(),
      }),
    );
    return;
  }

  if (
    parsed.data.type === "deposit" &&
    !(await hasActiveVaultAccess(user))
  ) {
    res.status(403).json({
      error: "Active Private Vault access is required to add wallet funds.",
    });
    return;
  }

  const pinResult = await verifyTransactionPin(userId, parsed.data.transactionPin);
  if (pinResult !== "valid") {
    respondWithTransactionPinError(res, pinResult);
    return;
  }

  const request = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${parsed.data.idempotencyKey})::bigint)`,
    );
    const [duplicate] = await tx
      .select()
      .from(bankSandboxRequestsTable)
      .where(
        eq(bankSandboxRequestsTable.idempotencyKey, parsed.data.idempotencyKey),
      )
      .limit(1);

    if (duplicate) {
      if (
        duplicate.userId === userId &&
        duplicate.type === "deposit" &&
        duplicate.status !== "approved"
      ) {
        return {
          error:
            "This earlier deposit was not credited. Submit a new top-up request with active Private Vault access.",
        };
      }
      return duplicate.userId === userId &&
        duplicate.type === parsed.data.type &&
        duplicate.currency === parsed.data.currency &&
        duplicate.amountMinor === amountMinor &&
        duplicate.savedPaymentMethodId ===
          (parsed.data.savedPaymentMethodId ?? null) &&
        duplicate.paymentMethod === (parsed.data.paymentMethod ?? null)
        ? { sandboxRequest: duplicate, notification: null }
        : { error: "That request reference is already in use." };
    }

    if (parsed.data.type === "deposit") {
      const topUp = await createVaultSubscriberTopUp(tx, {
        userId,
        currency: parsed.data.currency,
        amountMinor,
        idempotencyKey: parsed.data.idempotencyKey,
        description: parsed.data.description,
      });
      if ("error" in topUp) return { error: topUp.error };
      return {
        sandboxRequest: topUp.sandboxRequest,
        notification: topUp.notification,
      };
    }

    const reference = createReference();
    let destinationSummary: string | null = null;
    let savedPaymentMethodId: string | null = null;
    let paymentMethod: string | null = null;
    if (
      parsed.data.savedPaymentMethodId &&
      parsed.data.paymentMethod
    ) {
      const [destination] = await tx
        .select()
        .from(bankSavedPaymentMethodsTable)
        .where(
          and(
            eq(
              bankSavedPaymentMethodsTable.id,
              parsed.data.savedPaymentMethodId,
            ),
            eq(bankSavedPaymentMethodsTable.userId, userId),
            eq(bankSavedPaymentMethodsTable.method, parsed.data.paymentMethod),
            isNull(bankSavedPaymentMethodsTable.deletedAt),
          ),
        )
        .for("update")
        .limit(1);
      if (!destination) {
        return { error: "Choose an active saved payment method." };
      }
      savedPaymentMethodId = destination.id;
      paymentMethod = destination.method;
      destinationSummary =
        destination.method === "bank_card"
          ? `${(destination.cardBrand ?? "Card").toUpperCase()} card ·••• ${destination.lastFour}`
          : `${destination.bankName ?? "Bank"} · ${destination.accountHolder ?? "Account holder"} · •••• ${destination.lastFour}${destination.country ? ` · ${destination.country}` : ""}`;
    }
    const wallet = await userWallet(tx, userId, parsed.data.currency);
    if (!wallet || wallet.status !== "active") {
      return { error: "A frozen wallet cannot be used for a withdrawal." };
    }
    const restrictionError = await bankOperationRestrictionError(tx, {
      userId,
      walletId: wallet.id,
      operation: "withdrawal",
    });
    if (restrictionError) return { error: restrictionError };
    const [lockedWallet] = await tx
      .select()
      .from(bankWalletsTable)
      .where(and(
        eq(bankWalletsTable.id, wallet.id),
        eq(bankWalletsTable.userId, userId),
      ))
      .for("update");
    if (!lockedWallet) return { error: "The selected wallet is unavailable." };
    if (lockedWallet.status !== "active") {
      return { error: "A frozen wallet cannot be used for a withdrawal." };
    }
    if (!lockedWallet.withdrawalsEnabled) {
      return {
        error: "New withdrawal requests are disabled for this wallet in your Private Vault settings.",
      };
    }
    const commitRestrictionError = await bankOperationRestrictionError(tx, {
      userId,
      walletId: lockedWallet.id,
      operation: "withdrawal",
    });
    if (commitRestrictionError) return { error: commitRestrictionError };
    const balance = await balanceForWallet(tx, lockedWallet.id);
    const reserved = await reservedForWallet(tx, lockedWallet.id);
    if (balance - reserved < amountMinor) {
      return {
        error: "The available ledger balance is not enough for this withdrawal request.",
      };
    }
    const [transaction] = await tx
      .insert(bankTransactionsTable)
      .values(withCustomerReceiptTemplate({
        reference,
        idempotencyKey: parsed.data.idempotencyKey,
        initiatedByUserId: userId,
        fromUserId: userId,
        fromWalletId: lockedWallet.id,
        toWalletId: null,
        type: "withdrawal_request",
        status: "pending",
        currency: parsed.data.currency,
        amountMinor,
        counterparty: null,
        description:
          parsed.data.description?.trim() ||
          "Withdrawal request awaiting administrator review",
        mode: "internal_ledger",
      }, user.preferredReceiptTemplate))
      .returning();

    const [sandboxRequest] = await tx
      .insert(bankSandboxRequestsTable)
      .values({
        userId,
        transactionId: transaction.id,
        reference,
        idempotencyKey: parsed.data.idempotencyKey,
        type: "withdrawal",
        currency: parsed.data.currency,
        destinationCurrency: null,
        savedPaymentMethodId,
        paymentMethod,
        paymentMethodSummary: destinationSummary,
        amountMinor,
        status: "pending_review",
      })
      .returning();

    return { sandboxRequest, transaction, notification: null };
  });

  if ("error" in request) {
    res.status(409).json({ error: request.error });
    return;
  }

  if (request.notification) {
    void sendPushToUser(userId, request.notification);
  }
  const approved = request.sandboxRequest.status === "approved";
  res.status(201).json(
    CreateLedgerRequestResponse.parse({
      id: request.sandboxRequest.id,
      reference: request.sandboxRequest.reference,
      type: request.sandboxRequest.type,
      currency: request.sandboxRequest.currency,
      amount: formatMinorAmount(request.sandboxRequest.amountMinor),
      status: approved ? "approved" : "pending_review",
      message:
        approved
          ? "Your internal Globus ledger credit was posted."
          : "Your available balance is reserved while an administrator reviews this withdrawal request.",
      createdAt: request.sandboxRequest.createdAt.toISOString(),
    }),
  );
});

router.get("/bank/vault/status", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  res.json(
    GetBankVaultStatusResponse.parse(await bankVaultStatusPayload(user)),
  );
});

router.get("/bank/vault/billing", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to view Private Vault access plans." });
    return;
  }
  const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
  const parsedHeader = GetBankVaultBillingHeader.safeParse({
    "X-Globus-Vault-Session": sessionToken,
  });
  if (!parsedHeader.success) {
    res.status(403).json({ error: "Unlock your Private Vault to view access plans." });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  if (!(await isVaultPasscodeSessionValid(user.id, sessionToken))) {
    res.status(403).json({ error: "Your Private Vault session expired. Unlock it again." });
    return;
  }
  const settings = await getOrCreateAdminSettings();
  const paystackConfigured = getPaystackSecretKey() !== null;
  const accessSource = await getVaultAccessSource(user);
  res.json(
    GetBankVaultBillingResponse.parse({
      configured: paystackConfigured,
      provider: paystackConfigured ? "paystack" : "unavailable",
      adminGrantActive: accessSource === "admin_grant",
      accessActive: accessSource !== "none",
      accessSource,
      recurringEnabled: paystackConfigured && isPaystackVaultRecurringEnabled(),
      plans: (["1m", "3m", "1y"] as const).map((code) => {
        const plan = getVaultSubscriptionPlan(code);
        if (!plan) throw new Error("Vault subscription plan is unavailable.");
        return {
          code,
          label: plan.label,
          durationMonths: plan.durationMonths,
          priceMinor: getVaultPlanPriceMinor(settings, code),
          currency: "NGN" as const,
        };
      }),
    }),
  );
});

router.get("/bank/vault/transfer-email-alert", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  res.json(
    GetBankVaultTransferEmailAlertResponse.parse({
      enabled:
        await vaultTransferEmailAlertsEnabled(user),
    }),
  );
});

router.post(
  "/bank/vault/paystack/initialize",
  vaultSubscriptionRequestLimiter,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to purchase Private Vault access." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = InitializeBankVaultPaystackPaymentHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    const parsed = InitializeBankVaultPaystackPaymentBody.safeParse(req.body);
    if (!parsedHeader.success || !parsed.success) {
      res.status(400).json({
        error: !parsedHeader.success
          ? parsedHeader.error.message
          : parsed.error?.message ?? "Choose a valid Private Vault plan.",
      });
      return;
    }
    const secretKey = getPaystackSecretKey();
    if (!secretKey) {
      res.status(503).json({ error: "Vault checkout is temporarily unavailable." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await isVaultPasscodeSessionValid(user.id, sessionToken))) {
      res.status(403).json({ error: "Enter your Private Vault passcode before checkout." });
      return;
    }
    if (!user.email || !isVaultSubscriptionPlanCode(parsed.data.planCode)) {
      res.status(400).json({ error: "A valid account email and subscription plan are required." });
      return;
    }
    if (
      parsed.data.autoRenew &&
      parsed.data.planCode !== "1m" &&
      parsed.data.planCode !== "1y"
    ) {
      res.status(400).json({
        error: "Paystack automatic renewal is available for monthly and annual plans only.",
      });
      return;
    }
    if (parsed.data.autoRenew && !isPaystackVaultRecurringEnabled()) {
      res.status(503).json({
        error: "Automatic renewal is unavailable until the Paystack webhook is configured.",
      });
      return;
    }
    if (user.vaultSubscriptionAutoRenew) {
      res.status(409).json({
        error: "Manage or cancel your existing Paystack renewal before starting another plan.",
      });
      return;
    }
    if (user.vaultSubscriptionPaymentStatus === "pending") {
      res.status(409).json({
        error: "A Paystack payment is already in progress. Verify it before starting another checkout.",
      });
      return;
    }
    const settings = await getOrCreateAdminSettings();
    const amountMinor = getVaultPlanPriceMinor(settings, parsed.data.planCode);
    if (!/^[0-9]+$/.test(amountMinor) || BigInt(amountMinor) <= 0n) {
      res.status(409).json({ error: "This access plan is temporarily unavailable." });
      return;
    }
    let recurringPlanCode: string | null = null;
    if (parsed.data.autoRenew) {
      try {
        recurringPlanCode = await getOrCreatePaystackVaultPlan(
          secretKey,
          parsed.data.planCode as "1m" | "1y",
          amountMinor,
        );
      } catch (error) {
        req.log.error(
          { error, planCode: parsed.data.planCode },
          "Could not prepare a Paystack recurring plan",
        );
        res.status(503).json({
          error: "Automatic renewal could not be prepared. Choose one-time access or try again.",
        });
        return;
      }
    }
    const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
    const requestHost = forwardedHost || req.get("host");
    const originHeader = req.get("origin");
    let callbackUrl: string;
    try {
      if (!requestHost) throw new Error("Missing request host.");
      const origin = originHeader
        ? new URL(originHeader)
        : new URL(`${req.protocol}://${requestHost}`);
      if (origin.host !== requestHost) throw new Error("Origin mismatch.");
      callbackUrl = new URL("/private-vault", origin).toString();
    } catch {
      res.status(400).json({ error: "The checkout return address could not be validated." });
      return;
    }
    const reference = `GBV-${randomUUID()}`;
    const now = new Date();
    const prepared = await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, user.id))
        .for("update");
      if (!lockedUser) return { missing: true as const };
      const currentStatus = vaultSubscriptionStatus(
        lockedUser.vaultSubscriptionStatus,
        lockedUser.vaultSubscriptionExpiresAt,
      );
      const legacyManualPending =
        lockedUser.vaultSubscriptionStatus === "pending" &&
        lockedUser.vaultSubscriptionPaymentStatus !== "pending" &&
        lockedUser.vaultSubscriptionPaymentStatus !== "success";
      if (
        currentStatus === "active" ||
        (currentStatus === "pending" && !legacyManualPending)
      ) {
        return { conflict: currentStatus };
      }
      if (lockedUser.vaultSubscriptionPaymentStatus === "pending") {
        return {
          paymentPending: true as const,
          reference: lockedUser.vaultSubscriptionPaymentReference,
        };
      }
      if (!(await isVaultPasscodeSessionValid(user.id, sessionToken))) {
        return { expired: true as const };
      }
      const [updated] = await tx
        .update(bankUsersTable)
        .set({
          vaultSubscriptionStatus: "inactive",
          vaultSubscriptionPlan: parsed.data.planCode,
          vaultSubscriptionAmountMinor: amountMinor,
          vaultSubscriptionAutoRenew: parsed.data.autoRenew,
          vaultPaystackPlanCode: recurringPlanCode,
          vaultPaystackSubscriptionCode: null,
          vaultPaystackCustomerCode: null,
          vaultSubscriptionPaymentReference: reference,
          vaultSubscriptionPaymentStatus: "pending",
          vaultSubscriptionPaymentInitializedAt: now,
          vaultSubscriptionPaymentVerifiedAt: null,
          vaultSubscriptionRequestedAt: now,
          vaultSubscriptionReviewedAt: null,
          vaultSubscriptionReviewedByUserId: null,
          vaultSubscriptionReason: null,
          vaultSubscriptionExpiresAt: null,
          updatedAt: now,
        })
        .where(eq(bankUsersTable.id, user.id))
        .returning();
      return { user: updated };
    });
    if ("missing" in prepared) {
      res.status(404).json({ error: "The Globus account could not be found." });
      return;
    }
    if ("expired" in prepared) {
      res.status(403).json({ error: "Your Private Vault session expired. Unlock it again." });
      return;
    }
    if ("conflict" in prepared) {
      res.status(409).json({
        error: prepared.conflict === "pending"
          ? "A subscription payment is already in progress."
          : "Private Vault access is already active.",
      });
      return;
    }
    if ("paymentPending" in prepared) {
      res.status(409).json({
        error: "A Paystack payment is already in progress. Verify it before starting another checkout.",
      });
      return;
    }
    try {
      const checkout = await initializePaystackVaultCheckout({
        secretKey,
        email: user.email,
        amountMinor,
        reference,
        callbackUrl,
        userId: user.id,
        planCode: parsed.data.planCode,
        recurringPlanCode,
      });
      await db.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "initialize_private_vault_paystack_payment",
        reason: `Member started Paystack checkout for the ${parsed.data.planCode} Private Vault plan (${amountMinor} NGN minor units).`,
      });
      res.json(InitializeBankVaultPaystackPaymentResponse.parse(checkout));
    } catch (error) {
      req.log.error({ error, reference }, "Private Vault Paystack checkout initialization failed");
      await db
        .update(bankUsersTable)
        .set({
          vaultSubscriptionPaymentStatus: "failed",
          vaultSubscriptionAutoRenew: false,
          vaultPaystackPlanCode: null,
          vaultPaystackSubscriptionCode: null,
          vaultPaystackCustomerCode: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bankUsersTable.id, user.id),
            eq(bankUsersTable.vaultSubscriptionPaymentReference, reference),
            eq(bankUsersTable.vaultSubscriptionPaymentStatus, "pending"),
          ),
        );
      res.status(503).json({ error: "Paystack checkout is temporarily unavailable. Try again." });
    }
  },
);

router.post(
  "/bank/vault/paystack/verify",
  vaultSubscriptionRequestLimiter,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to verify your Private Vault payment." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = VerifyBankVaultPaystackPaymentHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    const parsed = VerifyBankVaultPaystackPaymentBody.safeParse(req.body);
    if (!parsedHeader.success || !parsed.success) {
      res.status(400).json({
        error: !parsedHeader.success
          ? parsedHeader.error.message
          : parsed.error?.message ?? "Enter a valid payment reference.",
      });
      return;
    }
    const secretKey = getPaystackSecretKey();
    if (!secretKey) {
      res.status(503).json({ error: "Payment verification is temporarily unavailable." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await isVaultPasscodeSessionValid(user.id, sessionToken))) {
      res.status(403).json({ error: "Enter your Private Vault passcode before verifying payment." });
      return;
    }
    if (user.vaultSubscriptionPaymentReference !== parsed.data.reference) {
      res.status(404).json({ error: "That payment reference does not belong to this account." });
      return;
    }
    if (user.vaultSubscriptionPaymentStatus === "success") {
      res.json(VerifyBankVaultPaystackPaymentResponse.parse(await bankVaultStatusPayload(user)));
      return;
    }
    if (user.vaultSubscriptionPaymentStatus !== "pending") {
      res.status(409).json({ error: "There is no pending Paystack payment to verify." });
      return;
    }

    let payment;
    try {
      payment = await verifyPaystackVaultCheckout({
        secretKey,
        reference: parsed.data.reference,
      });
    } catch (error) {
      req.log.error(
        { error, reference: parsed.data.reference },
        "Private Vault Paystack payment verification failed",
      );
      res.status(503).json({ error: "Paystack verification is temporarily unavailable. Try again." });
      return;
    }
    if (
      payment.amount !== Number(user.vaultSubscriptionAmountMinor) ||
      payment.currency !== "NGN" ||
      payment.metadata?.userId !== user.id ||
      payment.metadata?.planCode !== user.vaultSubscriptionPlan ||
      String(payment.metadata?.autoRenew) !==
        String(user.vaultSubscriptionAutoRenew)
    ) {
      req.log.warn(
        { reference: parsed.data.reference },
        "Paystack payment details did not match the stored Private Vault checkout",
      );
      res.status(409).json({ error: "The verified payment does not match this account’s selected plan." });
      return;
    }
    if (payment.status !== "success") {
      if (["failed", "abandoned"].includes(payment.status)) {
        await db.transaction(async (tx) => {
          const [lockedUser] = await tx
            .select()
            .from(bankUsersTable)
            .where(eq(bankUsersTable.id, user.id))
            .for("update");
          if (
            !lockedUser ||
            lockedUser.vaultSubscriptionPaymentReference !== parsed.data.reference ||
            lockedUser.vaultSubscriptionPaymentStatus !== "pending"
          ) return;
          await tx
            .update(bankUsersTable)
            .set({
              vaultSubscriptionPaymentStatus: "failed",
              vaultSubscriptionAutoRenew: false,
              vaultPaystackPlanCode: null,
              vaultPaystackSubscriptionCode: null,
              vaultPaystackCustomerCode: null,
              updatedAt: new Date(),
            })
            .where(eq(bankUsersTable.id, user.id));
          await tx.insert(bankAuditLogsTable).values({
            actorUserId: user.id,
            targetUserId: user.id,
            action: "fail_private_vault_paystack_payment",
            reason: `Paystack verified the ${user.vaultSubscriptionPlan} Private Vault checkout as ${payment.status}.`,
          });
        });
        res.status(409).json({ error: "Paystack reports that this payment did not complete. Start a new checkout to retry." });
        return;
      }
      res.status(409).json({ error: "Payment is not complete yet. Wait a moment, then check again." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, user.id))
        .for("update");
      if (!lockedUser) return { missing: true as const };
      if (lockedUser.vaultSubscriptionPaymentReference !== parsed.data.reference) {
        return { mismatch: true as const };
      }
      if (lockedUser.vaultSubscriptionPaymentStatus === "success") {
        return { user: lockedUser };
      }
      if (
        lockedUser.vaultSubscriptionPaymentStatus !== "pending" ||
        !lockedUser.vaultSubscriptionPlan ||
        !isVaultSubscriptionPlanCode(lockedUser.vaultSubscriptionPlan) ||
        lockedUser.vaultSubscriptionAmountMinor !== String(payment.amount)
      ) {
        return { changed: true as const };
      }
      if (!(await isVaultPasscodeSessionValid(user.id, sessionToken))) {
        return { expired: true as const };
      }
      const plan = getVaultSubscriptionPlan(lockedUser.vaultSubscriptionPlan);
      if (!plan) return { changed: true as const };
      const now = new Date();
      const expiresAt = addVaultSubscriptionMonths(now, plan.durationMonths);
      const [updated] = await tx
        .update(bankUsersTable)
        .set({
          vaultSubscriptionStatus: "active",
          vaultSubscriptionExpiresAt: expiresAt,
          vaultSubscriptionPaymentStatus: "success",
          vaultSubscriptionPaymentVerifiedAt: now,
          vaultSubscriptionAutoRenew: lockedUser.vaultSubscriptionAutoRenew,
          vaultPaystackCustomerCode: payment.customerCode,
          vaultPaystackSubscriptionCode:
            payment.subscriptionCode ?? lockedUser.vaultPaystackSubscriptionCode,
          vaultSubscriptionReason: `Paystack verified payment ${parsed.data.reference} for the ${plan.label} Private Vault plan.`,
          vaultSubscriptionReviewedAt: null,
          vaultSubscriptionReviewedByUserId: null,
          updatedAt: now,
        })
        .where(eq(bankUsersTable.id, user.id))
        .returning();
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "activate_private_vault_paystack_subscription",
        reason: `Paystack verified reference ${parsed.data.reference} for ${plan.label} at ${lockedUser.vaultSubscriptionAmountMinor} NGN minor units. Access expires ${expiresAt.toISOString()}.`,
      });
      return { user: updated };
    });
    if ("missing" in result) {
      res.status(404).json({ error: "The Globus account could not be found." });
      return;
    }
    if ("mismatch" in result || "changed" in result) {
      res.status(409).json({ error: "This payment no longer matches the pending Private Vault checkout." });
      return;
    }
    if ("expired" in result) {
      res.status(403).json({ error: "Your Private Vault session expired. Unlock it again." });
      return;
    }
    res.json(
      VerifyBankVaultPaystackPaymentResponse.parse(
        await bankVaultStatusPayload(result.user),
      ),
    );
  },
);

router.post(
  "/bank/vault/paystack/manage-renewal",
  vaultSubscriptionRequestLimiter,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to manage your Private Vault renewal." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    if (!sessionToken || !(await isVaultPasscodeSessionValid(authUserId, sessionToken))) {
      res.status(403).json({ error: "Unlock your Private Vault before managing renewal." });
      return;
    }
    const secretKey = getPaystackSecretKey();
    if (!secretKey) {
      res.status(503).json({ error: "Paystack subscription management is unavailable." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (
      user.vaultSubscriptionPaymentStatus !== "success" ||
      !user.vaultSubscriptionAutoRenew ||
      !user.vaultPaystackSubscriptionCode
    ) {
      res.status(409).json({ error: "No active Paystack renewal is linked to this account." });
      return;
    }
    try {
      await sendPaystackSubscriptionManagementEmail({
        secretKey,
        subscriptionCode: user.vaultPaystackSubscriptionCode,
      });
      await db.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "email_private_vault_renewal_management_link",
        reason: "Member requested a Paystack subscription management link.",
      });
      res.json({ sent: true });
    } catch (error) {
      req.log.error({ error }, "Could not email Paystack subscription management link");
      res.status(503).json({ error: "Paystack could not send the management link. Try again." });
    }
  },
);

router.post(
  "/bank/vault/paystack/webhook",
  async (req, res): Promise<void> => {
    const secretKey = getPaystackSecretKey();
    const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
    const signature = req.get("x-paystack-signature") ?? "";
    if (
      !secretKey ||
      !rawBody ||
      !isValidPaystackWebhookSignature(rawBody, signature, secretKey)
    ) {
      res.status(secretKey ? 401 : 503).json({
        error: secretKey
          ? "Paystack webhook signature is invalid."
          : "Paystack webhook verification is unavailable.",
      });
      return;
    }

    const eventPayload = asObject(req.body);
    const eventType = typeof eventPayload?.event === "string"
      ? eventPayload.event
      : "";
    const data = asObject(eventPayload?.data);
    if (!data) {
      res.status(400).json({ error: "The Paystack event payload is invalid." });
      return;
    }

    const customer = paystackCustomerFromEvent(data);
    const providerPlanCode = paystackPlanCodeFromEvent(data);
    const subscriptionCode = paystackSubscriptionCodeFromEvent(data);

    if (eventType === "subscription.create") {
      if (!subscriptionCode || !customer.email) {
        res.json({ received: true });
        return;
      }
      const [user] = await db
        .select()
        .from(bankUsersTable)
        .where(and(
          sql`lower(${bankUsersTable.email}) = ${customer.email}`,
          eq(bankUsersTable.vaultSubscriptionAutoRenew, true),
        ))
        .limit(1);
      if (!user || !providerPlanCode || user.vaultPaystackPlanCode !== providerPlanCode) {
        req.log.warn(
          { eventType, subscriptionCode },
          "Paystack subscription event did not match a pending Globus renewal",
        );
        res.json({ received: true });
        return;
      }
      await db.transaction(async (tx) => {
        const [lockedUser] = await tx
          .select()
          .from(bankUsersTable)
          .where(eq(bankUsersTable.id, user.id))
          .for("update");
        if (
          !lockedUser ||
          !lockedUser.vaultSubscriptionAutoRenew ||
          lockedUser.vaultPaystackPlanCode !== providerPlanCode
        ) return;
        const [inserted] = await tx
          .insert(bankVaultPaystackEventsTable)
          .values({
            eventKey: paystackVaultEventKey("subscription.create", subscriptionCode),
            eventType,
            userId: user.id,
          })
          .onConflictDoNothing()
          .returning({ id: bankVaultPaystackEventsTable.id });
        if (!isNewPaystackWebhookEvent(inserted)) return;
        await tx
          .update(bankUsersTable)
          .set({
            vaultPaystackSubscriptionCode: subscriptionCode,
            vaultPaystackCustomerCode: customer.code ?? lockedUser.vaultPaystackCustomerCode,
            updatedAt: new Date(),
          })
          .where(eq(bankUsersTable.id, user.id));
      });
      res.json({ received: true });
      return;
    }

    if (eventType === "subscription.disable" || eventType === "subscription.enable") {
      if (!subscriptionCode) {
        res.json({ received: true });
        return;
      }
      const [user] = await db
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.vaultPaystackSubscriptionCode, subscriptionCode))
        .limit(1);
      if (!user) {
        res.json({ received: true });
        return;
      }
      await db.transaction(async (tx) => {
        const [lockedUser] = await tx
          .select()
          .from(bankUsersTable)
          .where(eq(bankUsersTable.id, user.id))
          .for("update");
        if (!lockedUser) return;
        const [inserted] = await tx
          .insert(bankVaultPaystackEventsTable)
          .values({
            eventKey: paystackVaultEventKey(eventType, subscriptionCode),
            eventType,
            userId: user.id,
          })
          .onConflictDoNothing()
          .returning({ id: bankVaultPaystackEventsTable.id });
        if (!isNewPaystackWebhookEvent(inserted)) return;
        await tx
          .update(bankUsersTable)
          .set({
            vaultSubscriptionAutoRenew: eventType === "subscription.enable",
            updatedAt: new Date(),
          })
          .where(eq(bankUsersTable.id, user.id));
      });
      res.json({ received: true });
      return;
    }

    if (eventType !== "charge.success" && eventType !== "charge.failed") {
      res.json({ received: true });
      return;
    }

    const reference = typeof data.reference === "string" ? data.reference : "";
    const amount = typeof data.amount === "number" ? data.amount : NaN;
    const currency = typeof data.currency === "string" ? data.currency : "";
    if (!/^[A-Za-z0-9=._-]{1,100}$/.test(reference) ||
        !Number.isSafeInteger(amount) ||
        !customer.email) {
      res.json({ received: true });
      return;
    }
    const [user] = await db
      .select()
      .from(bankUsersTable)
      .where(sql`lower(${bankUsersTable.email}) = ${customer.email}`)
      .limit(1);
    if (!user) {
      res.json({ received: true });
      return;
    }
    if (eventType === "charge.failed") {
      await db.transaction(async (tx) => {
        const [lockedUser] = await tx
          .select()
          .from(bankUsersTable)
          .where(eq(bankUsersTable.id, user.id))
          .for("update");
        if (!lockedUser) return;
        const failureKind = classifyVaultPaystackChargeFailure(
          lockedUser,
          {
            reference,
            amount,
            currency,
            customerCode: customer.code ?? null,
            subscriptionCode,
            providerPlanCode,
          },
        );
        if (!failureKind) return;

        const [inserted] = await tx
          .insert(bankVaultPaystackEventsTable)
          .values({
            eventKey: paystackVaultEventKey("charge.failed", reference),
            eventType,
            paymentReference: reference,
            userId: user.id,
          })
          .onConflictDoNothing()
          .returning({ id: bankVaultPaystackEventsTable.id });
        if (!isNewPaystackWebhookEvent(inserted)) return;

        if (failureKind === "initial") {
          await tx
            .update(bankUsersTable)
            .set({
              vaultSubscriptionStatus: "inactive",
              vaultSubscriptionPaymentStatus: "failed",
              vaultSubscriptionAutoRenew: false,
              vaultPaystackPlanCode: null,
              vaultPaystackSubscriptionCode: null,
              vaultPaystackCustomerCode: null,
              updatedAt: new Date(),
            })
            .where(eq(bankUsersTable.id, user.id));
          await tx.insert(bankAuditLogsTable).values({
            actorUserId: user.id,
            targetUserId: user.id,
            action: "fail_private_vault_paystack_webhook",
            reason: `Paystack confirmed the initial Private Vault payment ${reference} failed; no paid access was activated.`,
          });
          return;
        }

        await tx.insert(bankAuditLogsTable).values({
          actorUserId: user.id,
          targetUserId: user.id,
          action: "fail_private_vault_paystack_renewal",
          reason: `Paystack reported renewal charge ${reference} failed. Existing access remains valid only until ${lockedUser.vaultSubscriptionExpiresAt?.toISOString() ?? "its current expiry"}.`,
        });
      });
      res.json({ received: true });
      return;
    }
    await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, user.id))
        .for("update");
      if (!lockedUser) return;
      const initialPayment =
        reference === lockedUser.vaultSubscriptionPaymentReference;
      const renewalPayment =
        !initialPayment &&
        lockedUser.vaultSubscriptionAutoRenew &&
        Boolean(lockedUser.vaultPaystackPlanCode) &&
        Boolean(lockedUser.vaultPaystackSubscriptionCode) &&
        lockedUser.vaultPaystackSubscriptionCode === subscriptionCode &&
        lockedUser.vaultPaystackCustomerCode === customer.code &&
        lockedUser.vaultPaystackPlanCode === providerPlanCode;
      if (!initialPayment && !renewalPayment) return;
      if (
        currency !== "NGN" ||
        String(amount) !== lockedUser.vaultSubscriptionAmountMinor ||
        !lockedUser.vaultSubscriptionPlan ||
        !isVaultSubscriptionPlanCode(lockedUser.vaultSubscriptionPlan)
      ) return;
      if (
        lockedUser.vaultSubscriptionAutoRenew &&
        (!providerPlanCode || lockedUser.vaultPaystackPlanCode !== providerPlanCode)
      ) return;
      const now = new Date();
      const plan = getVaultSubscriptionPlan(lockedUser.vaultSubscriptionPlan ?? "");
      if (!plan) return;
      const currentStatus = vaultSubscriptionStatus(
        lockedUser.vaultSubscriptionStatus,
        lockedUser.vaultSubscriptionExpiresAt,
        now,
      );
      if (
        initialPayment &&
        !["pending", "success"].includes(lockedUser.vaultSubscriptionPaymentStatus)
      ) return;
      if (
        renewalPayment &&
        !["active", "expired"].includes(currentStatus)
      ) return;
      const [inserted] = await tx
        .insert(bankVaultPaystackEventsTable)
        .values({
          eventKey: paystackVaultEventKey("charge.success", reference),
          eventType,
          paymentReference: reference,
          userId: user.id,
        })
        .onConflictDoNothing()
        .returning({ id: bankVaultPaystackEventsTable.id });
      if (!isNewPaystackWebhookEvent(inserted)) return;

      if (initialPayment) {
        if (lockedUser.vaultSubscriptionPaymentStatus === "pending") {
          const expiresAt = addVaultSubscriptionMonths(now, plan.durationMonths);
          await tx
            .update(bankUsersTable)
            .set({
              vaultSubscriptionStatus: "active",
              vaultSubscriptionExpiresAt: expiresAt,
              vaultSubscriptionPaymentStatus: "success",
              vaultSubscriptionPaymentVerifiedAt: now,
              vaultPaystackCustomerCode:
                customer.code ?? lockedUser.vaultPaystackCustomerCode,
              vaultPaystackSubscriptionCode:
                subscriptionCode ?? lockedUser.vaultPaystackSubscriptionCode,
              updatedAt: now,
            })
            .where(eq(bankUsersTable.id, user.id));
          await tx.insert(bankAuditLogsTable).values({
            actorUserId: user.id,
            targetUserId: user.id,
            action: "activate_private_vault_paystack_webhook",
            reason: `Paystack confirmed initial checkout ${reference} for ${plan.label}; access expires ${expiresAt.toISOString()}.`,
          });
        } else if (
          lockedUser.vaultSubscriptionPaymentStatus === "success" &&
          (customer.code || subscriptionCode)
        ) {
          await tx
            .update(bankUsersTable)
            .set({
              vaultPaystackCustomerCode:
                customer.code ?? lockedUser.vaultPaystackCustomerCode,
              vaultPaystackSubscriptionCode:
                subscriptionCode ?? lockedUser.vaultPaystackSubscriptionCode,
              updatedAt: now,
            })
            .where(eq(bankUsersTable.id, user.id));
        }
        return;
      }
      const baseDate =
        lockedUser.vaultSubscriptionExpiresAt &&
        lockedUser.vaultSubscriptionExpiresAt > now
          ? lockedUser.vaultSubscriptionExpiresAt
          : now;
      const expiresAt = addVaultSubscriptionMonths(baseDate, plan.durationMonths);
      await tx
        .update(bankUsersTable)
        .set({
          vaultSubscriptionStatus: "active",
          vaultSubscriptionExpiresAt: expiresAt,
          vaultPaystackCustomerCode:
            customer.code ?? lockedUser.vaultPaystackCustomerCode,
          updatedAt: now,
        })
        .where(eq(bankUsersTable.id, user.id));
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "renew_private_vault_paystack_subscription",
        reason: `Paystack confirmed renewal ${reference} for ${plan.label}; access now expires ${expiresAt.toISOString()}.`,
      });
    });
    res.json({ received: true });
  },
);

router.use("/bank/vault/subscription", (_req, res): void => {
  res.status(410).json({
    error: "Manual subscription requests are no longer accepted. Complete Paystack checkout for automatic approval.",
  });
});

router.post(
  "/bank/vault/status",
  vaultAttemptLimiter,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const parsed = InitializeBankVaultPasscodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    const initialized = await initializeVaultPasscode(
      user.id,
      parsed.data.passcode,
    );
    if (!initialized) {
      res.status(409).json({
        error: "The private vault is already set up. Unlock it to change the passcode.",
      });
      return;
    }
    await db.insert(bankAuditLogsTable).values({
      actorUserId: user.id,
      targetUserId: user.id,
      action: "initialize_private_vault",
      reason: "Member initialized their separate four-digit private vault passcode.",
    });
    const refreshed = await getOrCreateBankUser(authUserId);
    res.json(
      InitializeBankVaultPasscodeResponse.parse(await bankVaultStatusPayload(refreshed)),
    );
  },
);

router.post(
  "/bank/vault/unlock",
  vaultAttemptLimiter,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const parsed = UnlockBankVaultBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    const rememberDevice = parsed.data.rememberDevice === true;
    const result = await unlockVault(user.id, parsed.data.passcode, {
      rememberDevice,
      previousSessionToken: getVaultDeviceCookieToken(req) || undefined,
    });
    if (result.result !== "valid") {
      if (result.result === "not_configured") {
        res.status(409).json({ error: "Set up a private vault passcode first." });
      } else if (result.result === "locked") {
        res.status(429).json({ error: "Too many incorrect passcodes. Try again in 15 minutes." });
      } else if (result.result === "invalid") {
        res.status(403).json({ error: "The private vault passcode is incorrect." });
      } else {
        res.status(404).json({ error: "The Globus account could not be found." });
      }
      return;
    }
    if (rememberDevice) {
      res.cookie(
        VAULT_DEVICE_COOKIE_NAME,
        result.sessionToken,
        {
          ...vaultDeviceCookieOptions(),
          maxAge: VAULT_REMEMBERED_SESSION_DURATION_MS,
        },
      );
    } else {
      clearVaultDeviceCookie(res);
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(
      UnlockBankVaultResponse.parse({
        sessionToken: rememberDevice ? null : result.sessionToken,
        expiresAt: result.expiresAt.toISOString(),
        rememberedDevice: rememberDevice,
      }),
    );
  },
);

router.patch(
  "/bank/vault/passcode",
  vaultAttemptLimiter,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = UpdateBankVaultPasscodeHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    const parsed = UpdateBankVaultPasscodeBody.safeParse(req.body);
    if (!parsedHeader.success || !parsed.success) {
      res.status(400).json({
        error: !parsedHeader.success
          ? parsedHeader.error.message
          : parsed.error?.message ?? "Invalid passcode.",
      });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await updateVaultPasscode(user.id, sessionToken, parsed.data.newPasscode))) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    clearVaultDeviceCookie(res);
    await db.insert(bankAuditLogsTable).values({
      actorUserId: user.id,
      targetUserId: user.id,
      action: "update_private_vault_passcode",
      reason: "Member changed their private vault passcode. Previous vault sessions were revoked.",
    });
    const refreshed = await getOrCreateBankUser(authUserId);
    res.json(
      UpdateBankVaultPasscodeResponse.parse(await bankVaultStatusPayload(refreshed)),
    );
  },
);

router.get(
  "/bank/vault/email-preferences",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = GetBankVaultEmailPreferencesHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    if (!parsedHeader.success) {
      res.status(403).json({ error: "Unlock your private vault to view alert preferences." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await isVaultSessionActive(user.id, sessionToken))) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    res.json(
      GetBankVaultEmailPreferencesResponse.parse(
        await bankVaultEmailPreferencesPayload(user),
      ),
    );
  },
);

router.patch(
  "/bank/vault/email-preferences",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = UpdateBankVaultEmailPreferencesHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    const parsed = UpdateBankVaultEmailPreferencesBody.safeParse(req.body);
    if (!parsedHeader.success || !parsed.success) {
      res.status(400).json({
        error: !parsedHeader.success
          ? parsedHeader.error.message
          : parsed.error?.message ?? "Invalid email-alert preferences.",
      });
      return;
    }
    if (!Object.keys(parsed.data).length) {
      res.status(400).json({ error: "Choose at least one email-alert preference." });
      return;
    }
    let requestedSupportLabel: string | undefined;
    if (parsed.data.supportLabel !== undefined) {
      const normalizedSupportLabel = normalizeSupportLabel(
        parsed.data.supportLabel,
      );
      if (!normalizedSupportLabel) {
        res.status(400).json({
          error: "Enter a footer link label from 1 to 40 characters.",
        });
        return;
      }
      requestedSupportLabel = normalizedSupportLabel;
    }
    let normalizedSenderLocalPart: string | null | undefined;
    if (parsed.data.senderLocalPart !== undefined) {
      const normalized =
        normalizeCustomerEmailSenderLocalPart(parsed.data.senderLocalPart);
      if (!normalized.valid) {
        res.status(400).json({
          error:
            "Use a unique sender prefix with letters, numbers, dots, underscores, or hyphens; reserved Globus addresses are unavailable.",
        });
        return;
      }
      normalizedSenderLocalPart = normalized.value;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await isVaultSessionActive(user.id, sessionToken))) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, user.id))
        .for("update");
      if (!lockedUser) return { missing: true as const };
      if (!(await isVaultSessionActive(user.id, sessionToken))) {
        return { expired: true as const };
      }
      const nextSupportUrl =
        parsed.data.supportUrl === undefined
          ? lockedUser.vaultEmailSupportUrl
          : parsed.data.supportUrl === null
            ? null
            : normalizeSupportUrl(parsed.data.supportUrl);
      const nextIncludeSupportLink =
        parsed.data.includeSupportLink ??
        lockedUser.vaultEmailIncludeSupportLink;
      const nextSupportLabel =
        requestedSupportLabel === undefined
          ? lockedUser.vaultEmailSupportLabel
          : requestedSupportLabel;
      const nextSenderLocalPart =
        normalizedSenderLocalPart === undefined
          ? lockedUser.vaultEmailSenderLocalPart
          : normalizedSenderLocalPart;
      if (nextSenderLocalPart) {
        const [existingSender] = await tx
          .select({ id: bankUsersTable.id })
          .from(bankUsersTable)
          .where(eq(bankUsersTable.vaultEmailSenderLocalPart, nextSenderLocalPart))
          .limit(1);
        if (existingSender && existingSender.id !== user.id) {
          return { senderInUse: true as const };
        }
      }
      if (
        parsed.data.supportUrl &&
        !normalizeSupportUrl(parsed.data.supportUrl)
      ) {
        return { invalidSupportUrl: true as const };
      }
      if (nextIncludeSupportLink && !nextSupportUrl) {
        return { missingSupportUrl: true as const };
      }
      const changes = {
        ...(parsed.data.transactionEmailAlertsEnabled !== undefined
          ? {
              vaultEmailAlertsEnabled:
                parsed.data.transactionEmailAlertsEnabled,
            }
          : {}),
        ...(parsed.data.bannerTheme !== undefined
          ? { vaultEmailBannerTheme: parsed.data.bannerTheme }
          : {}),
        ...(parsed.data.bannerHeadline !== undefined
          ? { vaultEmailBannerHeadline: parsed.data.bannerHeadline.trim() }
          : {}),
        ...(parsed.data.bannerBackgroundColor !== undefined
          ? {
              vaultEmailBannerBackgroundColor:
                parsed.data.bannerBackgroundColor.toLowerCase(),
            }
          : {}),
        ...(parsed.data.includeSupportLink !== undefined
          ? { vaultEmailIncludeSupportLink: parsed.data.includeSupportLink }
          : {}),
        ...(parsed.data.supportUrl !== undefined
          ? { vaultEmailSupportUrl: nextSupportUrl }
          : {}),
        ...(requestedSupportLabel !== undefined
          ? { vaultEmailSupportLabel: nextSupportLabel }
          : {}),
        ...(normalizedSenderLocalPart !== undefined
          ? { vaultEmailSenderLocalPart: nextSenderLocalPart }
          : {}),
        updatedAt: new Date(),
      };
      if (parsed.data.bannerHeadline !== undefined && !parsed.data.bannerHeadline.trim()) {
        return { invalid: true as const };
      }
      const [updated] = await tx
        .update(bankUsersTable)
        .set(changes)
        .where(eq(bankUsersTable.id, user.id))
        .returning();
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "update_transfer_email_preferences",
        reason: "Member updated private vault transaction-email delivery or alert design preferences.",
      });
      return { user: updated };
    }).catch((error: unknown) => {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        return { senderInUse: true as const };
      }
      throw error;
    });
    if ("missing" in result) {
      res.status(404).json({ error: "The Globus account could not be found." });
      return;
    }
    if ("expired" in result) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    if ("invalid" in result) {
      res.status(400).json({ error: "Enter a non-empty email banner headline." });
      return;
    }
    if ("invalidSupportUrl" in result) {
      res.status(400).json({ error: "Enter a valid HTTPS support link." });
      return;
    }
    if ("missingSupportUrl" in result) {
      res.status(400).json({
        error: "Add a support link or disable the footer link before saving.",
      });
      return;
    }
    if ("senderInUse" in result) {
      res.status(409).json({
        error: "That sender prefix is already in use. Choose another one.",
      });
      return;
    }
    res.json(
      UpdateBankVaultEmailPreferencesResponse.parse(
        await bankVaultEmailPreferencesPayload(result.user),
      ),
    );
  },
);

router.get(
  "/bank/vault/receipt-preference",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = GetBankVaultReceiptPreferenceHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    if (!parsedHeader.success) {
      res.status(403).json({ error: "Unlock your private vault to view receipt preferences." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await isVaultSessionActive(user.id, sessionToken))) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    res.json(
      GetBankVaultReceiptPreferenceResponse.parse({
        preferredReceiptTemplate: user.preferredReceiptTemplate,
      }),
    );
  },
);

router.patch(
  "/bank/vault/receipt-preference",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = UpdateBankVaultReceiptPreferenceHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    const parsed = UpdateBankVaultReceiptPreferenceBody.safeParse(req.body);
    if (!parsedHeader.success || !parsed.success) {
      res.status(400).json({
        error: !parsedHeader.success
          ? parsedHeader.error.message
          : parsed.error?.message ?? "Choose a supported receipt layout.",
      });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await isVaultSessionActive(user.id, sessionToken))) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, user.id))
        .for("update");
      if (!lockedUser) return { missing: true as const };
      if (!(await isVaultSessionActive(user.id, sessionToken))) {
        return { expired: true as const };
      }
      if (!(await hasActiveVaultAccess(lockedUser, tx))) {
        return { noAccess: true as const };
      }
      const [updated] = await tx
        .update(bankUsersTable)
        .set({
          preferredReceiptTemplate: parsed.data.preferredReceiptTemplate,
          updatedAt: new Date(),
        })
        .where(eq(bankUsersTable.id, user.id))
        .returning({
          preferredReceiptTemplate: bankUsersTable.preferredReceiptTemplate,
        });
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "update_transfer_receipt_preference",
        reason: "Member selected a receipt layout for future transfers.",
      });
      return { preference: updated };
    });
    if ("missing" in result) {
      res.status(404).json({ error: "The Globus account could not be found." });
      return;
    }
    if ("expired" in result) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    if ("noAccess" in result) {
      res.status(403).json({ error: "Active Private Vault access is required to change receipt preferences." });
      return;
    }
    res.json(UpdateBankVaultReceiptPreferenceResponse.parse(result.preference));
  },
);

router.get(
  "/bank/vault/transaction-notes",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = ListBankVaultTransactionNotesHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    if (!parsedHeader.success) {
      res.status(403).json({ error: "Unlock your private vault to view personal notes." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await isVaultSessionActive(user.id, sessionToken))) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    const notes = await db
      .select()
      .from(bankVaultTransactionNotesTable)
      .where(eq(bankVaultTransactionNotesTable.userId, user.id))
      .orderBy(desc(bankVaultTransactionNotesTable.updatedAt))
      .limit(100);
    try {
      res.json(
        ListBankVaultTransactionNotesResponse.parse(
          notes.map(bankVaultTransactionNoteResponse),
        ),
      );
    } catch {
      req.log.error("Private transaction notes could not be decrypted");
      res.status(503).json({ error: "Private notes are temporarily unavailable." });
    }
  },
);

router.put(
  "/bank/vault/transaction-notes/:transactionId",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = UpdateBankVaultTransactionNoteHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    const params = UpdateBankVaultTransactionNoteParams.safeParse(req.params);
    const parsed = UpdateBankVaultTransactionNoteBody.safeParse(req.body);
    if (!parsedHeader.success || !params.success || !parsed.success) {
      res.status(400).json({
        error: !parsedHeader.success
          ? parsedHeader.error.message
          : !params.success
            ? params.error.message
            : parsed.error?.message ?? "Invalid personal transaction note.",
      });
      return;
    }
    const noteText = parsed.data.note.trim();
    if (!noteText) {
      res.status(400).json({ error: "Enter a personal note before saving." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await isVaultSessionActive(user.id, sessionToken))) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    const [transaction] = await db
      .select({ id: bankTransactionsTable.id })
      .from(bankTransactionsTable)
      .where(
        and(
          eq(bankTransactionsTable.id, params.data.transactionId),
          or(
            eq(bankTransactionsTable.fromUserId, user.id),
            eq(bankTransactionsTable.toUserId, user.id),
            eq(bankTransactionsTable.initiatedByUserId, user.id),
          ),
        ),
      )
      .limit(1);
    if (!transaction) {
      res.status(404).json({ error: "Transaction not found for this account." });
      return;
    }
    let encryptedNote: string;
    try {
      encryptedNote = encryptPrivateData(noteText, "vault-transaction-note");
    } catch {
      res.status(503).json({ error: "Private note storage is temporarily unavailable." });
      return;
    }
    const [saved] = await db
      .insert(bankVaultTransactionNotesTable)
      .values({
        userId: user.id,
        transactionId: transaction.id,
        note: encryptedNote,
      })
      .onConflictDoUpdate({
        target: [
          bankVaultTransactionNotesTable.userId,
          bankVaultTransactionNotesTable.transactionId,
        ],
        set: { note: encryptedNote, updatedAt: new Date() },
      })
      .returning();
    try {
      res.json(
        UpdateBankVaultTransactionNoteResponse.parse(
          bankVaultTransactionNoteResponse(saved),
        ),
      );
    } catch {
      req.log.error("Private transaction note could not be decrypted after saving");
      res.status(503).json({ error: "Private note is saved but temporarily unavailable." });
    }
  },
);

router.delete(
  "/bank/vault/transaction-notes/:transactionId",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = DeleteBankVaultTransactionNoteHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    const params = DeleteBankVaultTransactionNoteParams.safeParse(req.params);
    if (!parsedHeader.success || !params.success) {
      res.status(400).json({
        error: !parsedHeader.success
          ? parsedHeader.error.message
          : params.error?.message ?? "Invalid transaction note identifier.",
      });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await isVaultSessionActive(user.id, sessionToken))) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    const [deleted] = await db
      .delete(bankVaultTransactionNotesTable)
      .where(
        and(
          eq(bankVaultTransactionNotesTable.userId, user.id),
          eq(bankVaultTransactionNotesTable.transactionId, params.data.transactionId),
        ),
      )
      .returning({ transactionId: bankVaultTransactionNotesTable.transactionId });
    if (!deleted) {
      res.status(404).json({ error: "Personal transaction note not found." });
      return;
    }
    res.json(
      DeleteBankVaultTransactionNoteResponse.parse({
        transactionId: deleted.transactionId,
        deleted: true,
      }),
    );
  },
);

router.get(
  "/bank/vault/wallet-controls",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = ListBankVaultWalletControlsHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    if (!parsedHeader.success) {
      res.status(403).json({ error: "Unlock your private vault to manage wallet controls." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await isVaultSessionActive(user.id, sessionToken))) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    const wallets = await db
      .select({
        walletId: bankWalletsTable.id,
        currency: bankWalletsTable.currency,
        transfersEnabled: bankWalletsTable.transfersEnabled,
        depositsEnabled: bankWalletsTable.depositsEnabled,
        withdrawalsEnabled: bankWalletsTable.withdrawalsEnabled,
        futureTransferMode: bankWalletsTable.futureTransferMode,
      })
      .from(bankWalletsTable)
      .where(
        and(
          eq(bankWalletsTable.userId, user.id),
          inArray(bankWalletsTable.currency, currencies),
        ),
      )
      .orderBy(asc(bankWalletsTable.currency));
    res.json(
      ListBankVaultWalletControlsResponse.parse(
        wallets.map((wallet) => ({
          ...wallet,
          futureTransferMode: normalizeFutureTransferMode(wallet.futureTransferMode),
        })),
      ),
    );
  },
);

router.patch(
  "/bank/vault/wallet-controls/:walletId",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = UpdateBankVaultWalletControlHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    const params = UpdateBankVaultWalletControlParams.safeParse(req.params);
    const parsed = UpdateBankVaultWalletControlBody.safeParse(req.body);
    if (!parsedHeader.success || !params.success || !parsed.success) {
      res.status(400).json({
        error: !parsedHeader.success
          ? parsedHeader.error.message
          : !params.success
            ? params.error.message
            : parsed.error?.message ?? "Invalid wallet-control request.",
      });
      return;
    }
    if (!Object.keys(parsed.data).length) {
      res.status(400).json({ error: "Choose at least one wallet control to update." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await isVaultSessionActive(user.id, sessionToken))) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [wallet] = await tx
        .select()
        .from(bankWalletsTable)
        .where(
          and(
            eq(bankWalletsTable.id, params.data.walletId),
            eq(bankWalletsTable.userId, user.id),
            inArray(bankWalletsTable.currency, currencies),
          ),
        )
        .for("update");
      if (!wallet) return { notFound: true as const };
      if (!(await isVaultSessionActive(user.id, sessionToken))) {
        return { expired: true as const };
      }
      const changes = {
        ...(parsed.data.transfersEnabled !== undefined
          ? { transfersEnabled: parsed.data.transfersEnabled }
          : {}),
        ...(parsed.data.depositsEnabled !== undefined
          ? { depositsEnabled: parsed.data.depositsEnabled }
          : {}),
        ...(parsed.data.withdrawalsEnabled !== undefined
          ? { withdrawalsEnabled: parsed.data.withdrawalsEnabled }
          : {}),
        ...(parsed.data.futureTransferMode !== undefined
          ? { futureTransferMode: parsed.data.futureTransferMode }
          : {}),
        updatedAt: new Date(),
      };
      const [updated] = await tx
        .update(bankWalletsTable)
        .set(changes)
        .where(eq(bankWalletsTable.id, wallet.id))
        .returning();
      const changedFields = Object.keys(parsed.data).join(", ");
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "update_private_vault_wallet_controls",
        reason: `Member updated ${wallet.currency} wallet controls: ${changedFields}.`,
      });
      return { wallet: updated };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "Wallet not found." });
      return;
    }
    if ("expired" in result) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    res.json(
      UpdateBankVaultWalletControlResponse.parse({
        walletId: result.wallet.id,
        currency: result.wallet.currency,
        transfersEnabled: result.wallet.transfersEnabled,
        depositsEnabled: result.wallet.depositsEnabled,
        withdrawalsEnabled: result.wallet.withdrawalsEnabled,
        futureTransferMode: normalizeFutureTransferMode(result.wallet.futureTransferMode),
      }),
    );
  },
);

router.get("/bank/notifications", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  const notifications = await db
    .select()
    .from(bankNotificationsTable)
    .where(eq(bankNotificationsTable.userId, user.id))
    .orderBy(desc(bankNotificationsTable.createdAt))
    .limit(50);
  res.json(
    ListBankNotificationsResponse.parse(
      notifications.map(notificationResponse),
    ),
  );
});

router.delete("/bank/notifications", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  const deleted = await db
    .delete(bankNotificationsTable)
    .where(eq(bankNotificationsTable.userId, user.id))
    .returning({ id: bankNotificationsTable.id });
  res.json(ClearBankNotificationsResponse.parse({ deletedCount: deleted.length }));
});

router.patch(
  "/bank/notifications/:notificationId/read",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const params = MarkBankNotificationReadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    const [notification] = await db
      .update(bankNotificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(bankNotificationsTable.id, params.data.notificationId),
          eq(bankNotificationsTable.userId, user.id),
        ),
      )
      .returning();
    if (!notification) {
      res.status(404).json({ error: "Notification not found." });
      return;
    }
    res.json(
      MarkBankNotificationReadResponse.parse(
        notificationResponse(notification),
      ),
    );
  },
);

router.get("/bank/push/config", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  res.json(GetBankPushConfigResponse.parse(getPushConfig()));
});

router.get(
  "/bank/push/preferences",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    res.json(
      GetBankPushPreferencesResponse.parse(bankPushPreferencesPayload(user)),
    );
  },
);

router.patch(
  "/bank/push/preferences",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = UpdateBankPushPreferencesHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    const parsed = UpdateBankPushPreferencesBody.safeParse(req.body);
    if (!parsedHeader.success || !parsed.success) {
      res.status(400).json({
        error: !parsedHeader.success
          ? parsedHeader.error.message
          : parsed.error?.message ?? "Invalid push alert preferences.",
      });
      return;
    }
    if (!Object.keys(parsed.data).length) {
      res.status(400).json({ error: "Choose at least one push alert preference." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await isVaultSessionActive(user.id, sessionToken))) {
      res.status(403).json({ error: "Active Private Vault access is required to change alert settings." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, user.id))
        .for("update");
      if (!lockedUser) return null;
      if (!(await isVaultSessionActive(user.id, sessionToken))) {
        return { expired: true as const };
      }
      const [updated] = await tx
        .update(bankUsersTable)
        .set({
          ...(parsed.data.transferEnabled !== undefined
            ? { pushTransferAlertsEnabled: parsed.data.transferEnabled }
            : {}),
          ...(parsed.data.walletEnabled !== undefined
            ? { pushWalletAlertsEnabled: parsed.data.walletEnabled }
            : {}),
          ...(parsed.data.securityEnabled !== undefined
            ? { pushSecurityAlertsEnabled: parsed.data.securityEnabled }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(bankUsersTable.id, user.id))
        .returning();
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "update_push_notification_preferences",
        reason: "Member updated push notification category preferences.",
      });
      return { updated };
    });
    if (!result) {
      res.status(404).json({ error: "The Globus account could not be found." });
      return;
    }
    if ("expired" in result) {
      res.status(403).json({ error: "Your Private Vault session expired or the subscription is no longer active." });
      return;
    }
    res.json(
      UpdateBankPushPreferencesResponse.parse(
        bankPushPreferencesPayload(result.updated),
      ),
    );
  },
);

router.put(
  "/bank/push/subscriptions",
  pushSubscriptionLimiter,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const parsed = SaveBankPushSubscriptionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!getPushConfig().configured) {
      res.status(503).json({ error: "Browser push is not configured yet." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    try {
      const id = await savePushSubscription(user.id, parsed.data.subscriberId);
      await db.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "link_webpushr_notifications",
        reason: "Member linked a Webpushr subscriber to their account.",
      });
      res.json(SaveBankPushSubscriptionResponse.parse({ id, saved: true }));
    } catch (error) {
      if (error instanceof WebpushrSubscriberAlreadyLinkedError) {
        res.status(409).json({ error: error.message });
        return;
      }
      req.log.error("Encrypted push subscription storage is unavailable");
      res.status(503).json({ error: "Secure notification storage is temporarily unavailable." });
    }
  },
);

router.delete(
  "/bank/push/subscriptions/:subscriptionId",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const params = DeleteBankPushSubscriptionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    const [deleted] = await db
      .delete(bankPushSubscriptionsTable)
      .where(
        and(
          eq(bankPushSubscriptionsTable.id, params.data.subscriptionId),
          eq(bankPushSubscriptionsTable.userId, user.id),
        ),
      )
      .returning({ id: bankPushSubscriptionsTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Push subscription not found." });
      return;
    }
    await db.insert(bankAuditLogsTable).values({
      actorUserId: user.id,
      targetUserId: user.id,
      action: "unlink_webpushr_notifications",
      reason: "Member disconnected a Webpushr subscriber from their account.",
    });
    res.json(DeleteBankPushSubscriptionResponse.parse({ id: deleted.id, saved: false }));
  },
);

export default router;
