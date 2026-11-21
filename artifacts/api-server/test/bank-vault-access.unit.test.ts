import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getTableColumns } from "drizzle-orm";
import { bankUsersTable } from "@workspace/db";
import {
  classifyVaultPaystackChargeFailure,
  getVaultAccessSource,
  hasActiveVaultAccess,
  hasActiveVaultSubscription,
  isVaultTestingMode,
  normalizeFutureTransferMode,
  resolveEffectiveAccountTier,
  resolveFutureTransferStatus,
} from "../src/lib/bank-vault";
import { parseAmountToMinor } from "../src/lib/bank";
import {
  bankRestrictionTypeError,
  isOutgoingTransferEnabled,
} from "../src/lib/bank";
import { normalizeVaultTopUpDescription } from "../src/lib/vault-subscriber-deposit";

function fakeEntitlementLookup(granted: boolean) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => granted ? [{ userId: "member-1" }] : [],
        }),
      }),
    }),
  } as never;
}

function routeBlockFrom(source: string, routePath: string): string {
  const start = source.indexOf(routePath);
  assert.notEqual(start, -1, `expected route ${routePath}`);
  const nextRoute = source.indexOf("\nrouter.", start + routePath.length);
  return source.slice(start, nextRoute === -1 ? source.length : nextRoute);
}

test("admin entitlement grants Vault access without changing paid subscription state", async () => {
  const expiredMember = {
    id: "member-1",
    vaultSubscriptionStatus: "expired",
    vaultSubscriptionExpiresAt: new Date(Date.now() - 60_000),
  };
  assert.equal(hasActiveVaultSubscription(expiredMember), false);
  assert.equal(await hasActiveVaultAccess(expiredMember, fakeEntitlementLookup(true)), true);
  assert.equal(
    await getVaultAccessSource(expiredMember, fakeEntitlementLookup(true)),
    "admin_grant",
  );
});

test("paid subscription access remains distinct when no admin grant exists", async () => {
  const subscriber = {
    id: "member-2",
    vaultSubscriptionStatus: "active",
    vaultSubscriptionExpiresAt: new Date(Date.now() + 60_000),
  };
  assert.equal(await hasActiveVaultAccess(subscriber, fakeEntitlementLookup(false)), true);
  assert.equal(
    await getVaultAccessSource(subscriber, fakeEntitlementLookup(false)),
    "paystack_subscription",
  );
});

test("no grant or active paid subscription means no Vault access", async () => {
  const inactiveMember = {
    id: "member-3",
    vaultSubscriptionStatus: "inactive",
    vaultSubscriptionExpiresAt: null,
  };
  assert.equal(await hasActiveVaultAccess(inactiveMember, fakeEntitlementLookup(false)), false);
  assert.equal(
    await getVaultAccessSource(inactiveMember, fakeEntitlementLookup(false)),
    "none",
  );
});

test("active Vault plans determine the displayed tier and expiry returns to Standard", () => {
  const user = {
    vaultSubscriptionStatus: "active",
    vaultSubscriptionExpiresAt: new Date(Date.now() + 60_000),
    vaultSubscriptionPlan: "3m",
  };
  assert.deepEqual(resolveEffectiveAccountTier(user), {
    id: "gold",
    name: "Gold 🪙",
    source: "paystack_subscription",
  });
  assert.deepEqual(resolveEffectiveAccountTier({ ...user, vaultSubscriptionPlan: "1m" }), {
    id: "silver",
    name: "Silver🥈",
    source: "paystack_subscription",
  });
  assert.deepEqual(resolveEffectiveAccountTier({ ...user, vaultSubscriptionPlan: "1y" }), {
    id: "bronze",
    name: "Bronze 🥉",
    source: "paystack_subscription",
  });
  assert.deepEqual(
    resolveEffectiveAccountTier(
      {
        ...user,
        vaultSubscriptionExpiresAt: new Date(Date.now() - 60_000),
      },
    ),
    { id: "standard", name: "Standard 🏦", source: "default" },
  );
  assert.deepEqual(
    resolveEffectiveAccountTier({
      ...user,
      vaultSubscriptionPlan: "unknown",
    }),
    { id: "standard", name: "Standard 🏦", source: "default" },
  );
});

