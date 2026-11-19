import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getVaultAccessSource,
  hasActiveVaultAccess,
  hasActiveVaultSubscription,
} from "../src/lib/bank-vault";

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
