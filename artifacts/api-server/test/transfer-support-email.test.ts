import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("transfer alerts send a private, transfer-scoped Vault support link to the account owner's registered email", () => {
  const source = readFileSync(new URL("../src/lib/transfer-notifications.ts", import.meta.url), "utf8");
  assert.match(source, /email: bankUsersTable\.email/);
  assert.match(source, /new URL\("\/private-vault\/support", origin\)/);
  assert.match(source, /vaultSupportUrl\.searchParams\.set\("transfer", input\.reference\)/);
  assert.match(source, /Open your Private Vault inbox/);
  assert.match(source, /globus-transfer-owner-/);
  assert.match(source, /to: ownerEmail/);
});

test("transfer support is restricted to active Vault access and conversations remain user scoped", () => {
  const routes = readFileSync(new URL("../src/routes/bank.ts", import.meta.url), "utf8");
  assert.match(routes, /if \(category === "transfer" \|\| category === "private_vault"\) \{\s*return activeVaultAccess;/);
  assert.match(routes, /eq\(bankSupportConversationsTable\.userId, user\.id\)/);
  assert.match(routes, /eq\(bankTransactionsTable\.fromUserId, user\.id\)/);
});

test("operations settings expose and validate global support URL and email", () => {
  const routes = readFileSync(new URL("../src/routes/bankAdmin.ts", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../../../lib/db/src/schema/bank.ts", import.meta.url), "utf8");
  assert.match(routes, /defaultSupportUrl: settings\.defaultSupportUrl/);
  assert.match(routes, /supportEmail: settings\.supportEmail/);
  assert.match(routes, /normalizeSupportUrl\(parsed\.data\.defaultSupportUrl\)/);
  assert.match(routes, /parsed\.data\.supportEmail/);
  assert.match(schema, /defaultSupportUrl: text\("default_support_url"\)/);
  assert.match(schema, /supportEmail: text\("support_email"\)/);
});
