import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import express from "express";
import { test } from "node:test";
import type {
  BankFinanceLoanApplication as DbLoanApplication,
  BankFinancialAccount as DbFinancialAccount,
} from "@workspace/db";
import type {
  BankFinanceReport,
  BankFinanceReportPeriod,
  FinancialAccountInput,
} from "@workspace/api-zod";
import {
  financePeriodStart,
  getLedgerDirection,
  mergeFinancialAccountUpdate,
  normalizeFinanceLoanApplication,
  normalizeFinancialAccount,
  FinanceWorkspaceValidationError,
} from "../src/lib/finance-workspace";
import {
  createBankFinanceWorkspaceRouter,
} from "../src/routes/bankFinanceWorkspace";
import type {
  FinanceWorkspaceReport,
  FinanceWorkspaceStore,
} from "../src/lib/finance-workspace-store";

const migration = readFileSync(
  new URL("../../../lib/db/migrations/20261121_finance_workspace_accounts.sql", import.meta.url),
  "utf8",
);
const schema = readFileSync(
  new URL("../../../lib/db/src/schema/finance-workspace.ts", import.meta.url),
  "utf8",
);
const storeSource = readFileSync(
  new URL("../src/lib/finance-workspace-store.ts", import.meta.url),
  "utf8",
);
const migrationJournal = readFileSync(
  new URL("../../../lib/db/migrations/meta/_journal.json", import.meta.url),
  "utf8",
);

class MemoryFinanceWorkspaceStore implements FinanceWorkspaceStore {
  readonly accounts: DbFinancialAccount[] = [];
  readonly applications: DbLoanApplication[] = [];
  readonly observedOwners: string[] = [];

  async report(
    userId: string,
    period: BankFinanceReportPeriod,
  ): Promise<FinanceWorkspaceReport> {
    this.observedOwners.push(userId);
    const report: BankFinanceReport = {
      period,
      ledgerSummaries: [
        {
          walletId: "9b51bdb0-80a9-44eb-a2d9-73d923968413",
          currency: "USD",
          inflowMinor: "12000",
          outflowMinor: "2500",
          netMinor: "9500",
        },
        {
          walletId: "f389291f-292c-4e12-9d82-7892ba079ae2",
          currency: "NGN",
          inflowMinor: "750000",
          outflowMinor: "125000",
          netMinor: "625000",
        },
      ],
      ledgerTrend: [],
      recentActivity: [],
      accountSummaries: [],
      billSummaries: [],
      loanSummaries: [],
    };
    return report;
  }

  async listAccounts(userId: string) {
    this.observedOwners.push(userId);
    return this.accounts.filter((account) => account.userId === userId);
  }

