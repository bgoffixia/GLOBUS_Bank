import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
import { test } from "node:test";
import { UpdateAdminUserAccessControlsBody } from "@workspace/api-zod";
import {
  buildAdminAccessControlsAuditEntry,
  buildAdminAccessControlsAuditReason,
  normalizeAdminAccessReason,
} from "../src/lib/admin-access-controls";
import { setPasswordResetCache } from "../src/lib/password-reset";
import adminRouter from "../src/routes/bankAdmin";

test("access-control contract requires valid flags, reason, PIN, and confirmation", () => {
  const base = {
    testingModeDisabled: true,
    transferAccessGranted: false,
    transactionPin: "482731",
    confirmed: true,
  };
  assert.equal(
    UpdateAdminUserAccessControlsBody.safeParse({
      ...base,
      reason: "Approved transfer access.",
    }).success,
    true,
  );
  assert.equal(UpdateAdminUserAccessControlsBody.safeParse(base).success, false);
  assert.equal(
    UpdateAdminUserAccessControlsBody.safeParse({
      ...base,
      reason: "Short",
    }).success,
    false,
  );
  assert.equal(
    UpdateAdminUserAccessControlsBody.safeParse({
      ...base,
      reason: "A".repeat(501),
    }).success,
    false,
  );
  assert.equal(
    UpdateAdminUserAccessControlsBody.safeParse({
      ...base,
      reason: "Approved transfer access.",
      transactionPin: "123",
    }).success,
    false,
  );
  assert.equal(
    UpdateAdminUserAccessControlsBody.safeParse({
      ...base,
      reason: "Approved transfer access.",
      confirmed: false,
    }).success,
    false,
  );
});

test("reasons are normalized and audit records retain actor, target, action, and settings", () => {
  assert.equal(normalizeAdminAccessReason(" \t\n "), null);
  assert.equal(normalizeAdminAccessReason(" short "), null);
  assert.equal(
    normalizeAdminAccessReason("  Approved transfer access.  "),
    "Approved transfer access.",
  );
  assert.deepEqual(
    buildAdminAccessControlsAuditEntry({
      actorUserId: "admin-1",
      targetUserId: "member-1",
      reason: "Approved transfer access.",
      testingModeDisabled: true,
      transferAccessGranted: false,
    }),
    {
      actorUserId: "admin-1",
      targetUserId: "member-1",
      action: "update_customer_access_controls",
      reason:
        "Approved transfer access. Testing Mode disabled: true; separate transfer access granted: false. Neither setting grants Private Vault access.",
    },
  );
  const auditReason = buildAdminAccessControlsAuditReason(
    "Approved transfer access.",
    { testingModeDisabled: true, transferAccessGranted: false },
  );
  assert.match(auditReason, /^Approved transfer access\./);
  assert.match(auditReason, /Testing Mode disabled: true/);
  assert.match(auditReason, /separate transfer access granted: false/);
  assert.match(auditReason, /Neither setting grants Private Vault access/);
});

test("production-column migration is additive, idempotent, and limited to bank_users", () => {
  const migration = readFileSync(
    new URL("../../../lib/db/migrations/20261119_admin_user_access_fields.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS profile_setup_completed_at timestamp with time zone/i,
  );
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS testing_mode_disabled boolean NOT NULL DEFAULT false/i,
  );
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS transfer_access_granted boolean NOT NULL DEFAULT false/i,
  );
  assert.match(migration, /COALESCE\(updated_at, created_at, now\(\)\)/i);
  assert.match(migration, /NULLIF\(btrim\(first_name\), ''\) IS NOT NULL/i);
  assert.match(migration, /NULLIF\(btrim\(last_name\), ''\) IS NOT NULL/i);
  assert.match(migration, /profile_setup_completed_at IS NULL/i);
  assert.doesNotMatch(migration, /bank_account_tiers/i);
});

test("Vault grant migration only adds the explicit entitlement table", () => {
  const migration = readFileSync(
    new URL("../../../lib/db/migrations/20261120_private_vault_admin_entitlements.sql", import.meta.url),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE TABLE IF NOT EXISTS public\.bank_vault_admin_entitlements/i,
  );
  assert.match(migration, /FOREIGN KEY \(user_id\) REFERENCES public\.bank_users\(id\)/i);
  assert.match(migration, /FOREIGN KEY \(granted_by_user_id\) REFERENCES public\.bank_users\(id\)/i);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS/i);
  assert.doesNotMatch(migration, /bank_account_tiers|account_tier_id/i);
});

test("access-control route denies anonymous and non-allowlisted users before database writes", async () => {
  const adminId = "unit-allowlisted-admin";
  const ordinaryUserId = "unit-ordinary-user";
  const previousIds = process.env.GLOBUS_ADMIN_CLERK_IDS;
  const previousEmails = process.env.GLOBUS_ADMIN_EMAILS;
  process.env.GLOBUS_ADMIN_CLERK_IDS = adminId;
  process.env.GLOBUS_ADMIN_EMAILS = "";
  setPasswordResetCache(adminId, false);
  setPasswordResetCache(ordinaryUserId, false);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.header("x-test-user-id") || null;
    const authHandler = Object.assign(
      () => ({ userId, tokenType: "session_token", sessionClaims: {} }),
      { [Symbol.for("@clerk/express.auth")]: true },
    );
    (req as unknown as { auth: typeof authHandler }).auth = authHandler;
    next();
  });
  app.use("/api", adminRouter);
  const server = createServer(app);

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const endpoint = `http://127.0.0.1:${address.port}/api/bank/admin/users/member-1/access-controls`;
    const body = {
      testingModeDisabled: true,
      transferAccessGranted: true,
      reason: "Approved transfer access.",
      transactionPin: "482731",
      confirmed: true,
    };
    const send = (userId: string | null, payload: Record<string, unknown>) =>
      fetch(endpoint, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(userId ? { "x-test-user-id": userId } : {}),
        },
        body: JSON.stringify(payload),
      });

    assert.equal((await send(null, body)).status, 401);
    assert.equal((await send(ordinaryUserId, body)).status, 403);
    assert.equal(
      (
        await send(adminId, {
          ...body,
          reason: "        ",
        })
      ).status,
      400,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previousIds === undefined) delete process.env.GLOBUS_ADMIN_CLERK_IDS;
    else process.env.GLOBUS_ADMIN_CLERK_IDS = previousIds;
    if (previousEmails === undefined) delete process.env.GLOBUS_ADMIN_EMAILS;
    else process.env.GLOBUS_ADMIN_EMAILS = previousEmails;
  }
});