test("administrator base tier applies after a paid plan ends but never grants Vault access", async () => {
  const assigned = {
    vaultSubscriptionStatus: "inactive",
    vaultSubscriptionExpiresAt: null,
    vaultSubscriptionPlan: null,
    adminAccountTier: "silver",
  };
  assert.deepEqual(resolveEffectiveAccountTier(assigned), {
    id: "silver",
    name: "Silver🥈",
    source: "admin_assignment",
  });
  assert.deepEqual(resolveEffectiveAccountTier({
    ...assigned,
    vaultSubscriptionStatus: "active",
    vaultSubscriptionExpiresAt: new Date(Date.now() + 60_000),
    vaultSubscriptionPlan: "3m",
  }), {
    id: "gold",
    name: "Gold 🪙",
    source: "paystack_subscription",
  });
  assert.deepEqual(resolveEffectiveAccountTier({
    ...assigned,
    vaultSubscriptionStatus: "expired",
    vaultSubscriptionExpiresAt: new Date(Date.now() - 60_000),
  }), {
    id: "silver",
    name: "Silver🥈",
    source: "admin_assignment",
  });
  assert.equal(
    await hasActiveVaultAccess(
      { id: "tier-only", ...assigned },
      fakeEntitlementLookup(false),
    ),
    false,
    "a tier assignment alone must not grant Vault access",
  );
});

test("production-compatible user schema and tier calculation do not require tier database objects", () => {
  const columnNames = Object.values(getTableColumns(bankUsersTable)).map(
    (column) => column.name,
  );
  assert.equal(columnNames.includes("account_tier_id"), false);
  assert.equal(columnNames.includes("admin_account_tier"), true);

  const schemaSource = readFileSync(
    new URL("../../../lib/db/src/schema/bank.ts", import.meta.url),
    "utf8",
  );
  const tierLibrarySource = readFileSync(
    new URL("../src/lib/bank-vault.ts", import.meta.url),
    "utf8",
  );
  const bankUserLibrarySource = readFileSync(
    new URL("../src/lib/bank.ts", import.meta.url),
    "utf8",
  );
  const customerRoutesSource = readFileSync(
    new URL("../src/routes/bank.ts", import.meta.url),
    "utf8",
  );
  const adminRoutesSource = readFileSync(
    new URL("../src/routes/bankAdmin.ts", import.meta.url),
    "utf8",
  );
  const tierMigration = readFileSync(
    new URL("../../../lib/db/migrations/20261120_admin_account_tier_override.sql", import.meta.url),
    "utf8",
  );
  const accountTierRouteStart = adminRoutesSource.indexOf(
    'router.patch(\n  "/bank/admin/users/:userId/account-tier"',
  );
  const accountTierRoute = adminRoutesSource.slice(
    accountTierRouteStart,
    accountTierRouteStart + 2_500,
  );

  assert.doesNotMatch(schemaSource, /bank_account_tiers|account_tier_id/i);
  assert.doesNotMatch(tierLibrarySource, /bankAccountTiersTable|bank_account_tiers|accountTierId/i);
  assert.doesNotMatch(bankUserLibrarySource, /bank_account_tiers|account_tier_id|accountTierId/i);
  assert.match(
    bankUserLibrarySource,
    /export async function ensureBankUser[\s\S]*?\.select\(\)[\s\S]*?\.from\(bankUsersTable\)/,
  );
  assert.doesNotMatch(customerRoutesSource, /bankAccountTiersTable|bank_account_tiers|accountTierId/i);
  assert.doesNotMatch(adminRoutesSource, /bankAccountTiersTable|bank_account_tiers|accountTierId/i);
  assert.doesNotMatch(tierMigration, /bank_account_tiers|account_tier_id/i);
  assert.match(tierMigration, /ADD COLUMN IF NOT EXISTS admin_account_tier text/i);
  assert.notEqual(accountTierRouteStart, -1);
  assert.match(accountTierRoute, /requireAdmin/);
  assert.match(accountTierRoute, /verifyTransactionPin/);
  assert.match(accountTierRoute, /insert\(bankAuditLogsTable\)/);
  assert.match(accountTierRoute, /generatedAdminAuditReason\(req\)/);
  assert.match(accountTierRoute, /actorUserId:\s*actor\.id/);
  assert.match(accountTierRoute, /targetUserId:\s*user\.id/);
  assert.match(accountTierRoute, /action:\s*"assign_customer_account_tier"/);
});