  async createAccount(userId: string, input: Parameters<FinanceWorkspaceStore["createAccount"]>[1]) {
    this.observedOwners.push(userId);
    const now = new Date("2026-11-21T10:00:00.000Z");
    const account: DbFinancialAccount = {
      id: randomUUID(),
      userId,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.push(account);
    return account;
  }

  async findAccount(userId: string, accountId: string) {
    this.observedOwners.push(userId);
    return this.accounts.find(
      (account) => account.id === accountId && account.userId === userId,
    ) ?? null;
  }

  async updateAccount(
    userId: string,
    accountId: string,
    input: Parameters<FinanceWorkspaceStore["updateAccount"]>[2],
  ) {
    this.observedOwners.push(userId);
    const index = this.accounts.findIndex(
      (account) => account.id === accountId && account.userId === userId,
    );
    if (index < 0) return null;
    const account: DbFinancialAccount = {
      ...this.accounts[index]!,
      ...input,
      updatedAt: new Date("2026-11-21T11:00:00.000Z"),
    };
    this.accounts[index] = account;
    return account;
  }

  async listLoanApplications(userId: string) {
    this.observedOwners.push(userId);
    return this.applications.filter((application) => application.userId === userId);
  }

  async findLoanApplication(userId: string, applicationId: string) {
    this.observedOwners.push(userId);
    return this.applications.find(
      (application) =>
        application.id === applicationId && application.userId === userId,
    ) ?? null;
  }

  async createLoanApplication(
    userId: string,
    input: Parameters<FinanceWorkspaceStore["createLoanApplication"]>[1],
  ) {
    this.observedOwners.push(userId);
    const now = new Date("2026-11-21T10:00:00.000Z");
    const application: DbLoanApplication = {
      id: randomUUID(),
      userId,
      ...input,
      status: "submitted",
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.applications.push(application);
    return application;
  }

  async withdrawLoanApplication(userId: string, applicationId: string) {
    this.observedOwners.push(userId);
    const application = this.applications.find(
      (item) =>
        item.id === applicationId &&
        item.userId === userId &&
        item.status === "submitted",
    );
    if (!application) return null;
    application.status = "withdrawn";
    application.updatedAt = new Date("2026-11-21T11:00:00.000Z");
    return application;
  }
}

async function withApi(
  run: (baseUrl: string, store: MemoryFinanceWorkspaceStore) => Promise<void>,
) {
  const store = new MemoryFinanceWorkspaceStore();
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
  app.use(createBankFinanceWorkspaceRouter({
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
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const accountInput: FinancialAccountInput = {
  type: "savings",
  name: "Emergency fund",
  currency: "USD",
  currentValueMinor: "125000",
  targetAmountMinor: "500000",
  openedOn: "2026-01-15",
  notes: "Personal tracker",
};

test("finance workspace validates bounded values and calendar dates", () => {
  const account = normalizeFinancialAccount(accountInput);
  assert.equal(account.currentValueMinor, 125000n);
  assert.equal(account.targetAmountMinor, 500000n);
  assert.equal(account.status, "active");
  assert.throws(
    () => normalizeFinancialAccount({ ...accountInput, openedOn: "2026-02-30" }),
    FinanceWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeFinancialAccount({
        ...accountInput,
        type: "investment",
        targetAmountMinor: "1000",
      }),
    /only available for savings/i,
  );
  assert.throws(
    () => normalizeFinanceLoanApplication({
      requestedAmountMinor: "0",
      currency: "USD",
      purpose: "Education",
      termMonths: 12,
    }),
    /supported amount range/i,
  );
  assert.throws(
    () => normalizeFinanceLoanApplication({
      requestedAmountMinor: "10000",
      currency: "USD",
      purpose: "  ",
      termMonths: 12,
    }),
    /purpose/i,
  );
  assert.throws(
    () => normalizeFinanceLoanApplication({
      requestedAmountMinor: "10000",
      currency: "USD",
      purpose: "Education",
      termMonths: 601,
    }),
    /between 1 and 600/i,
  );
});

test("ledger classification includes only posted rows and keeps same-user transfers separate", () => {
  assert.equal(
    getLedgerDirection({
      status: "completed",
      side: "credit",
      fromUserId: null,
      toUserId: "customer-a",
    }),
    "inflow",
  );
  assert.equal(
    getLedgerDirection({
      status: "reversed",
      side: "debit",
      fromUserId: "customer-a",
      toUserId: null,
    }),
    "outflow",
  );
  const originalDirection = getLedgerDirection({
    status: "reversed",
    side: "debit",
    fromUserId: "customer-a",
    toUserId: null,
  });
  const reversalDirection = getLedgerDirection({
    status: "completed",
    side: "credit",
    fromUserId: null,
    toUserId: "customer-a",
  });
  const originalImpact =
    originalDirection === "inflow" ? 250 : originalDirection === "outflow" ? -250 : 0;
  const reversalImpact =
    reversalDirection === "inflow" ? 250 : reversalDirection === "outflow" ? -250 : 0;
  assert.equal(originalImpact + reversalImpact, 0);
  assert.equal(
    getLedgerDirection({
      status: "completed",
      side: "debit",
      fromUserId: "customer-a",
      toUserId: "customer-a",
    }),
    "transfer",
  );
  for (const status of ["pending", "failed", "rejected"]) {
    assert.equal(
      getLedgerDirection({
        status,
        side: "credit",
        fromUserId: null,
        toUserId: "customer-a",
      }),
      null,
    );
  }
  assert.equal(
    getLedgerDirection({
      status: "completed",
      side: "fee",
      fromUserId: null,
      toUserId: "customer-a",
    }),
    null,
  );
  assert.equal(
    financePeriodStart("month", new Date("2026-11-21T12:00:00.000Z")),
    "2026-11-01",
  );
  assert.equal(
    financePeriodStart("quarter", new Date("2026-11-21T12:00:00.000Z")),
    "2026-10-01",
  );
  assert.equal(
    financePeriodStart("year", new Date("2026-11-21T12:00:00.000Z")),
    "2026-01-01",
  );
});

test("finance workspace API scopes reports and trackers to the signed-in customer", async () => {
  await withApi(async (baseUrl, store) => {
    assert.equal(
      (await request(baseUrl, "/bank/personal-finance/report", null)).status,
      401,
    );
    const reportResponse = await request(
      baseUrl,
      "/bank/personal-finance/report?period=quarter",
      "clerk-a",
    );
    assert.equal(reportResponse.status, 200);
    const report = await reportResponse.json() as BankFinanceReport;
    assert.equal(report.period, "quarter");
    assert.deepEqual(
      report.ledgerSummaries.map(({ walletId, currency, netMinor }) => [
        walletId,
        currency,
        netMinor,
      ]),
      [
        ["9b51bdb0-80a9-44eb-a2d9-73d923968413", "USD", "9500"],
        ["f389291f-292c-4e12-9d82-7892ba079ae2", "NGN", "625000"],
      ],
    );

    const createdResponse = await request(
      baseUrl,
      "/bank/personal-finance/accounts",
      "clerk-a",
      "POST",
      { ...accountInput, userId: "attacker-chosen-user" },
    );
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json() as { id: string; name: string };
    assert.equal(created.name, "Emergency fund");
    assert.equal(store.accounts[0]?.userId, "bank-clerk-a");

    const otherListResponse = await request(
      baseUrl,
      "/bank/personal-finance/accounts",
      "clerk-b",
    );
    assert.deepEqual(await otherListResponse.json(), []);
    assert.equal(
      (
        await request(
          baseUrl,
          `/bank/personal-finance/accounts/${created.id}`,
          "clerk-b",
          "PATCH",
          { name: "Unauthorized edit" },
        )
      ).status,
      404,
    );

    const updateResponse = await request(
      baseUrl,
      `/bank/personal-finance/accounts/${created.id}`,
      "clerk-a",
      "PATCH",
      { name: "Reserve", currentValueMinor: "150000" },
    );
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json() as { name: string }).name, "Reserve");
    assert.ok(store.observedOwners.includes("bank-clerk-a"));
    assert.ok(store.observedOwners.includes("bank-clerk-b"));
  });
});

test("loan requests are in-app records and withdrawal is owner-scoped and idempotent", async () => {
  await withApi(async (baseUrl) => {
    const submitted = await request(
      baseUrl,
      "/bank/personal-finance/loan-applications",
      "clerk-a",
      "POST",
      {
        requestedAmountMinor: "250000",
        currency: "USD",
        purpose: "Education",
        termMonths: 24,
      },
    );
    assert.equal(submitted.status, 201);
    const application = await submitted.json() as {
      id: string;
      status: string;
      requestedAmountMinor: string;
    };
    assert.equal(application.status, "submitted");
    assert.equal(application.requestedAmountMinor, "250000");
    assert.ok(!("approvedAt" in application));
    assert.ok(!("disbursedAmountMinor" in application));

    assert.equal(
      (
        await request(
          baseUrl,
          `/bank/personal-finance/loan-applications/${application.id}`,
          "clerk-b",
          "PATCH",
          { status: "withdrawn" },
        )
      ).status,
      404,
    );
    const withdrawn = await request(
      baseUrl,
      `/bank/personal-finance/loan-applications/${application.id}`,
      "clerk-a",
      "PATCH",
      { status: "withdrawn" },
    );
    assert.equal(withdrawn.status, 200);
    assert.equal((await withdrawn.json() as { status: string }).status, "withdrawn");
    const repeated = await request(
      baseUrl,
      `/bank/personal-finance/loan-applications/${application.id}`,
      "clerk-a",
      "PATCH",
      { status: "withdrawn" },
    );
    assert.equal(repeated.status, 200);
    assert.equal((await repeated.json() as { status: string }).status, "withdrawn");
  });
});

test("finance workspace migration is additive and does not mutate wallet ledger history", () => {
  assert.match(schema, /bank_financial_accounts/);
  assert.match(schema, /bank_finance_loan_applications/);
  assert.match(schema, /references\(\(\) => bankUsersTable\.id, \{ onDelete: "cascade" \}\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.bank_financial_accounts/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.bank_finance_loan_applications/i);
  assert.match(migration, /REFERENCES public\.bank_users\(id\) ON DELETE CASCADE/i);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS/i);
  assert.match(migrationJournal, /"tag": "20261121_finance_workspace_accounts"/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|UPDATE public\.bank_transactions|bank_ledger_entries/i);
  assert.match(storeSource, /eq\(bankWalletsTable\.userId, userId\)/);
  assert.match(storeSource, /inArray\(bankTransactionsTable\.status, \[\.\.\.postedStatuses\]\)/);
  assert.match(storeSource, /const postedStatuses = \["completed", "reversed"\]/);
  assert.match(storeSource, /inArray\(bankLedgerEntriesTable\.side, \["credit", "debit"\]\)/);
  assert.match(storeSource, /NOT \(\$\{sameUserWalletTransfer\}\)/);
  assert.match(storeSource, /groupBy\(bankWalletsTable\.id, bankLedgerEntriesTable\.currency\)/);
});
