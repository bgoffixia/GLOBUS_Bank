import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import express from "express";
import { after, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import {
  bankAccountTiersTable,
  bankAuditLogsTable,
  bankVaultAdminEntitlementsTable,
  bankVaultSessionsTable,
  bankUsersTable,
  db,
  pool,
} from "@workspace/db";
import { hashTransactionPin } from "../src/lib/transaction-pin";
import { setPasswordResetCache } from "../src/lib/password-reset";
import {
  getVaultAccessSource,
  hasActiveVaultAccess,
  isVaultTestingMode,
} from "../src/lib/bank-vault";
import adminRouter from "../src/routes/bankAdmin";

const suffix = randomUUID();
const adminId = `vault-access-admin-${suffix}`;
const nonAdminId = `vault-access-member-${suffix}`;
const targetId = `vault-access-target-${suffix}`;
const paidUserId = `vault-access-paid-${suffix}`;
const targetEmail = `${targetId}@example.test`;
const adminPin = "481639";
const originalAdminIds = process.env.GLOBUS_ADMIN_CLERK_IDS;
const originalAdminEmails = process.env.GLOBUS_ADMIN_EMAILS;
let createdTierId: string | null = null;

after(async () => {
  const ids = [adminId, nonAdminId, targetId, paidUserId];
  try {
    try {
      await db.delete(bankVaultAdminEntitlementsTable).where(inArray(bankVaultAdminEntitlementsTable.userId, ids));
    } catch (error) {
      if ((error as { cause?: { code?: string } }).cause?.code !== "42P01") throw error;
    }
    await db.delete(bankVaultSessionsTable).where(inArray(bankVaultSessionsTable.userId, ids));
    await db.delete(bankAuditLogsTable).where(
      inArray(bankAuditLogsTable.actorUserId, ids),
    );
    await db.delete(bankAuditLogsTable).where(
      inArray(bankAuditLogsTable.targetUserId, ids),
    );
    await db
      .update(bankUsersTable)
      .set({ accountTierId: "standard" })
      .where(inArray(bankUsersTable.id, ids));
    await db.delete(bankUsersTable).where(inArray(bankUsersTable.id, ids));
    if (createdTierId) {
      await db
        .delete(bankAccountTiersTable)
        .where(eq(bankAccountTiersTable.id, createdTierId));
    }
  } finally {
    await pool.end();
    if (originalAdminIds === undefined) delete process.env.GLOBUS_ADMIN_CLERK_IDS;
    else process.env.GLOBUS_ADMIN_CLERK_IDS = originalAdminIds;
    if (originalAdminEmails === undefined) delete process.env.GLOBUS_ADMIN_EMAILS;
    else process.env.GLOBUS_ADMIN_EMAILS = originalAdminEmails;
  }
});

test("only an allowlisted administrator with a transaction PIN can grant or revoke separate Vault access", async () => {
  process.env.GLOBUS_ADMIN_CLERK_IDS = adminId;
  process.env.GLOBUS_ADMIN_EMAILS = "";
  setPasswordResetCache(adminId, false);
  setPasswordResetCache(nonAdminId, false);
  await db.insert(bankUsersTable).values([
    {
      id: adminId,
      email: `${adminId}@example.test`,
      transactionPinHash: await hashTransactionPin(adminPin),
    },
    { id: nonAdminId, email: `${nonAdminId}@example.test` },
    { id: targetId, email: targetEmail, firstName: "Vault", lastName: "Member" },
    {
      id: paidUserId,
      email: `${paidUserId}@example.test`,
      vaultSubscriptionStatus: "active",
      vaultSubscriptionExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  ]);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const actorId = req.header("x-test-user-id") || null;
    const authHandler = Object.assign(
      () => ({
        userId: actorId,
        tokenType: "session_token",
        sessionClaims: {},
      }),
      { [Symbol.for("@clerk/express.auth")]: true },
    );
    (req as unknown as { auth: typeof authHandler }).auth = authHandler;
    next();
  });
  app.use("/api", adminRouter);
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/bank/admin`;

  const request = async (
    path: string,
    actorId: string | null,
    init: RequestInit = {},
  ) => fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(actorId ? { "x-test-user-id": actorId } : {}),
      ...init.headers,
    },
  });

  try {
    const anonymous = await request("/vault-access?search=target", null);
    assert.equal(anonymous.status, 401);
    const nonAdmin = await request(
      "/vault-access?search=target",
      nonAdminId,
    );
    assert.equal(nonAdmin.status, 403, await nonAdmin.clone().text());
    const unauthorizedGrant = await request(
      `/users/${targetId}/vault-access/grant`,
      nonAdminId,
      {
        method: "POST",
        body: JSON.stringify({
          reason: "Unauthorized grant test",
          transactionPin: adminPin,
          confirmed: true,
        }),
      },
    );
    assert.equal(unauthorizedGrant.status, 403);
    const selfGrant = await request(`/users/${adminId}/vault-access/grant`, adminId, {
      method: "POST",
      body: JSON.stringify({
        reason: "Self grant is prohibited",
        transactionPin: adminPin,
        confirmed: true,
      }),
    });
    assert.equal(selfGrant.status, 403);

    const tierInput = {
      name: "Test customer tier",
      description: "Tier assignment integration test.",
      vaultPlanCode: null,
      active: true,
      reason: "Create account tier for test",
      transactionPin: adminPin,
      confirmed: true,
    };
    const unauthorizedTierCreate = await request("/account-tiers", nonAdminId, {
      method: "POST",
      body: JSON.stringify(tierInput),
    });
    assert.equal(unauthorizedTierCreate.status, 403);
    const tierCreate = await request("/account-tiers", adminId, {
      method: "POST",
      body: JSON.stringify(tierInput),
    });
    assert.equal(tierCreate.status, 201, await tierCreate.clone().text());
    const tierCreatedData = await tierCreate.json() as {
      item: { id: string; name: string; vaultPlanCode: string | null };
    };
    createdTierId = tierCreatedData.item.id;
    assert.equal(tierCreatedData.item.name, tierInput.name);
    assert.equal(tierCreatedData.item.vaultPlanCode, null);

    const tierUpdate = await request(`/account-tiers/${createdTierId}`, adminId, {
      method: "PATCH",
      body: JSON.stringify({
        ...tierInput,
        name: "Test customer tier updated",
        reason: "Update account tier for test",
      }),
    });
    assert.equal(tierUpdate.status, 200, await tierUpdate.clone().text());

    const unauthorizedAssignment = await request(
      `/users/${targetId}/account-tier`,
      nonAdminId,
      {
        method: "PATCH",
        body: JSON.stringify({
          tierId: createdTierId,
          reason: "Unauthorized tier change",
          transactionPin: adminPin,
          confirmed: true,
        }),
      },
    );
    assert.equal(unauthorizedAssignment.status, 403);
    const selfTierAssignment = await request(
      `/users/${adminId}/account-tier`,
      adminId,
      {
        method: "PATCH",
        body: JSON.stringify({
          tierId: createdTierId,
          reason: "Self tier change is prohibited",
          transactionPin: adminPin,
          confirmed: true,
        }),
      },
    );
    assert.equal(selfTierAssignment.status, 403);
    const tierAssignment = await request(
      `/users/${targetId}/account-tier`,
      adminId,
      {
        method: "PATCH",
        body: JSON.stringify({
          tierId: createdTierId,
          reason: "Assign customer tier",
          transactionPin: adminPin,
          confirmed: true,
        }),
      },
    );
    assert.equal(tierAssignment.status, 200, await tierAssignment.clone().text());
    const assigned = await tierAssignment.json() as {
      userId: string;
      accountTierId: string;
      accountTierName: string;
    };
    assert.equal(assigned.userId, targetId);
    assert.equal(assigned.accountTierId, createdTierId);
    assert.equal(assigned.accountTierName, "Test customer tier updated");
    assert.equal(
      await getVaultAccessSource({
        id: targetId,
        vaultSubscriptionStatus: "inactive",
        vaultSubscriptionExpiresAt: null,
      }),
      "none",
    );
    assert.equal(isVaultTestingMode("none"), true);

    const initialSearch = await request(
      `/vault-access?search=${encodeURIComponent(targetEmail)}`,
      adminId,
    );
    assert.equal(initialSearch.status, 200);
    const initialData = await initialSearch.json() as { items: Array<{ userId: string; accessSource: string; adminGrantActive: boolean }> };
    assert.equal(initialData.items[0]?.userId, targetId);
    assert.equal(initialData.items[0]?.accessSource, "none");

    const badPinResponse = await request(`/users/${targetId}/vault-access/grant`, adminId, {
      method: "POST",
      body: JSON.stringify({
        reason: "Authorized access request",
        transactionPin: "000000",
        confirmed: true,
      }),
    });
    assert.equal(badPinResponse.status, 403);
    assert.equal(await hasActiveVaultAccess({
      id: targetId,
      vaultSubscriptionStatus: "inactive",
      vaultSubscriptionExpiresAt: null,
    }), false);

    const grantResponse = await request(`/users/${targetId}/vault-access/grant`, adminId, {
      method: "POST",
      body: JSON.stringify({
        reason: "Approved access for support case",
        transactionPin: adminPin,
        confirmed: true,
      }),
    });
    assert.equal(grantResponse.status, 200);
    const granted = await grantResponse.json() as {
      adminGrantActive: boolean;
      accessActive: boolean;
      accessSource: string;
      subscriptionActive: boolean;
      adminGrantByUserId: string;
    };
    assert.equal(granted.adminGrantActive, true);
    assert.equal(granted.accessActive, true);
    assert.equal(granted.accessSource, "admin_grant");
    assert.equal(granted.subscriptionActive, false);
    assert.equal(granted.adminGrantByUserId, adminId);
    assert.equal(await hasActiveVaultAccess({
      id: targetId,
      vaultSubscriptionStatus: "inactive",
      vaultSubscriptionExpiresAt: null,
    }), true);

    const [audit] = await db
      .select()
      .from(bankAuditLogsTable)
      .where(and(
        eq(bankAuditLogsTable.actorUserId, adminId),
        eq(bankAuditLogsTable.targetUserId, targetId),
        eq(bankAuditLogsTable.action, "grant_admin_private_vault_access"),
      ));
    assert.equal(audit?.reason, "Approved access for support case");
    assert.ok(audit?.createdAt instanceof Date);

    await db.insert(bankVaultSessionsTable).values({
      userId: targetId,
      tokenHash: `revocation-session-${suffix}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const revokeResponse = await request(`/users/${targetId}/vault-access/revoke`, adminId, {
      method: "POST",
      body: JSON.stringify({
        reason: "Access period completed",
        transactionPin: adminPin,
        confirmed: true,
      }),
    });
    assert.equal(revokeResponse.status, 200);
    const revoked = await revokeResponse.json() as {
      adminGrantActive: boolean;
      accessActive: boolean;
      accessSource: string;
    };
    assert.equal(revoked.adminGrantActive, false);
    assert.equal(revoked.accessActive, false);
    assert.equal(revoked.accessSource, "none");
    assert.equal(await hasActiveVaultAccess({
      id: targetId,
      vaultSubscriptionStatus: "inactive",
      vaultSubscriptionExpiresAt: null,
    }), false);
    const [remainingSession] = await db
      .select({ id: bankVaultSessionsTable.id })
      .from(bankVaultSessionsTable)
      .where(eq(bankVaultSessionsTable.userId, targetId));
    assert.equal(remainingSession, undefined);

    const paidGrant = await request(`/users/${paidUserId}/vault-access/grant`, adminId, {
      method: "POST",
      body: JSON.stringify({
        reason: "Temporary courtesy entitlement",
        transactionPin: adminPin,
        confirmed: true,
      }),
    });
    assert.equal(paidGrant.status, 200);
    const paidRevoke = await request(`/users/${paidUserId}/vault-access/revoke`, adminId, {
      method: "POST",
      body: JSON.stringify({
        reason: "Courtesy period ended",
        transactionPin: adminPin,
        confirmed: true,
      }),
    });
    assert.equal(paidRevoke.status, 200);
    assert.equal(
      await getVaultAccessSource({
        id: paidUserId,
        vaultSubscriptionStatus: "active",
        vaultSubscriptionExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }),
      "paystack_subscription",
    );
    const [paidUser] = await db
      .select({
        status: bankUsersTable.vaultSubscriptionStatus,
        paymentStatus: bankUsersTable.vaultSubscriptionPaymentStatus,
      })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, paidUserId));
    assert.equal(paidUser.status, "active");
    assert.equal(paidUser.paymentStatus, "none");

    const paidAuditActions = await db
      .select({ action: bankAuditLogsTable.action })
      .from(bankAuditLogsTable)
      .where(and(
        eq(bankAuditLogsTable.actorUserId, adminId),
        eq(bankAuditLogsTable.targetUserId, paidUserId),
      ));
    assert.deepEqual(
      paidAuditActions.map((entry) => entry.action).sort(),
      [
        "grant_admin_private_vault_access",
        "revoke_admin_private_vault_access",
      ],
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
