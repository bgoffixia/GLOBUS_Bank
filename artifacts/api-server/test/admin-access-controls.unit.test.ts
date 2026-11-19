import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import express from "express";
import { test } from "node:test";
import { UpdateAdminUserAccessControlsBody } from "@workspace/api-zod";
import {
  buildAdminAccessControlsAuditReason,
  normalizeAdminAccessReason,
} from "../src/lib/admin-access-controls";
import { setPasswordResetCache } from "../src/lib/password-reset";
import adminRouter from "../src/routes/bankAdmin";

test("access-control contract requires a valid reason, PIN, flags, and confirmation", () => {
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

test("access-control reason is trimmed, rejects whitespace-only input, and records both settings", () => {
  assert.equal(normalizeAdminAccessReason(" \t\n "), null);
  assert.equal(normalizeAdminAccessReason(" short "), null);
  assert.equal(
    normalizeAdminAccessReason("  Approved transfer access.  "),
    "Approved transfer access.",
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
    new URL("../../../lib/db/migrations/0004_aberrant_shaman.sql", import.meta.url),
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

test("access-control endpoint denies anonymous and non-allowlisted callers before database writes", async () => {
  const adminId = "unit-allowlisted-admin";
  const ordinaryUserId = "unit-ordinary-user";
  const priorAdminIds = process.env.GLOBUS_ADMIN_CLERK_IDS;
  const priorAdminEmails = process.env.GLOBUS_ADMIN_EMAILS;
  process.env.GLOBUS_ADMIN_CLERK_IDS = adminId;
  process.env.GLOBUS_ADMIN_EMAILS = "";
  setPasswordResetCache(adminId, false);
  setPasswordResetCache(ordinaryUserId, false);

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

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const endpoint = `http://127.0.0.1:${address.port}/api/bank/admin/users/target/access-controls`;
    const request = (actorId: string | null, body: Record<string, unknown>) =>
      fetch(endpoint, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(actorId ? { "x-test-user-id": actorId } : {}),
        },
        body: JSON.stringify(body),
      });
    const validBody = {
      testingModeDisabled: true,
      transferAccessGranted: true,
      reason: "Approved transfer access.",
      transactionPin: "482731",
      confirmed: true,
    };

    const anonymous = await request(null, validBody);
    assert.equal(anonymous.status, 401);
    const ordinary = await request(ordinaryUserId, validBody);
    assert.equal(ordinary.status, 403);

    const invalidReason = await request(adminId, {
      ...validBody,
      reason: "        ",
    });
    assert.equal(invalidReason.status, 400);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (priorAdminIds === undefined) delete process.env.GLOBUS_ADMIN_CLERK_IDS;
    else process.env.GLOBUS_ADMIN_CLERK_IDS = priorAdminIds;
    if (priorAdminEmails === undefined) delete process.env.GLOBUS_ADMIN_EMAILS;
    else process.env.GLOBUS_ADMIN_EMAILS = priorAdminEmails;
  }
});
