import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
import { after, test } from "node:test";
import {
  CreateBankSupportConversationBody,
  SendBankSupportMessageBody,
} from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { setPasswordResetCache } from "../src/lib/password-reset";
import bankRouter from "../src/routes/bank";
import adminRouter from "../src/routes/bankAdmin";

const originalAdminIds = process.env.GLOBUS_ADMIN_CLERK_IDS;
const originalAdminEmails = process.env.GLOBUS_ADMIN_EMAILS;
const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

after(async () => {
  if (originalAdminIds === undefined) delete process.env.GLOBUS_ADMIN_CLERK_IDS;
  else process.env.GLOBUS_ADMIN_CLERK_IDS = originalAdminIds;
  if (originalAdminEmails === undefined) delete process.env.GLOBUS_ADMIN_EMAILS;
  else process.env.GLOBUS_ADMIN_EMAILS = originalAdminEmails;
  await pool.end();
});

function authenticatedApp(router: express.Router, userId: string | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const auth = Object.assign(
      () => ({ userId, tokenType: "session_token", sessionClaims: {} }),
      { [Symbol.for("@clerk/express.auth")]: true },
    );
    (req as unknown as { auth: typeof auth }).auth = auth;
    next();
  });
  app.use("/api", router);
  return app;
}

async function serve(app: express.Express, run: (baseUrl: string) => Promise<void>) {
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await run(`http://127.0.0.1:${address.port}/api`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
}

test("support message contracts trim to bounded non-empty content and expose no sender role input", () => {
  assert.equal(
    CreateBankSupportConversationBody.safeParse({
      subject: "Account question",
      message: "Please help me understand this account record.",
    }).success,
    true,
  );
  assert.equal(
    CreateBankSupportConversationBody.safeParse({
      subject: "Transfer recipient question",
      message: "Please help me with the recipient on this transfer.",
      category: "transfer",
      transferReference: "GLB-TRANSFER-123",
    }).success,
    true,
  );
  assert.equal(
    CreateBankSupportConversationBody.safeParse({
      subject: "Transfer recipient question",
      message: "Please help me with the recipient on this transfer.",
      category: "transfer",
    }).success,
    true,
  );
  assert.equal(
    CreateBankSupportConversationBody.safeParse({ subject: " ", message: "Help" }).success,
    false,
  );
  assert.equal(
    CreateBankSupportConversationBody.safeParse({
      subject: "A".repeat(121),
      message: "Help",
    }).success,
    false,
  );
  assert.equal(SendBankSupportMessageBody.safeParse({ body: "A message" }).success, true);
  assert.equal(SendBankSupportMessageBody.safeParse({ body: " " }).success, false);
  assert.equal(
    SendBankSupportMessageBody.safeParse({ body: "A".repeat(4001) }).success,
    false,
  );
  const withForgedRole = SendBankSupportMessageBody.safeParse({
    body: "Reply",
    senderRole: "admin",
  });
  assert.equal(withForgedRole.success, true);
  assert.equal(
    withForgedRole.success && "senderRole" in withForgedRole.data,
    false,
  );
});

test("support tables and migration preserve ownership, unread state, limits, and durable history", () => {
  const schema = source("../../../lib/db/src/schema/bank.ts");
  const migration = source("../../../lib/db/migrations/20261121_live_support_messaging.sql");
  assert.match(schema, /pgTable\(\s*"bank_support_conversations"/);
  assert.match(schema, /pgTable\(\s*"bank_support_messages"/);
  assert.match(schema, /references\(\(\) => bankUsersTable\.id,\s*\{\s*onDelete:\s*"cascade"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS bank_support_conversations/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS bank_support_messages/i);
  assert.match(migration, /ON DELETE CASCADE/i);
  assert.match(migration, /sender_role IN \('customer', 'admin'\)/i);
  assert.match(migration, /length\(trim\(body\)\) BETWEEN 1 AND 4000/i);
});

test("customer handlers enforce owner scope and message rate limits", () => {
  const routes = source("../src/routes/bank.ts");
  const listStart = routes.indexOf('router.get("/bank/support/conversations"');
  const listEnd = routes.indexOf("\nrouter.", listStart + 1);
  const customerRoutes = routes.slice(listStart, listEnd < 0 ? undefined : listEnd);
  assert.match(routes, /router\.use\("\/bank", requireSignedIn\)/);
  assert.match(routes, /router\.post\(\s*"\/bank\/support\/conversations",\s*supportMessageLimiter/);
  assert.match(routes, /router\.post\(\s*"\/bank\/support\/conversations\/:conversationId\/messages",\s*supportMessageLimiter/);
  assert.match(routes, /eq\(bankSupportConversationsTable\.userId,\s*user\.id\)/);
  assert.match(routes, /router\.post\(\s*"\/bank\/support\/conversations\/:conversationId\/read"/);
  assert.match(customerRoutes, /where\(canAccessRestrictedSupport/);
  assert.match(customerRoutes, /eq\(bankSupportConversationsTable\.userId, user\.id\)/);
});

test("support categories enforce Vault eligibility and transfer ownership", () => {
  const routes = source("../src/routes/bank.ts");
  const adminRoutes = source("../src/routes/bankAdmin.ts");
  const schema = source("../../../lib/db/src/schema/bank.ts");
  const migration = source("../../../lib/db/migrations/20261125_support_conversation_categories.sql");
  assert.match(schema, /category: text\("category"\)\.notNull\(\)\.default\("general"\)/);
  assert.match(schema, /transferReference: text\("transfer_reference"\)/);
  assert.match(migration, /category IN \('general', 'private_vault', 'transfer'\)/);
  assert.match(routes, /await hasActiveVaultAccess\(user\)/);
  assert.match(routes, /user\.supportAccessGranted/);
  assert.match(routes, /canAccessSupportCategory\(user, conversation\.category\)/);
  assert.match(routes, /canAccessSupportCategory\(user, existingConversation\.category\)/);
  assert.match(routes, /canAccessRestrictedSupport/);
  assert.match(routes, /eq\(bankTransactionsTable\.reference, transferReference\)/);
  assert.match(routes, /eq\(bankTransactionsTable\.fromUserId, user\.id\)/);
  assert.match(routes, /conversation\.category !== "general"/);
  assert.match(adminRoutes, /parsed\.data\.category/);
  assert.match(adminRoutes, /supportAccessGranted: parsed\.data\.supportAccessGranted/);
  assert.match(adminRoutes, /bankSupportConversationsTable\.transferReference/);
});

test("admin support handlers require allowlisting and write reply audit records", () => {
  const routes = source("../src/routes/bankAdmin.ts");
  assert.match(routes, /router\.get\(\s*"\/bank\/admin\/support\/conversations",\s*requireAdmin/);
  assert.match(routes, /router\.get\(\s*"\/bank\/admin\/support\/conversations\/:conversationId\/messages",\s*requireAdmin/);
  assert.match(routes, /router\.post\(\s*"\/bank\/admin\/support\/conversations\/:conversationId\/messages",\s*requireAdmin,\s*supportMessageLimiter/);
  assert.match(routes, /router\.post\(\s*"\/bank\/admin\/support\/conversations\/:conversationId\/read",\s*requireAdmin/);
  assert.match(routes, /action:\s*"support_reply"/);
  assert.match(routes, /actorUserId:\s*actor\.id,\s*targetUserId:\s*conversation\.userId/);
});

test("customer erasure is admin-only, explicitly confirmed, and retains required financial history", () => {
  const routes = source("../src/routes/bankAdmin.ts");
  const handler = routes.slice(routes.indexOf('"/bank/admin/users/:userId/delete"'));
  assert.match(handler, /requireAdmin/);
  assert.match(handler, /confirmation !== "DELETE"/);
  assert.match(handler, /reason\.length < 10/);
  assert.match(handler, /authenticatedClerkId === userId/);
  assert.match(handler, /GLOBUS_ADMIN_CLERK_IDS/);
  assert.match(handler, /GLOBUS_ADMIN_EMAILS/);
  assert.match(handler, /bankSupportMessagesTable/);
  assert.match(handler, /bankVaultSessionsTable/);
  assert.match(handler, /bankVaultPasscodeResetTokensTable/);
  assert.match(handler, /bankSavedPaymentMethodsTable/);
  assert.match(handler, /bankPersonalFinanceRecordsTable/);
  assert.match(handler, /bankFinancialAccountsTable/);
  assert.match(handler, /bankFinanceLoanApplicationsTable/);
  assert.match(handler, /bankNotificationsTable/);
  assert.match(handler, /bankPushSubscriptionsTable/);
  assert.match(handler, /bankIdentityDocumentsTable/);
  assert.match(handler, /bankRestrictionsTable/);
  assert.match(handler, /bankWalletsTable/);
  assert.match(handler, /bankSandboxRequestsTable/);
  assert.match(handler, /paymentMethodSummary: null/);
  assert.match(handler, /vaultSubscriptionReviewedByUserId: null/);
  assert.match(handler, /acceptedTermsAt: null/);
  assert.match(routes, /deleteIdentityDocumentObject/);
  assert.match(routes, /deleteVaultSubscriptionProof/);
  assert.match(handler, /deleteCustomerPrivateObjects\(\{/);
  assert.ok(handler.indexOf("deleteCustomerPrivateObjects({") < handler.indexOf("clerkClient.users.deleteUser"));
  assert.match(handler, /storageCleanupRequired: true/);
  assert.match(handler, /clerkClient\.users\.deleteUser/);
  assert.match(handler, /accountStatus: "deletion_pending"/);
  assert.match(handler, /accountStatus: "deleted"/);
  assert.match(handler, /Financial transactions\/ledger entries are intentionally retained/);
});

test("unauthenticated customers and non-allowlisted users are rejected before data access", async () => {
  const memberId = "support-test-non-admin";
  process.env.GLOBUS_ADMIN_CLERK_IDS = "";
  process.env.GLOBUS_ADMIN_EMAILS = "";
  setPasswordResetCache(memberId, false);

  await serve(authenticatedApp(bankRouter, null), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/bank/support/conversations`);
    assert.equal(response.status, 401);
  });

  await serve(authenticatedApp(adminRouter, memberId), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/bank/admin/support/conversations`);
    assert.equal(response.status, 403);
    const access = await fetch(`${baseUrl}/bank/admin/access`);
    assert.equal(access.status, 200);
    assert.match(access.headers.get("cache-control") ?? "", /no-store/i);
    assert.equal((await access.json() as { allowed: boolean }).allowed, false);
  });
});
