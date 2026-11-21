import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  sql,
} from "drizzle-orm";
import type {
  BankFinanceReport,
  BankFinanceReportPeriod,
} from "@workspace/api-zod";
import {
  bankFinanceLoanApplicationsTable,
  bankFinancialAccountsTable,
  bankLedgerEntriesTable,
  bankPersonalFinanceRecordsTable,
  bankTransactionsTable,
  bankWalletsTable,
  db,
  type BankFinanceLoanApplication as DbLoanApplication,
  type BankFinancialAccount as DbFinancialAccount,
} from "@workspace/db";
import type {
  NormalizedFinanceLoanApplication,
  NormalizedFinancialAccount,
  NormalizedFinancialAccountUpdate,
} from "./finance-workspace";
import { getLedgerDirection } from "./finance-workspace";
import { financePeriodStart } from "./finance-workspace";

export type FinanceWorkspaceReport = Omit<BankFinanceReport, "recentActivity"> & {
  recentActivity: Array<
    Omit<BankFinanceReport["recentActivity"][number], "createdAt"> & {
      createdAt: string;
    }
  >;
};

export interface FinanceWorkspaceStore {
  report(userId: string, period: BankFinanceReportPeriod): Promise<FinanceWorkspaceReport>;
  listAccounts(userId: string): Promise<DbFinancialAccount[]>;
  createAccount(
    userId: string,
    input: NormalizedFinancialAccount,
  ): Promise<DbFinancialAccount>;
  findAccount(userId: string, accountId: string): Promise<DbFinancialAccount | null>;
  updateAccount(
    userId: string,
    accountId: string,
    input: NormalizedFinancialAccountUpdate,
  ): Promise<DbFinancialAccount | null>;
  listLoanApplications(userId: string): Promise<DbLoanApplication[]>;
  findLoanApplication(
    userId: string,
    applicationId: string,
  ): Promise<DbLoanApplication | null>;
  createLoanApplication(
    userId: string,
    input: NormalizedFinanceLoanApplication,
  ): Promise<DbLoanApplication>;
  withdrawLoanApplication(
    userId: string,
    applicationId: string,
  ): Promise<DbLoanApplication | null>;
}

