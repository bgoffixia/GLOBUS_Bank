import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import express from "express";
import { test } from "node:test";
import type {
  BankPersonalFinanceRecord,
} from "@workspace/db";
import type { PersonalFinanceRecordInput } from "@workspace/api-zod";
import {
  createBankPersonalFinanceRouter,
} from "../src/routes/bankPersonalFinance";
import {
  normalizePersonalFinanceRecord,
  PersonalFinanceValidationError,
} from "../src/lib/personal-finance";
import type {
  PersonalFinancePeriod,
  PersonalFinanceRecordPageOptions,
  PersonalFinanceStore,
} from "../src/lib/personal-finance-store";

const testSchema = readFileSync(
  new URL("../../../lib/db/src/schema/personal-finance.ts", import.meta.url),
  "utf8",
);
const testMigration = readFileSync(
  new URL("../../../lib/db/migrations/20261121_personal_finance_records.sql", import.meta.url),
  "utf8",
);
const testRoute = readFileSync(
  new URL("../src/routes/bankPersonalFinance.ts", import.meta.url),
  "utf8",
);

class MemoryFinanceStore implements PersonalFinanceStore {
  readonly records: BankPersonalFinanceRecord[] = [];
  readonly observedOwners: string[] = [];

  async list(userId: string, options: PersonalFinanceRecordPageOptions) {
    this.observedOwners.push(userId);
    const matching = this.records.filter(
      (record) =>
        record.userId === userId &&
        (!options.kind || record.kind === options.kind) &&
        (!options.currency || record.currency === options.currency),
    );
    const start = (options.page - 1) * options.pageSize;
    return {
      records: matching.slice(start, start + options.pageSize),
      total: matching.length,
    };
  }

