import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { eq, inArray, sql } from "drizzle-orm";
import {
  bankAuditLogsTable,
  bankLedgerEntriesTable,
  bankNotificationsTable,
  bankSandboxRequestsTable,
  bankTransactionsTable,
  bankVaultAdminEntitlementsTable,
  bankUsersTable,
  bankWalletsTable,
  db,
  pool,
} from "@workspace/db";
import { createVaultSubscriberTopUp } from "../src/lib/vault-subscriber-deposit";

const userId = `vault-deposit-${randomUUID()}`;
const grantorId = `vault-deposit-admin-${randomUUID()}`;
const email = `${userId}@example.test`;
const idempotencyPrefix = `vault-subscriber-top-up:${randomUUID()}`;
let walletId: string | null = null;

after(async () => {
  const transactions = await db
    .select({ id: bankTransactionsTable.id })
    .from(bankTransactionsTable)
    .where(eq(bankTransactionsTable.initiatedByUserId, userId));
  const transactionIds = transactions.map((transaction) => transaction.id);
  await db.delete(bankAuditLogsTable).where(
    sql`${bankAuditLogsTable.actorUserId} = ${userId} or ${bankAuditLogsTable.targetUserId} = ${userId}`,
  );
  await db
    .delete(bankNotificationsTable)
    .where(eq(bankNotificationsTable.userId, userId));
  await db
    .delete(bankSandboxRequestsTable)
    .where(eq(bankSandboxRequestsTable.userId, userId));
  if (transactionIds.length) {
    await db
      .delete(bankLedgerEntriesTable)
      .where(inArray(bankLedgerEntriesTable.transactionId, transactionIds));
  }
  await db
    .delete(bankTransactionsTable)
    .where(eq(bankTransactionsTable.initiatedByUserId, userId));
  if (walletId) {
    await db.delete(bankWalletsTable).where(eq(bankWalletsTable.id, walletId));
  }
  await db.delete(bankVaultAdminEntitlementsTable).where(eq(bankVaultAdminEntitlementsTable.userId, userId));
  await db.delete(bankUsersTable).where(eq(bankUsersTable.id, userId));
  await db.delete(bankUsersTable).where(eq(bankUsersTable.id, grantorId));
  await pool.end();
});

test("active Vault subscriber top-ups post a balanced wallet credit immediately", async () => {
  await db.insert(bankUsersTable).values({
    id: userId,
    email,
    accountStatus: "active",
    verificationStatus: "approved",
    vaultSubscriptionStatus: "active",
    vaultSubscriptionExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  const [wallet] = await db
    .insert(bankWalletsTable)
    .values({ userId, currency: "USD" })
    .returning();
  walletId = wallet.id;

  const result = await db.transaction((tx) =>
    createVaultSubscriberTopUp(tx, {
      userId,
      currency: "USD",
      amountMinor: 200_000_000n,
      idempotencyKey: `${idempotencyPrefix}:credited`,
      description: "Monthly savings contribution",
    }),
  );
  assert.ok(!("error" in result));
  assert.equal(result.transaction.status, "completed");
  assert.equal(result.transaction.description, "Monthly savings contribution");
  assert.equal(result.sandboxRequest.status, "approved");
  assert.equal(result.sandboxRequest.paymentMethod, null);
  assert.equal(result.notification.title, "Internal ledger credit posted");

  const repeatedResult = await db.transaction((tx) =>
    createVaultSubscriberTopUp(tx, {
      userId,
      currency: "USD",
      amountMinor: 200_000_000n,
      idempotencyKey: `${idempotencyPrefix}:credited`,
      description: "Monthly savings contribution",
    }),
  );
  assert.ok(!("error" in repeatedResult));
  assert.equal(repeatedResult.transaction.id, result.transaction.id);
  assert.equal(repeatedResult.notification, null);

  const entries = await db
    .select()
    .from(bankLedgerEntriesTable)
    .where(eq(bankLedgerEntriesTable.transactionId, result.transaction.id));
  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => [entry.side, entry.amountMinor.toString()]).sort(),
    [
      ["credit", "200000000"],
      ["debit", "200000000"],
    ],
  );
  assert.ok(entries.some((entry) => entry.walletId === wallet.id && entry.side === "credit"));
  const [balance] = await db
    .select({
      amount: sql<string>`coalesce(sum(case when ${bankLedgerEntriesTable.side} = 'credit' then ${bankLedgerEntriesTable.amountMinor} else -${bankLedgerEntriesTable.amountMinor} end), 0)::text`,
    })
    .from(bankLedgerEntriesTable)
    .where(eq(bankLedgerEntriesTable.walletId, wallet.id));
  assert.equal(balance.amount, "200000000");
});

test("expired subscribers cannot create or post wallet top-ups", async () => {
  await db
    .update(bankUsersTable)
    .set({
      vaultSubscriptionStatus: "active",
      vaultSubscriptionExpiresAt: new Date(Date.now() - 1000),
    })
    .where(eq(bankUsersTable.id, userId));

  const result = await db.transaction((tx) =>
    createVaultSubscriberTopUp(tx, {
      userId,
      currency: "USD",
      amountMinor: 2_500n,
      idempotencyKey: `${idempotencyPrefix}:blocked`,
    }),
  );
  assert.ok("error" in result);
  assert.match(result.error, /active Private Vault access/i);
  const transactions = await db
    .select({ id: bankTransactionsTable.id })
    .from(bankTransactionsTable)
    .where(eq(bankTransactionsTable.initiatedByUserId, userId));
  assert.equal(transactions.length, 1);
});

test("a separate admin entitlement permits Vault top-ups and revocation removes only that access", async () => {
  await db.insert(bankUsersTable).values({
    id: grantorId,
    email: `${grantorId}@example.test`,
  });
  await db.update(bankUsersTable)
    .set({
      vaultSubscriptionStatus: "expired",
      vaultSubscriptionExpiresAt: new Date(Date.now() - 1000),
    })
    .where(eq(bankUsersTable.id, userId));
  await db.insert(bankVaultAdminEntitlementsTable).values({
    userId,
    grantedByUserId: grantorId,
    reason: "Approved access test",
  });
  const grantedResult = await db.transaction((tx) =>
    createVaultSubscriberTopUp(tx, {
      userId,
      currency: "USD",
      amountMinor: 1_200n,
      idempotencyKey: `${idempotencyPrefix}:manual-grant`,
    }),
  );
  assert.ok(!("error" in grantedResult));
  const [userWithGrant] = await db
    .select({
      status: bankUsersTable.vaultSubscriptionStatus,
      expiresAt: bankUsersTable.vaultSubscriptionExpiresAt,
    })
    .from(bankUsersTable)
    .where(eq(bankUsersTable.id, userId));
  assert.equal(userWithGrant.status, "expired");
  assert.ok(userWithGrant.expiresAt);

  await db.delete(bankVaultAdminEntitlementsTable).where(eq(bankVaultAdminEntitlementsTable.userId, userId));
  const revokedResult = await db.transaction((tx) =>
    createVaultSubscriberTopUp(tx, {
      userId,
      currency: "USD",
      amountMinor: 1_300n,
      idempotencyKey: `${idempotencyPrefix}:revoked`,
    }),
  );
  assert.ok("error" in revokedResult);
  assert.match(revokedResult.error, /active Private Vault access/i);
});