test("Testing Mode clears only for an active paid subscription or admin grant", () => {
  assert.equal(isVaultTestingMode("none"), true);
  assert.equal(isVaultTestingMode("paystack_subscription"), false);
  assert.equal(isVaultTestingMode("admin_grant"), false);
  assert.equal(isVaultTestingMode("none", true), false);
  assert.equal(isVaultTestingMode("paystack_subscription", true), false);
  assert.match(
    readFileSync(new URL("../src/lib/bank-vault.ts", import.meta.url), "utf8"),
    /export async function isVaultSessionActive[\s\S]*?hasActiveVaultAccess/,
    "an admin grant should satisfy the same full-access check as a paid Vault plan",
  );
});

test("separate transfer grant bypasses transfer controls only", () => {
  assert.equal(isOutgoingTransferEnabled(false, true), true);
  assert.equal(isOutgoingTransferEnabled(false, false), false);
  assert.equal(
    bankRestrictionTypeError(
      new Set(["restrict_outgoing_transfers"]),
      "outgoing_transfer",
      true,
    ),
    null,
  );
  assert.match(
    bankRestrictionTypeError(
      new Set(["restrict_outgoing_transfers"]),
      "outgoing_transfer",
      false,
    ) ?? "",
    /restricted/i,
  );
  for (const hardStop of ["suspend_user", "under_review", "read_only", "freeze_wallet"]) {
    assert.notEqual(
      bankRestrictionTypeError(
        new Set([hardStop]),
        "outgoing_transfer",
        true,
      ),
      null,
      `${hardStop} must remain enforced even with a transfer grant`,
    );
  }
  assert.equal(
    bankRestrictionTypeError(
      new Set(["restrict_deposits"]),
      "outgoing_transfer",
      true,
    ),
    null,
    "unrelated operation restrictions do not become transfer controls",
  );
  assert.equal(
    resolveFutureTransferStatus("failed"),
    "failed",
    "an administrator's explicit no-posting mode remains authoritative",
  );
  assert.equal(resolveFutureTransferStatus("pending"), "pending");
  assert.equal(
    resolveFutureTransferStatus("successful"),
    "completed",
    "successful transfers post immediately without Vault access",
  );
  assert.equal(normalizeFutureTransferMode("unrecognized"), "successful");
  assert.equal(
    resolveFutureTransferStatus("unrecognized"),
    "completed",
    "an unset or legacy policy defaults to successful without requiring Vault access",
  );
  assert.equal(
    resolveFutureTransferStatus("failed", false),
    "completed",
    "a saved failed mode does not restrict transfers while Vault access is inactive",
  );
  assert.equal(
    resolveFutureTransferStatus("pending", false),
    "completed",
    "a saved pending mode does not hold transfers while Vault access is inactive",
  );
  assert.equal(
    resolveFutureTransferStatus("failed", true),
    "failed",
    "an active Vault policy can still explicitly select failed",
  );
});

