import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
import { test } from "node:test";
import {
  AssignAdminUserAccountTierBody,
  UpdateAdminSettingsBody,
  UpdateAdminUserAccessControlsBody,
} from "@workspace/api-zod";
import { setPasswordResetCache } from "../src/lib/password-reset";
import adminRouter from "../src/routes/bankAdmin";

test("access-control contract requires valid flags, PIN, and confirmation without manual reason text", () => {
  const base = {
    testingModeDisabled: true,
    transferAccessGranted: false,
    transactionPin: "482731",
    confirmed: true,
  };
  assert.equal(UpdateAdminUserAccessControlsBody.safeParse(base).success, true);
  assert.equal(
    UpdateAdminUserAccessControlsBody.safeParse({
      ...base,
      transactionPin: "123",
    }).success,
    false,
  );
  assert.equal(
    UpdateAdminUserAccessControlsBody.safeParse({
      ...base,
      confirmed: false,
    }).success,
    false,
  );
});

test("account-tier contract accepts only supported tiers and a confirmed six-digit PIN", () => {
  const valid = {
    adminAccountTier: "silver",
    transactionPin: "482731",
    confirmed: true,
  };
  assert.equal(AssignAdminUserAccountTierBody.safeParse(valid).success, true);
  assert.equal(
    AssignAdminUserAccountTierBody.safeParse({
      ...valid,
      adminAccountTier: "diamond",
    }).success,
    false,
  );
  assert.equal(
    AssignAdminUserAccountTierBody.safeParse({
      ...valid,
      transactionPin: "123",
    }).success,
    false,
  );
  assert.equal(
    AssignAdminUserAccountTierBody.safeParse({
      ...valid,
      confirmed: false,
    }).success,
    false,
  );
});

test("administrator tier migration only adds the constrained base-tier field", () => {
  const migration = readFileSync(
    new URL("../../../lib/db/migrations/20261120_admin_account_tier_override.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /ADD COLUMN IF NOT EXISTS admin_account_tier text/i);
  assert.match(migration, /IF NOT EXISTS[\s\S]*?bank_users_admin_account_tier_check/i);
  assert.match(migration, /standard.*silver.*gold.*bronze/is);
  assert.doesNotMatch(migration, /bank_account_tiers|account_tier_id/i);
});

test("access-control audit reason is generated and captures actor, target, and both settings", () => {
  const source = readFileSync(
    new URL("../src/routes/bankAdmin.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /"testingModeDisabled",\s*"transferAccessGranted"/);
  assert.match(
    source,
    /action:\s*"update_customer_access_controls",\s*reason:\s*`\$\{generatedAdminAuditReason\(req\)\}/,
  );
  assert.match(source, /actorUserId,\s*targetUserId:\s*updated\.id/);
  assert.doesNotMatch(source, /parsed\.data\.reason/);
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
    const tierEndpoint = `http://127.0.0.1:${address.port}/api/bank/admin/users/member-1/account-tier`;
    const settingsEndpoint = `http://127.0.0.1:${address.port}/api/bank/admin/settings`;
    const body = {
      testingModeDisabled: true,
      transferAccessGranted: true,
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
          transactionPin: "123",
        })
      ).status,
      400,
    );
    const sendTier = (userId: string | null, payload: Record<string, unknown>) =>
      fetch(tierEndpoint, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(userId ? { "x-test-user-id": userId } : {}),
        },
        body: JSON.stringify(payload),
      });
    const validTierBody = {
      adminAccountTier: "gold",
      transactionPin: "482731",
      confirmed: true,
    };
    assert.equal((await sendTier(null, validTierBody)).status, 401);
    assert.equal((await sendTier(ordinaryUserId, validTierBody)).status, 403);
    assert.equal(
      (
        await sendTier(adminId, {
          ...validTierBody,
          adminAccountTier: "unsupported",
        })
      ).status,
      400,
    );
    const sendSettings = (userId: string | null, payload: Record<string, unknown>) =>
      fetch(settingsEndpoint, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          ...(userId ? { "x-test-user-id": userId } : {}),
        },
        body: JSON.stringify(payload),
      });
    const settingsBody = {
      customerEmailSenderDisplayName: "Globus Client Alerts",
      fundingLimit: "100000.00",
      secondApprovalThreshold: "50000.00",
      vaultPlan1mPrice: "12000.00",
      vaultPlan3mPrice: "22000.00",
      vaultPlan1yPrice: "79000.00",
      transactionPin: "482731",
    };
    assert.equal(UpdateAdminSettingsBody.safeParse(settingsBody).success, true);
    assert.equal((await sendSettings(null, settingsBody)).status, 401);
    assert.equal((await sendSettings(ordinaryUserId, settingsBody)).status, 403);
    assert.equal(
      (
        await sendSettings(adminId, {
          ...settingsBody,
          customerEmailSenderDisplayName: "Alerts\r\nBcc: outsider@example.test",
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
