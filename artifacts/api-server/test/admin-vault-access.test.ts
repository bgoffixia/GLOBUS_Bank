import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import express from "express";
import { after, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import {
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
const expiredGrantUserId = `vault-access-expired-${suffix}`;
const paidUserId = `vault-access-paid-${suffix}`;
const targetEmail = `${targetId}@example.test`;
const adminPin = "481639";
const originalAdminIds = process.env.GLOBUS_ADMIN_CLERK_IDS;
const originalAdminEmails = process.env.GLOBUS_ADMIN_EMAILS;
after(async () => {
    const ids = [adminId, nonAdminId, targetId, expiredGrantUserId, paidUserId];
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
    await db.delete(bankUsersTable).where(inArray(bankUsersTable.id, ids));
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
      { id: expiredGrantUserId, email: `${expiredGrantUserId}@example.test` },
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
    const directory = await request(
      `/users?search=${encodeURIComponent(targetId)}`,
      adminId,
    );
    assert.equal(directory.status, 200, await directory.clone().text());
    const directoryPayload = await directory.json() as {
      items: Array<{
        id: string;
        profileSetupCompletedAt: string | null;
        testingModeDisabled: boolean;
        transferAccessGranted: boolean;
      }>;
    };
    const targetListItem = directoryPayload.items.find((item) => item.id === targetId);
    assert.ok(targetListItem);
    assert.equal(targetListItem.profileSetupCompletedAt, null);
    assert.equal(targetListItem.testingModeDisabled, false);
    assert.equal(targetListItem.transferAccessGranted, false);

    const detail = await request(`/users/${targetId}`, adminId);
    assert.equal(detail.status, 200, await detail.clone().text());
    const detailPayload = await detail.json() as {
      user: {
        profileSetupCompletedAt: string | null;
        testingModeDisabled: boolean;
        transferAccessGranted: boolean;
      };
      profileSetupCompletedAt: string | null;
    };
    assert.equal(detailPayload.user.profileSetupCompletedAt, null);
    assert.equal(detailPayload.profileSetupCompletedAt, null);
    assert.equal(detailPayload.user.testingModeDisabled, false);
    assert.equal(detailPayload.user.transferAccessGranted, false);

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
          transactionPin: adminPin,
          confirmed: true,
          duration: "7d",
        }),
      },
    );
    assert.equal(unauthorizedGrant.status, 403);
    const unauthorizedAccessControls = await request(
      `/users/${targetId}/access-controls`,
      nonAdminId,
      {
        method: "PATCH",
        body: JSON.stringify({
          testingModeDisabled: true,
          transferAccessGranted: true,
          reason: "Unauthorized access change.",
          transactionPin: adminPin,
          confirmed: true,
        }),
      },
    );
    assert.equal(unauthorizedAccessControls.status, 403);
    const invalidAccessControls = await request(
      `/users/${targetId}/access-controls`,
      adminId,
      {
        method: "PATCH",
        body: JSON.stringify({
          testingModeDisabled: true,
          transferAccessGranted: true,
          transactionPin: "123",
          confirmed: true,
        }),
      },
    );
    assert.equal(invalidAccessControls.status, 400);
    const grantControls = await request(
      `/users/${targetId}/access-controls`,
      adminId,
      {
        method: "PATCH",
        body: JSON.stringify({
          testingModeDisabled: true,
          transferAccessGranted: true,
          transactionPin: adminPin,
          confirmed: true,
        }),
      },
    );
    assert.equal(grantControls.status, 200, await grantControls.clone().text());
    assert.deepEqual(await grantControls.json(), {
      userId: targetId,
      testingModeDisabled: true,
      transferAccessGranted: true,
    });
    const [updatedTarget] = await db
      .select({
        testingModeDisabled: bankUsersTable.testingModeDisabled,
        transferAccessGranted: bankUsersTable.transferAccessGranted,
      })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, targetId));
    assert.equal(updatedTarget.testingModeDisabled, true);
    assert.equal(updatedTarget.transferAccessGranted, true);
    const [accessAudit] = await db
      .select()
      .from(bankAuditLogsTable)
      .where(
        and(
          eq(bankAuditLogsTable.action, "update_customer_access_controls"),
          eq(bankAuditLogsTable.targetUserId, targetId),
        ),
      );
    assert.equal(accessAudit?.actorUserId, adminId);
    assert.equal(accessAudit?.targetUserId, targetId);
    assert.match(
      accessAudit?.reason ?? "",
      /^Automatically generated audit reason for customer access controls update/,
    );
    assert.match(accessAudit?.reason ?? "", /testingModeDisabled=true/);
    assert.match(
      accessAudit?.reason ?? "",
      /transferAccessGranted=true/,
    );

    const revokeControls = await request(
      `/users/${targetId}/access-controls`,
      adminId,
      {
        method: "PATCH",
        body: JSON.stringify({
          testingModeDisabled: false,
          transferAccessGranted: false,
          reason: "Revoke temporary customer overrides.",
          transactionPin: adminPin,
          confirmed: true,
        }),
      },
    );
    assert.equal(revokeControls.status, 200, await revokeControls.clone().text());
    const [revokedTarget] = await db
      .select({
        testingModeDisabled: bankUsersTable.testingModeDisabled,
        transferAccessGranted: bankUsersTable.transferAccessGranted,
      })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, targetId));
    assert.equal(revokedTarget.testingModeDisabled, false);
    assert.equal(revokedTarget.transferAccessGranted, false);
    const controlsAuditRows = await db
      .select({ id: bankAuditLogsTable.id })
      .from(bankAuditLogsTable)
      .where(
        and(
          eq(bankAuditLogsTable.action, "update_customer_access_controls"),
          eq(bankAuditLogsTable.targetUserId, targetId),
        ),
      );
    assert.equal(controlsAuditRows.length, 2);

    const selfGrant = await request(`/users/${adminId}/vault-access/grant`, adminId, {
      method: "POST",
      body: JSON.stringify({
        transactionPin: adminPin,
        confirmed: true,
        duration: "permanent",
      }),
    });
    assert.equal(selfGrant.status, 200, await selfGrant.clone().text());
    const selfGranted = await selfGrant.json() as {
      adminGrantActive: boolean;
      adminGrantExpiresAt: string | null;
      accessActive: boolean;
      accessSource: string;
    };
    assert.equal(selfGranted.adminGrantActive, true);
    assert.equal(selfGranted.accessActive, true);
    assert.equal(selfGranted.accessSource, "admin_grant");
    assert.equal(selfGranted.adminGrantExpiresAt, null);
    assert.equal(await hasActiveVaultAccess({
      id: adminId,
      vaultSubscriptionStatus: "inactive",
      vaultSubscriptionExpiresAt: null,
    }), true);

    const initialSearch = await request(
      `/vault-access?search=${encodeURIComponent(targetEmail)}`,
      adminId,
    );
    assert.equal(initialSearch.status, 200);
    const initialData = await initialSearch.json() as { items: Array<{ userId: string; accessSource: string; adminGrantActive: boolean }> };
    assert.equal(initialData.items[0]?.userId, targetId);
    assert.equal(initialData.items[0]?.accessSource, "none");

    const expiredAt = new Date(Date.now() - 60_000);
    await db.insert(bankVaultAdminEntitlementsTable).values({
      userId: targetId,
      grantedByUserId: adminId,
      reason: "Previous timed grant",
      grantedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      expiresAt: expiredAt,
    });
    const expiredSearch = await request(
      `/vault-access?search=${encodeURIComponent(targetEmail)}`,
      adminId,
    );
    assert.equal(expiredSearch.status, 200);
    const expiredData = await expiredSearch.json() as {
      items: Array<{
        userId: string;
        adminGrantActive: boolean;
        adminGrantAt: string | null;
        adminGrantExpiresAt: string | null;
        accessSource: string;
      }>;
    };
    assert.deepEqual(
      {
        userId: expiredData.items[0]?.userId,
        adminGrantActive: expiredData.items[0]?.adminGrantActive,
        adminGrantAt: expiredData.items[0]?.adminGrantAt !== null,
        adminGrantExpiresAt: expiredData.items[0]?.adminGrantExpiresAt,
        accessSource: expiredData.items[0]?.accessSource,
      },
      {
        userId: targetId,
        adminGrantActive: false,
        adminGrantAt: true,
        adminGrantExpiresAt: expiredAt.toISOString(),
        accessSource: "none",
      },
    );

    const invalidDuration = await request(
      `/users/${expiredGrantUserId}/vault-access/grant`,
      adminId,
      {
        method: "POST",
        body: JSON.stringify({
          transactionPin: adminPin,
          confirmed: true,
          duration: "365d",
        }),
      },
    );
    assert.equal(invalidDuration.status, 400);

    const badPinResponse = await request(`/users/${targetId}/vault-access/grant`, adminId, {
      method: "POST",
      body: JSON.stringify({
        transactionPin: "000000",
        confirmed: true,
        duration: "7d",
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
        transactionPin: adminPin,
        confirmed: true,
        duration: "7d",
      }),
    });
    assert.equal(grantResponse.status, 200);
    const granted = await grantResponse.json() as {
      adminGrantActive: boolean;
      accessActive: boolean;
      accessSource: string;
      subscriptionActive: boolean;
      adminGrantByUserId: string;
      adminGrantExpiresAt: string | null;
    };
    assert.equal(granted.adminGrantActive, true);
    assert.equal(granted.accessActive, true);
    assert.equal(granted.accessSource, "admin_grant");
    assert.equal(granted.subscriptionActive, false);
    assert.equal(granted.adminGrantByUserId, adminId);
    assert.ok(granted.adminGrantExpiresAt);
    assert.ok(
      new Date(granted.adminGrantExpiresAt).getTime() >
        Date.now() + 6 * 24 * 60 * 60 * 1000,
    );
    assert.ok(
      new Date(granted.adminGrantExpiresAt).getTime() <
        Date.now() + 8 * 24 * 60 * 60 * 1000,
    );
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
    assert.match(audit?.reason ?? "", /^Automatically generated audit reason for Private Vault admin grant/);
    assert.match(audit?.reason ?? "", /Grant duration: 7d/);
    assert.ok(audit?.createdAt instanceof Date);

    const selfRevoke = await request(`/users/${adminId}/vault-access/revoke`, adminId, {
      method: "POST",
      body: JSON.stringify({ transactionPin: adminPin, confirmed: true }),
    });
    assert.equal(selfRevoke.status, 403);

    await db.insert(bankVaultSessionsTable).values({
      userId: targetId,
      tokenHash: `revocation-session-${suffix}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const revokeResponse = await request(`/users/${targetId}/vault-access/revoke`, adminId, {
      method: "POST",
      body: JSON.stringify({
        transactionPin: adminPin,
        confirmed: true,
        duration: "30d",
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
        transactionPin: adminPin,
        confirmed: true,
        duration: "30d",
      }),
    });
    assert.equal(paidGrant.status, 200);
    const paidRevoke = await request(`/users/${paidUserId}/vault-access/revoke`, adminId, {
      method: "POST",
      body: JSON.stringify({
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