  async create(userId: string, input: Parameters<PersonalFinanceStore["create"]>[1]) {
    this.observedOwners.push(userId);
    const now = new Date("2026-11-21T10:00:00.000Z");
    const record: BankPersonalFinanceRecord = {
      id: randomUUID(),
      userId,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this.records.push(record);
    return record;
  }

  async find(userId: string, recordId: string) {
    this.observedOwners.push(userId);
    return this.records.find(
      (record) => record.id === recordId && record.userId === userId,
    ) ?? null;
  }

  async update(
    userId: string,
    recordId: string,
    input: Parameters<PersonalFinanceStore["update"]>[2],
  ) {
    this.observedOwners.push(userId);
    const index = this.records.findIndex(
      (record) => record.id === recordId && record.userId === userId,
    );
    if (index < 0) return null;
    const record = {
      ...this.records[index],
      ...input,
      updatedAt: new Date("2026-11-21T11:00:00.000Z"),
    };
    this.records[index] = record;
    return record;
  }

  async delete(userId: string, recordId: string) {
    this.observedOwners.push(userId);
    const index = this.records.findIndex(
      (record) => record.id === recordId && record.userId === userId,
    );
    if (index < 0) return false;
    this.records.splice(index, 1);
    return true;
  }

  async overview(userId: string, period: PersonalFinancePeriod) {
    this.observedOwners.push(userId);
    return {
      period,
      currencySummaries: [
        {
          currency: "USD" as const,
          expensesMinor: "12300",
          savingsBalanceMinor: "45000",
          savingsTargetMinor: "100000",
          investmentValueMinor: "78000",
          loanBalanceMinor: "0",
          unpaidBillsMinor: "2500",
        },
        {
          currency: "NGN" as const,
          expensesMinor: "30000",
          savingsBalanceMinor: "0",
          savingsTargetMinor: "0",
          investmentValueMinor: "0",
          loanBalanceMinor: "90000",
          unpaidBillsMinor: "0",
        },
      ],
      expenseTrend: [],
      expenseCategories: [],
      recentExpenses: [],
    };
  }
}

async function withFinanceApi(
  run: (baseUrl: string, store: MemoryFinanceStore) => Promise<void>,
) {
  const store = new MemoryFinanceStore();
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
  app.use(createBankPersonalFinanceRouter({
    store,
    resolveOwner: async (clerkUserId) => ({ id: `bank-${clerkUserId}` }),
  }));
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await run(`http://127.0.0.1:${address.port}`, store);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function request(
  baseUrl: string,
  path: string,
  userId: string | null,
  method = "GET",
  body?: unknown,
) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(userId ? { "x-test-user-id": userId } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const validExpense: PersonalFinanceRecordInput = {
  kind: "expense",
  title: "Groceries",
  category: "Food",
  currency: "USD",
  amountMinor: "12300",
  recordDate: "2026-11-20",
};

test("manual finance validation accepts clean amounts and rejects invalid dates, zero expenses, and malformed goals", () => {
  const normalized = normalizePersonalFinanceRecord(validExpense);
  assert.equal(normalized.amountMinor, 12300n);
  assert.equal(normalized.status, "paid");
  const emptySavingsGoal = normalizePersonalFinanceRecord({
    ...validExpense,
    kind: "savings",
    amountMinor: "0",
    targetAmountMinor: "100000",
  });
  assert.equal(emptySavingsGoal.amountMinor, 0n);
  assert.equal(emptySavingsGoal.targetAmountMinor, 100000n);
  assert.throws(
    () => normalizePersonalFinanceRecord({ ...validExpense, amountMinor: "0" }),
    PersonalFinanceValidationError,
  );
  assert.throws(
    () => normalizePersonalFinanceRecord({ ...validExpense, recordDate: "2026-02-30" }),
    /valid calendar date/i,
  );
  assert.throws(
    () => normalizePersonalFinanceRecord({
      ...validExpense,
      kind: "savings",
      targetAmountMinor: null,
    }),
    /target amount/i,
  );
  assert.throws(
    () => normalizePersonalFinanceRecord({
      ...validExpense,
      kind: "bill",
      dueDate: null,
    }),
    /due date/i,
  );
});

test("finance API derives ownership from the signed-in session and isolates CRUD", async () => {
  await withFinanceApi(async (baseUrl, store) => {
    const anonymous = await request(baseUrl, "/bank/personal-finance/records", null);
    assert.equal(anonymous.status, 401);

    const created = await request(
      baseUrl,
      "/bank/personal-finance/records",
      "clerk-a",
      "POST",
      { ...validExpense, userId: "attacker-selected-owner" },
    );
    assert.equal(created.status, 201);
    const createdRecord = await created.json() as { id: string; title: string };
    assert.equal(createdRecord.title, "Groceries");
    assert.equal(store.records[0]?.userId, "bank-clerk-a");
    assert.ok(!("userId" in createdRecord));
    const ownListResponse = await request(
      baseUrl,
      "/bank/personal-finance/records?page=1&pageSize=8",
      "clerk-a",
    );
    const ownList = await ownListResponse.json() as {
      records: Array<{ title: string; amountMinor: string }>;
      total: number;
    };
    assert.equal(ownList.total, 1);
    assert.equal(ownList.records[0]?.title, "Groceries");
    assert.equal(ownList.records[0]?.amountMinor, "12300");
    assert.equal(
      (await request(
        baseUrl,
        `/bank/personal-finance/records/${createdRecord.id}`,
        "clerk-a",
        "PATCH",
        {},
      )).status,
      400,
    );

    const otherUsersList = await request(
      baseUrl,
      "/bank/personal-finance/records",
      "clerk-b",
    );
    const otherList = await otherUsersList.json() as { records: unknown[]; total: number };
    assert.equal(otherList.total, 0);
    assert.deepEqual(otherList.records, []);
    assert.equal(
      (await request(
        baseUrl,
        `/bank/personal-finance/records/${createdRecord.id}`,
        "clerk-b",
        "PATCH",
        { title: "Changed by another user" },
      )).status,
      404,
    );
    assert.equal(
      (await request(
        baseUrl,
        `/bank/personal-finance/records/${createdRecord.id}`,
        "clerk-b",
        "DELETE",
      )).status,
      404,
    );
    assert.ok(store.observedOwners.includes("bank-clerk-a"));
    assert.ok(store.observedOwners.includes("bank-clerk-b"));

    const updated = await request(
      baseUrl,
      `/bank/personal-finance/records/${createdRecord.id}`,
      "clerk-a",
      "PATCH",
      { title: "Weekly groceries" },
    );
    assert.equal(updated.status, 200);
    assert.equal((await updated.json() as { title: string }).title, "Weekly groceries");
    assert.equal(
      (await request(
        baseUrl,
        `/bank/personal-finance/records/${createdRecord.id}`,
        "clerk-a",
        "DELETE",
      )).status,
      200,
    );
  });
});

test("finance API validates record semantics and keeps summary currencies separate", async () => {
  await withFinanceApi(async (baseUrl) => {
    const invalid = await request(
      baseUrl,
      "/bank/personal-finance/records",
      "clerk-a",
      "POST",
      { ...validExpense, amountMinor: "0" },
    );
    assert.equal(invalid.status, 400);

    const overviewResponse = await request(
      baseUrl,
      "/bank/personal-finance/overview?period=quarter",
      "clerk-a",
    );
    assert.equal(overviewResponse.status, 200);
    const overview = await overviewResponse.json() as {
      period: string;
      currencySummaries: Array<{ currency: string; expensesMinor: string }>;
    };
    assert.equal(overview.period, "quarter");
    assert.deepEqual(
      overview.currencySummaries.map(({ currency }) => currency),
      ["USD", "NGN"],
    );
    assert.deepEqual(
      overview.currencySummaries.map(({ expensesMinor }) => expensesMinor),
      ["12300", "30000"],
    );
  });
});

test("finance table and migration are customer-owned and separate from the wallet ledger", () => {
  assert.match(testSchema, /bank_personal_finance_records/);
  assert.match(testSchema, /references\(\(\) => bankUsersTable\.id, \{ onDelete: "cascade" \}\)/);
  assert.match(testMigration, /CREATE TABLE IF NOT EXISTS public\.bank_personal_finance_records/i);
  assert.match(testMigration, /REFERENCES public\.bank_users\(id\) ON DELETE CASCADE/i);
  assert.match(testMigration, /CREATE INDEX IF NOT EXISTS/i);
  assert.match(testSchema, /targetAmountMinor} IS NOT NULL/);
  assert.match(testMigration, /target_amount_minor IS NOT NULL/i);
  assert.doesNotMatch(testMigration, /DROP TABLE|DELETE FROM|UPDATE public\.bank_users/i);
  assert.doesNotMatch(
    `${testSchema}\n${testMigration}\n${testRoute}`,
    /bank_transactions|bank_wallets|bank_ledger_entries|ledgerEntriesTable/i,
  );
});

test("finance API route uses only the resolved owner and excludes caller-supplied ownership", () => {
  assert.match(testRoute, /resolver\(clerkUserId\)/);
  assert.match(testRoute, /store\.list\(owner\.id/);
  assert.match(testRoute, /store\.create\(owner\.id/);
  assert.match(testRoute, /store\.update\(\s*owner\.id/);
  assert.match(testRoute, /store\.delete\(owner\.id/);
  assert.doesNotMatch(testRoute, /req\.body\.userId|parsed\.data\.userId/);
});
