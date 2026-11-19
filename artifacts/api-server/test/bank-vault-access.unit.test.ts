import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyVaultPaystackChargeFailure,
  getVaultAccessSource,
  hasActiveVaultAccess,
  hasActiveVaultSubscription,
  hasImmediateTransferAccess,
  isVaultTestingMode,
  resolveEffectiveAccountTier,
} from "../src/lib/bank-vault";
import { parseAmountToMinor } from "../src/lib/bank";
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

test("a valid paid plan selects its mapped tier and expiry restores the assigned tier", () => {
  const assignedTier = { id: "gold", name: "Gold" };
  const mappedTier = { id: "vault-annual", name: "Vault Annual" };
  const user = {
    vaultSubscriptionStatus: "active",
    vaultSubscriptionExpiresAt: new Date(Date.now() + 60_000),
  };
  assert.deepEqual(
    resolveEffectiveAccountTier(user, mappedTier, assignedTier),
    { ...mappedTier, source: "paystack_subscription" },
  );
  assert.deepEqual(
    resolveEffectiveAccountTier(
      { ...user, vaultSubscriptionExpiresAt: new Date(Date.now() - 60_000) },
      mappedTier,
      assignedTier,
    ),
    { ...assignedTier, source: "admin_assigned" },
  );
});

test("Testing Mode clears only for an active paid subscription or admin grant", () => {
  assert.equal(isVaultTestingMode("none"), true);
  assert.equal(isVaultTestingMode("paystack_subscription"), false);
  assert.equal(isVaultTestingMode("admin_grant"), false);
  assert.equal(isVaultTestingMode("none", true), false);
  assert.equal(isVaultTestingMode("paystack_subscription", true), false);
});

test("separate transfer access works without granting Vault access", () => {
  assert.equal(hasImmediateTransferAccess(false, false), false);
  assert.equal(hasImmediateTransferAccess(false, true), true);
  assert.equal(hasImmediateTransferAccess(true, false), true);
  assert.equal(isVaultTestingMode("none"), true);
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
