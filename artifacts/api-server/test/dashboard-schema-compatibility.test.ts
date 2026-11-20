import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getTableColumns } from "drizzle-orm";
import { bankTransactionsTable } from "@workspace/db";

const transactionSchema = readFileSync(
  new URL("../../../lib/db/src/schema/bank.ts", import.meta.url),
  "utf8",
);
const bankLibrary = readFileSync(
  new URL("../src/lib/bank.ts", import.meta.url),
  "utf8",
);
const bankRoutes = readFileSync(
  new URL("../src/routes/bank.ts", import.meta.url),
  "utf8",
);
const receiptTemplateMigration = readFileSync(
  new URL(
    "../../../lib/db/migrations/20261120_bank_transaction_receipt_template.sql",
    import.meta.url,
  ),
  "utf8",
);

function routeSource(routePath: string): string {
  const start = bankRoutes.indexOf(`router.get("${routePath}"`);
  assert.notEqual(start, -1, `Expected route ${routePath} to exist`);
  const nextRoute = bankRoutes.indexOf("\nrouter.", start + 1);
  return bankRoutes.slice(start, nextRoute === -1 ? undefined : nextRoute);
}

test("dashboard transaction reads and Drizzle schema agree on receipt_template", () => {
  const columns = getTableColumns(bankTransactionsTable);
  assert.equal(columns.receiptTemplate.name, "receipt_template");
  assert.equal(columns.receiptTemplate.notNull, true);
  assert.equal(columns.receiptTemplate.hasDefault, true);
  assert.match(
    bankLibrary,
    /export async function getRecentTransactions[\s\S]*?\.select\(\)[\s\S]*?\.from\(bankTransactionsTable\)/,
  );
  assert.match(
    routeSource("/bank/dashboard"),
    /getRecentTransactions\(profile\.id\)/,
  );
  assert.match(transactionSchema, /receiptTemplate:\s*text\("receipt_template"\)/);
});

test("receipt-template migration adds only the confirmed missing column safely", () => {
  assert.match(
    receiptTemplateMigration,
    /ALTER TABLE public\.bank_transactions\s+ADD COLUMN IF NOT EXISTS receipt_template text NOT NULL DEFAULT 'standard';/i,
  );
  assert.doesNotMatch(
    receiptTemplateMigration,
    /\b(DROP|DELETE|TRUNCATE|bank_account_tiers|account_tier_id)\b/i,
  );
});

test("profile and notification routes remain independent of transaction rows", () => {
  const profileRoute = routeSource("/bank/me");
  const notificationsRoute = routeSource("/bank/notifications");

  assert.match(profileRoute, /getOrCreateBankUser\(userId\)/);
  assert.match(notificationsRoute, /getOrCreateBankUser\(authUserId\)/);
  assert.match(notificationsRoute, /\.from\(bankNotificationsTable\)/);
  assert.doesNotMatch(profileRoute, /bankTransactionsTable|getRecentTransactions/);
  assert.doesNotMatch(
    notificationsRoute,
    /bankTransactionsTable|getRecentTransactions/,
  );
});