test("deposit and transfer routes do not require a terms timestamp but retain access checks", () => {
  const routes = readFileSync(
    new URL("../src/routes/bank.ts", import.meta.url),
    "utf8",
  );
  const ledgerFundingRoute = routeBlockFrom(
    routes,
    'router.post("/bank/ledger-requests"',
  );
  const internationalTransferRoute = routeBlockFrom(
    routes,
    'router.post(\n  "/bank/international-transfer-requests"',
  );
  const walletControlReadRoute = routeBlockFrom(
    routes,
    'router.get(\n  "/bank/vault/wallet-controls"',
  );
  const walletControlUpdateRoute = routeBlockFrom(
    routes,
    'router.patch(\n  "/bank/vault/wallet-controls/:walletId"',
  );
  const adminRoutes = readFileSync(
    new URL("../src/routes/bankAdmin.ts", import.meta.url),
    "utf8",
  );
  const adminVaultGrantRoute = routeBlockFrom(
    adminRoutes,
    'router.post(\n  "/bank/admin/users/:userId/vault-access/grant"',
  );

  assert.doesNotMatch(ledgerFundingRoute, /acceptedTermsAt|Complete account setup/i);
  assert.match(ledgerFundingRoute, /user\.accountStatus !== "active"/);
  assert.match(ledgerFundingRoute, /hasActiveVaultAccess\(user\)/);
  assert.match(ledgerFundingRoute, /verifyTransactionPin/);
  assert.doesNotMatch(internationalTransferRoute, /acceptedTermsAt|Complete account setup/i);
  assert.match(internationalTransferRoute, /sender\.accountStatus !== "active"/);
  assert.match(internationalTransferRoute, /verifyTransactionPin/);
  assert.match(internationalTransferRoute, /transferAccessGranted/);
  assert.match(
    internationalTransferRoute,
    /resolveFutureTransferStatus\(\s*lockedWallet\.futureTransferMode,\s*await hasActiveVaultAccess\(lockedSender, tx\)/,
    "wallet status overrides apply only while the user has active Vault access",
  );
  assert.match(
    internationalTransferRoute,
    /requestedRecipientEmail\s*\?\s*await vaultTransferEmailAlertsEnabled\(sender\)\s*:\s*false/,
    "empty recipient email should not depend on Vault email-alert settings",
  );
  assert.match(walletControlReadRoute, /isVaultSessionActive/);
  assert.match(walletControlUpdateRoute, /isVaultSessionActive/);
  assert.match(adminVaultGrantRoute, /requireAdmin/);
  assert.match(adminVaultGrantRoute, /verifyTransactionPin/);
  assert.match(adminVaultGrantRoute, /applyAdminVaultEntitlementAction/);
});

test("new wallets default to enabled, successful transfers without rewriting saved wallet policies", () => {
  const schema = readFileSync(
    new URL("../../../lib/db/src/schema/bank.ts", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL("../../../lib/db/migrations/20261121_wallet_transfer_defaults.sql", import.meta.url),
    "utf8",
  );
  assert.match(schema, /transfersEnabled: boolean\("transfers_enabled"\)\.notNull\(\)\.default\(true\)/);
  assert.match(schema, /futureTransferMode: text\("future_transfer_mode"\)\.notNull\(\)\.default\("successful"\)/);
  assert.match(migration, /ALTER COLUMN transfers_enabled SET DEFAULT true/i);
  assert.match(migration, /ALTER COLUMN future_transfer_mode SET DEFAULT 'successful'/i);
  assert.doesNotMatch(migration, /UPDATE\s+public\.bank_wallets/i);
});

test("failed Paystack charges are matched to the correct initial or renewal payment", () => {
  const initialPayment = {
    vaultSubscriptionStatus: "inactive",
    vaultSubscriptionExpiresAt: null,
    vaultSubscriptionPaymentReference: "GBV-initial",
    vaultSubscriptionPaymentStatus: "pending",
    vaultSubscriptionAmountMinor: "1200000",
    vaultSubscriptionAutoRenew: false,
    vaultPaystackPlanCode: null,
    vaultPaystackSubscriptionCode: null,
    vaultPaystackCustomerCode: null,
  };
  assert.equal(
    classifyVaultPaystackChargeFailure(initialPayment, {
      reference: "GBV-initial",
      amount: 1_200_000,
      currency: "NGN",
      customerCode: null,
      subscriptionCode: null,
      providerPlanCode: null,
    }),
    "initial",
  );
  const recurringPayment = {
    ...initialPayment,
    vaultSubscriptionStatus: "active",
    vaultSubscriptionExpiresAt: new Date(Date.now() + 60_000),
    vaultSubscriptionPaymentReference: "GBV-old",
    vaultSubscriptionPaymentStatus: "success",
    vaultSubscriptionAutoRenew: true,
    vaultPaystackPlanCode: "PLN_MONTHLY",
    vaultPaystackSubscriptionCode: "SUB_MONTHLY",
    vaultPaystackCustomerCode: "CUS_MEMBER",
  };
  assert.equal(
    classifyVaultPaystackChargeFailure(recurringPayment, {
      reference: "GBV-renewal",
      amount: 1_200_000,
      currency: "NGN",
      customerCode: "CUS_MEMBER",
      subscriptionCode: "SUB_MONTHLY",
      providerPlanCode: "PLN_MONTHLY",
    }),
    "renewal",
  );
  assert.equal(
    classifyVaultPaystackChargeFailure(recurringPayment, {
      reference: "GBV-renewal",
      amount: 1_200_001,
      currency: "NGN",
      customerCode: "CUS_MEMBER",
      subscriptionCode: "SUB_MONTHLY",
      providerPlanCode: "PLN_MONTHLY",
    }),
    null,
  );
});

test("subscriber top-up amount parsing supports the expanded ledger range", () => {
  assert.equal(parseAmountToMinor("2000000.50", 16), 200_000_050n);
  assert.throws(() => parseAmountToMinor("2000000000000.50"), /valid amount/i);
});

test("customer ledger labels are normalized and default safely", () => {
  assert.equal(
    normalizeVaultTopUpDescription("  Monthly  \n\x00 savings  "),
    "Monthly savings",
  );
  assert.equal(normalizeVaultTopUpDescription(" \n "), "Private Vault internal wallet credit");
});
