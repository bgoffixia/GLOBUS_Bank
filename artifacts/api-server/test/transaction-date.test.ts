import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { bankTransactionsTable } from "@workspace/db";
import { toBankTransaction } from "../src/lib/bank";
import { isIsoCalendarDate } from "../src/lib/transaction-date";

const bankAdminRoutes = readFileSync(
  new URL("../src/routes/bankAdmin.ts", import.meta.url),
  "utf8",
);
const transactionSchema = readFileSync(
  new URL("../../../lib/db/src/schema/bank.ts", import.meta.url),
  "utf8",
);
const transactionMigration = readFileSync(
  new URL(
    "../../../lib/db/migrations/20261120_bank_transaction_effective_date.sql",
    import.meta.url,
  ),
  "utf8",
);
const migrationJournal = readFileSync(
  new URL("../../../lib/db/migrations/meta/_journal.json", import.meta.url),
  "utf8",
);

test("transaction date validation rejects impossible calendar days", () => {
  assert.equal(isIsoCalendarDate("2024-02-29"), true);
  assert.equal(isIsoCalendarDate("2026-11-20"), true);
  assert.equal(isIsoCalendarDate("2026-02-29"), false);
  assert.equal(isIsoCalendarDate("2026-13-01"), false);
  assert.equal(isIsoCalendarDate("20-11-2026"), false);
});

test("admin date editing remains allowlisted, PIN-protected, and audited", () => {
  const start = bankAdminRoutes.indexOf('"/bank/admin/transactions/:transactionId/date"');
  assert.notEqual(start, -1);
  const end = bankAdminRoutes.indexOf("\nrouter.", start + 1);
  const route = bankAdminRoutes.slice(start, end < 0 ? undefined : end);
  assert.match(route, /requireAdmin/);
  assert.match(route, /verifyTransactionPin/);
  assert.match(route, /transactionDate:\s*parsed\.data\.transactionDate/);
  assert.match(route, /bankAuditLogsTable/);
  assert.match(route, /update_transaction_date/);
});

test("the date column migration is additive and leaves recorded timestamps intact", () => {
  assert.match(transactionSchema, /transactionDate:\s*date\("transaction_date",\s*\{\s*mode:\s*"string"\s*\}\)/);
  assert.match(
    transactionMigration,
    /ALTER TABLE public\.bank_transactions\s+ADD COLUMN IF NOT EXISTS transaction_date date;/i,
  );
  assert.doesNotMatch(transactionMigration, /\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i);
  assert.match(migrationJournal, /20261120_bank_transaction_effective_date/);
});

test("API transaction serialization includes the customer-facing date separately", () => {
  const row = {
    id: "tx-date-serialization",
    reference: "GBX-DATE-TEST",
    idempotencyKey: "idempotency-key-for-date-test",
    initiatedByUserId: "admin-test",
    fromUserId: null,
    toUserId: "customer-test",
    type: "admin_funding",
    status: "completed",
    currency: "NGN",
    amountMinor: 18450000n,
    feeMinor: 0n,
    counterparty: "Globus operations",
    description: "Test credit",
    adminReference: null,
    adminNotes: null,
    correctionOfTransactionId: null,
    reversalOfTransactionId: null,
    correctionReason: null,
    mode: "internal_ledger",
    receiptTemplate: "standard",
    transactionDate: "2026-11-20",
    createdAt: new Date("2026-11-20T10:42:00.000Z"),
  } as typeof bankTransactionsTable.$inferSelect;
  const mapped = toBankTransaction(row, "customer-test");
  assert.equal(mapped.transactionDate, "2026-11-20");
  assert.equal(mapped.createdAt, "2026-11-20T10:42:00.000Z");
});
