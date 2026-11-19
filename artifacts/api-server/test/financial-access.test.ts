import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import {
  bankRestrictionsTable,
  bankVaultAdminEntitlementsTable,
  bankUsersTable,
  db,
  pool,
} from "@workspace/db";
import {
  bankOperationRestrictionError,
  getBankOperationEligibility,
} from "../src/lib/bank";

const userId = `financial-access-${randomUUID()}`;
const adminId = `financial-access-admin-${randomUUID()}`;
const email = `${userId}@example.test`;

after(async () => {
  await db.delete(bankRestrictionsTable).where(eq(bankRestrictionsTable.userId, userId));
  await db.delete(bankVaultAdminEntitlementsTable).where(eq(bankVaultAdminEntitlementsTable.userId, userId));
  await db.delete(bankUsersTable).where(eq(bankUsersTable.id, userId));
  await db.delete(bankUsersTable).where(eq(bankUsersTable.id, adminId));
  await pool.end();
});

test("active Private Vault access and operation-specific restrictions gate deposits and withdrawals", async () => {
  await db.insert(bankUsersTable).values({
    id: userId,
    email,
    verificationStatus: "pending",
  });
  await db.insert(bankUsersTable).values({
    id: adminId,
    email: `${adminId}@example.test`,
  });

  assert.deepEqual(
    await getBankOperationEligibility(userId, "active"),
    {
      depositAllowed: false,
      withdrawalAllowed: false,
      vaultSubscriptionActive: false,
      vaultAccessActive: false,
      vaultAccessSource: "none",
    },
  );
  const [depositWithoutSubscription, withdrawalWithoutSubscription] =
    await db.transaction(async (tx) => [
      await bankOperationRestrictionError(tx, { userId, operation: "deposit" }),
      await bankOperationRestrictionError(tx, { userId, operation: "withdrawal" }),
    ]);
  assert.match(depositWithoutSubscription ?? "", /active Private Vault access/i);
  assert.match(withdrawalWithoutSubscription ?? "", /active Private Vault access/i);

  await db
    .update(bankUsersTable)
    .set({
      vaultSubscriptionStatus: "active",
      vaultSubscriptionExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    .where(eq(bankUsersTable.id, userId));
  assert.deepEqual(
    await getBankOperationEligibility(userId, "active"),
    {
      depositAllowed: true,
      withdrawalAllowed: true,
      vaultSubscriptionActive: true,
      vaultAccessActive: true,
      vaultAccessSource: "paystack_subscription",
    },
  );

  await db
    .update(bankUsersTable)
    .set({ verificationStatus: "rejected" })
    .where(eq(bankUsersTable.id, userId));
  assert.deepEqual(
    await getBankOperationEligibility(userId, "active"),
    {
      depositAllowed: true,
      withdrawalAllowed: true,
      vaultSubscriptionActive: true,
      vaultAccessActive: true,
      vaultAccessSource: "paystack_subscription",
    },
  );

  await db.insert(bankRestrictionsTable).values({
    userId,
    type: "restrict_deposits",
    reason: "Test deposit-only restriction",
    createdByUserId: userId,
  });

  assert.deepEqual(
    await getBankOperationEligibility(userId, "active"),
    {
      depositAllowed: false,
      withdrawalAllowed: true,
      vaultSubscriptionActive: true,
      vaultAccessActive: true,
      vaultAccessSource: "paystack_subscription",
    },
  );
  const [depositError, withdrawalError] = await db.transaction(async (tx) => [
    await bankOperationRestrictionError(tx, { userId, operation: "deposit" }),
    await bankOperationRestrictionError(tx, { userId, operation: "withdrawal" }),
  ]);
  assert.match(depositError ?? "", /deposits are restricted/i);
  assert.equal(withdrawalError, null);

  await db.delete(bankRestrictionsTable).where(eq(bankRestrictionsTable.userId, userId));
  await db.update(bankUsersTable)
    .set({
      vaultSubscriptionStatus: "expired",
      vaultSubscriptionExpiresAt: new Date(Date.now() - 1000),
    })
    .where(eq(bankUsersTable.id, userId));
  await db.insert(bankVaultAdminEntitlementsTable).values({
    userId,
    grantedByUserId: adminId,
    reason: "Approved access test",
  });
  assert.deepEqual(
    await getBankOperationEligibility(userId, "active"),
    {
      depositAllowed: true,
      withdrawalAllowed: true,
      vaultSubscriptionActive: false,
      vaultAccessActive: true,
      vaultAccessSource: "admin_grant",
    },
  );

  await db.delete(bankVaultAdminEntitlementsTable).where(eq(bankVaultAdminEntitlementsTable.userId, userId));
  assert.deepEqual(
    await getBankOperationEligibility(userId, "active"),
    {
      depositAllowed: false,
      withdrawalAllowed: false,
      vaultSubscriptionActive: false,
      vaultAccessActive: false,
      vaultAccessSource: "none",
    },
  );
});