export const drizzleFinanceWorkspaceStore: FinanceWorkspaceStore = {
  async report(userId, period) {
    const startDate = financePeriodStart(period);
    const effectiveDate = sql<string>`COALESCE(${bankTransactionsTable.transactionDate}, (${bankTransactionsTable.createdAt} AT TIME ZONE 'UTC')::date)`;
    const sameUserWalletTransfer = sql<boolean>`COALESCE(${bankTransactionsTable.fromUserId} = ${userId} AND ${bankTransactionsTable.toUserId} = ${userId}, false)`;
    const postedStatuses = ["completed", "reversed"] as const;
    const ledgerFilters = and(
      eq(bankWalletsTable.userId, userId),
      inArray(bankTransactionsTable.status, [...postedStatuses]),
      inArray(bankLedgerEntriesTable.side, ["credit", "debit"]),
      gte(effectiveDate, startDate),
    );
    const reportBucket =
      period === "month"
        ? sql<string>`to_char(${effectiveDate}, 'YYYY-MM-DD')`
        : sql<string>`to_char(${effectiveDate}, 'YYYY-MM')`;

    const [
      ledgerSummaries,
      trendRows,
      activityRows,
      accountSummaries,
      billSummaries,
      loanSummaries,
    ] = await Promise.all([
      db
        .select({
          walletId: bankWalletsTable.id,
          currency: bankLedgerEntriesTable.currency,
          inflowMinor: sql<string>`COALESCE(SUM(CASE WHEN ${bankLedgerEntriesTable.side} = 'credit' AND NOT (${sameUserWalletTransfer}) THEN ${bankLedgerEntriesTable.amountMinor} ELSE 0 END), 0)::text`,
          outflowMinor: sql<string>`COALESCE(SUM(CASE WHEN ${bankLedgerEntriesTable.side} = 'debit' AND NOT (${sameUserWalletTransfer}) THEN ${bankLedgerEntriesTable.amountMinor} ELSE 0 END), 0)::text`,
          netMinor: sql<string>`COALESCE(SUM(CASE WHEN NOT (${sameUserWalletTransfer}) AND ${bankLedgerEntriesTable.side} = 'credit' THEN ${bankLedgerEntriesTable.amountMinor} WHEN NOT (${sameUserWalletTransfer}) AND ${bankLedgerEntriesTable.side} = 'debit' THEN -${bankLedgerEntriesTable.amountMinor} ELSE 0 END), 0)::text`,
        })
        .from(bankLedgerEntriesTable)
        .innerJoin(
          bankTransactionsTable,
          eq(bankTransactionsTable.id, bankLedgerEntriesTable.transactionId),
        )
        .innerJoin(
          bankWalletsTable,
          eq(bankWalletsTable.id, bankLedgerEntriesTable.walletId),
        )
        .where(ledgerFilters)
        .groupBy(bankWalletsTable.id, bankLedgerEntriesTable.currency)
        .orderBy(asc(bankLedgerEntriesTable.currency), asc(bankWalletsTable.id)),
      db
        .select({
          walletId: bankWalletsTable.id,
          period: reportBucket,
          currency: bankLedgerEntriesTable.currency,
          inflowMinor: sql<string>`COALESCE(SUM(CASE WHEN ${bankLedgerEntriesTable.side} = 'credit' AND NOT (${sameUserWalletTransfer}) THEN ${bankLedgerEntriesTable.amountMinor} ELSE 0 END), 0)::text`,
          outflowMinor: sql<string>`COALESCE(SUM(CASE WHEN ${bankLedgerEntriesTable.side} = 'debit' AND NOT (${sameUserWalletTransfer}) THEN ${bankLedgerEntriesTable.amountMinor} ELSE 0 END), 0)::text`,
        })
        .from(bankLedgerEntriesTable)
        .innerJoin(
          bankTransactionsTable,
          eq(bankTransactionsTable.id, bankLedgerEntriesTable.transactionId),
        )
        .innerJoin(
          bankWalletsTable,
          eq(bankWalletsTable.id, bankLedgerEntriesTable.walletId),
        )
        .where(ledgerFilters)
        .groupBy(reportBucket, bankWalletsTable.id, bankLedgerEntriesTable.currency)
        .orderBy(
          asc(reportBucket),
          asc(bankLedgerEntriesTable.currency),
          asc(bankWalletsTable.id),
        ),
      db
        .select({
          id: bankLedgerEntriesTable.id,
          transactionId: bankTransactionsTable.id,
          walletId: bankWalletsTable.id,
          reference: bankTransactionsTable.reference,
          type: bankTransactionsTable.type,
          status: bankTransactionsTable.status,
          currency: bankLedgerEntriesTable.currency,
          side: bankLedgerEntriesTable.side,
          fromUserId: bankTransactionsTable.fromUserId,
          toUserId: bankTransactionsTable.toUserId,
          amountMinor: sql<string>`${bankLedgerEntriesTable.amountMinor}::text`,
          description: bankTransactionsTable.description,
          walletCurrency: bankWalletsTable.currency,
          effectiveDate: sql<string>`${effectiveDate}::text`,
          createdAt: bankTransactionsTable.createdAt,
        })
        .from(bankLedgerEntriesTable)
        .innerJoin(
          bankTransactionsTable,
          eq(bankTransactionsTable.id, bankLedgerEntriesTable.transactionId),
        )
        .innerJoin(
          bankWalletsTable,
          eq(bankWalletsTable.id, bankLedgerEntriesTable.walletId),
        )
        .where(ledgerFilters)
        .orderBy(desc(bankTransactionsTable.createdAt), desc(bankLedgerEntriesTable.createdAt))
        .limit(20),
      db
        .select({
          type: bankFinancialAccountsTable.type,
          currency: bankFinancialAccountsTable.currency,
          accountCount: sql<number>`COUNT(*)::int`,
          currentValueMinor: sql<string>`COALESCE(SUM(${bankFinancialAccountsTable.currentValueMinor}), 0)::text`,
          targetAmountMinor: sql<string>`COALESCE(SUM(${bankFinancialAccountsTable.targetAmountMinor}), 0)::text`,
        })
        .from(bankFinancialAccountsTable)
        .where(
          and(
            eq(bankFinancialAccountsTable.userId, userId),
            eq(bankFinancialAccountsTable.status, "active"),
          ),
        )
        .groupBy(bankFinancialAccountsTable.type, bankFinancialAccountsTable.currency)
        .orderBy(asc(bankFinancialAccountsTable.type), asc(bankFinancialAccountsTable.currency)),
      db
        .select({
          currency: bankPersonalFinanceRecordsTable.currency,
          unpaidCount: sql<number>`COUNT(*) FILTER (WHERE ${bankPersonalFinanceRecordsTable.status} = 'active')::int`,
          unpaidAmountMinor: sql<string>`COALESCE(SUM(${bankPersonalFinanceRecordsTable.amountMinor}) FILTER (WHERE ${bankPersonalFinanceRecordsTable.status} = 'active'), 0)::text`,
          recordedPaidCount: sql<number>`COUNT(*) FILTER (WHERE ${bankPersonalFinanceRecordsTable.status} = 'paid')::int`,
          recordedPaidAmountMinor: sql<string>`COALESCE(SUM(${bankPersonalFinanceRecordsTable.amountMinor}) FILTER (WHERE ${bankPersonalFinanceRecordsTable.status} = 'paid'), 0)::text`,
        })
        .from(bankPersonalFinanceRecordsTable)
        .where(
          and(
            eq(bankPersonalFinanceRecordsTable.userId, userId),
            eq(bankPersonalFinanceRecordsTable.kind, "bill"),
          ),
        )
        .groupBy(bankPersonalFinanceRecordsTable.currency)
        .orderBy(asc(bankPersonalFinanceRecordsTable.currency)),
      db
        .select({
          currency: bankFinanceLoanApplicationsTable.currency,
          submittedCount: sql<number>`COUNT(*) FILTER (WHERE ${bankFinanceLoanApplicationsTable.status} = 'submitted')::int`,
          withdrawnCount: sql<number>`COUNT(*) FILTER (WHERE ${bankFinanceLoanApplicationsTable.status} = 'withdrawn')::int`,
          requestedAmountMinor: sql<string>`COALESCE(SUM(${bankFinanceLoanApplicationsTable.requestedAmountMinor}) FILTER (WHERE ${bankFinanceLoanApplicationsTable.status} = 'submitted'), 0)::text`,
        })
        .from(bankFinanceLoanApplicationsTable)
        .where(eq(bankFinanceLoanApplicationsTable.userId, userId))
        .groupBy(bankFinanceLoanApplicationsTable.currency)
        .orderBy(asc(bankFinanceLoanApplicationsTable.currency)),
    ]);

    return {
      period,
      ledgerSummaries,
      ledgerTrend: trendRows,
      recentActivity: activityRows.map((row) => {
        const direction = getLedgerDirection(row);
        if (!direction) {
          throw new Error("A non-posted ledger entry reached the finance report.");
        }
        return {
          id: row.id,
          transactionId: row.transactionId,
          walletId: row.walletId,
          reference: row.reference,
          type: row.type,
          status: row.status,
          currency: row.currency,
          direction,
          amountMinor: row.amountMinor,
          description: row.description,
          walletCurrency: row.walletCurrency,
          effectiveDate: row.effectiveDate.slice(0, 10),
          createdAt: row.createdAt.toISOString(),
        };
      }),
      accountSummaries,
      billSummaries,
      loanSummaries,
    };
  },

  async listAccounts(userId) {
    return db
      .select()
      .from(bankFinancialAccountsTable)
      .where(eq(bankFinancialAccountsTable.userId, userId))
      .orderBy(
        asc(bankFinancialAccountsTable.status),
        desc(bankFinancialAccountsTable.updatedAt),
      );
  },

  async createAccount(userId, input) {
    const [account] = await db
      .insert(bankFinancialAccountsTable)
      .values({ userId, ...input })
      .returning();
    if (!account) throw new Error("Finance account was not returned after saving.");
    return account;
  },

  async findAccount(userId, accountId) {
    const [account] = await db
      .select()
      .from(bankFinancialAccountsTable)
      .where(
        and(
          eq(bankFinancialAccountsTable.id, accountId),
          eq(bankFinancialAccountsTable.userId, userId),
        ),
      )
      .limit(1);
    return account ?? null;
  },

  async updateAccount(userId, accountId, input) {
    const [account] = await db
      .update(bankFinancialAccountsTable)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(
          eq(bankFinancialAccountsTable.id, accountId),
          eq(bankFinancialAccountsTable.userId, userId),
        ),
      )
      .returning();
    return account ?? null;
  },

  async listLoanApplications(userId) {
    return db
      .select()
      .from(bankFinanceLoanApplicationsTable)
      .where(eq(bankFinanceLoanApplicationsTable.userId, userId))
      .orderBy(desc(bankFinanceLoanApplicationsTable.submittedAt));
  },

  async findLoanApplication(userId, applicationId) {
    const [application] = await db
      .select()
      .from(bankFinanceLoanApplicationsTable)
      .where(
        and(
          eq(bankFinanceLoanApplicationsTable.id, applicationId),
          eq(bankFinanceLoanApplicationsTable.userId, userId),
        ),
      )
      .limit(1);
    return application ?? null;
  },

  async createLoanApplication(userId, input) {
    const [application] = await db
      .insert(bankFinanceLoanApplicationsTable)
      .values({ userId, ...input })
      .returning();
    if (!application) {
      throw new Error("Loan application was not returned after submission.");
    }
    return application;
  },

  async withdrawLoanApplication(userId, applicationId) {
    const [application] = await db
      .update(bankFinanceLoanApplicationsTable)
      .set({ status: "withdrawn", updatedAt: new Date() })
      .where(
        and(
          eq(bankFinanceLoanApplicationsTable.id, applicationId),
          eq(bankFinanceLoanApplicationsTable.userId, userId),
          eq(bankFinanceLoanApplicationsTable.status, "submitted"),
        ),
      )
      .returning();
    return application ?? null;
  },
};
