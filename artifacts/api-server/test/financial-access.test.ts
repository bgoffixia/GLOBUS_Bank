import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import {
  bankRestrictionsTable,
  bankUsersTable,
  db,
  pool,
} from "@workspace/db";
import {
  bankOperationRestrictionError,
  getBankOperationEligibility,
} from "../src/lib/bank";

const userId = `financial-access-${randomUUID()}`;
const email = `${userId}@example.test`;

after(async () => {
  await db.delete(bankRestrictionsTable).where(eq(bankRestrictionsTable.userId, userId));
  await db.delete(bankUsersTable).where(eq(bankUsersTable.id, userId));
  await pool.end();
});

test("active Private Vault access and operation-specific restrictions gate deposits and withdrawals", async () => {
  await db.insert(bankUsersTable).values({
    id: userId,
    email,
    verificationStatus: "pending",
  });

  assert.deepEqual(
    await getBankOperationEligibility(userId, "active"),
    { depositAllowed: false, withdrawalAllowed: false, vaultSubscriptionActive: false },
  );
  const [depositWithoutSubscription, withdrawalWithoutSubscription] =
    await db.transaction(async (tx) => [
      await bankOperationRestrictionError(tx, { userId, operation: "deposit" }),
      await bankOperationRestrictionError(tx, { userId, operation: "withdrawal" }),
    ]);
  assert.match(depositWithoutSubscription ?? "", /active Private Vault subscription/i);
  assert.match(withdrawalWithoutSubscription ?? "", /active Private Vault subscription/i);

  await db
    .update(bankUsersTable)
    .set({
      vaultSubscriptionStatus: "active",
      vaultSubscriptionExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    .where(eq(bankUsersTable.id, userId));
  assert.deepEqual(
    await getBankOperationEligibility(userId, "active"),
    { depositAllowed: true, withdrawalAllowed: true, vaultSubscriptionActive: true },
  );

  await db
    .update(bankUsersTable)
    .set({ verificationStatus: "rejected" })
    .where(eq(bankUsersTable.id, userId));
  assert.deepEqual(
    await getBankOperationEligibility(userId, "active"),
    { depositAllowed: true, withdrawalAllowed: true, vaultSubscriptionActive: true },
  );

  await db.insert(bankRestrictionsTable).values({
    userId,
    type: "restrict_deposits",
    reason: "Test deposit-only restriction",
    createdByUserId: userId,
  });

  assert.deepEqual(
    await getBankOperationEligibility(userId, "active"),
    { depositAllowed: false, withdrawalAllowed: true, vaultSubscriptionActive: true },
  );
  const [depositError, withdrawalError] = await db.transaction(async (tx) => [
    await bankOperationRestrictionError(tx, { userId, operation: "deposit" }),
    await bankOperationRestrictionError(tx, { userId, operation: "withdrawal" }),
  ]);
  assert.match(depositError ?? "", /deposits are restricted/i);
  assert.equal(withdrawalError, null);
});
