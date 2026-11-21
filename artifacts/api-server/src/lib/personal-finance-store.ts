import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import {
  bankPersonalFinanceRecordsTable,
  db,
  type BankPersonalFinanceRecord,
} from "@workspace/db";
import type {
  PersonalFinanceKind,
  PersonalFinanceRecordInput,
} from "@workspace/api-zod";
import type { NormalizedPersonalFinanceRecord } from "./personal-finance";

export type PersonalFinancePeriod = "month" | "quarter" | "year";
export type PersonalFinanceRecordPageOptions = {
  kind?: PersonalFinanceKind;
  currency?: PersonalFinanceRecordInput["currency"];
  page: number;
  pageSize: number;
};

export interface PersonalFinanceStore {
  list(
    userId: string,
    options: PersonalFinanceRecordPageOptions,
  ): Promise<{ records: BankPersonalFinanceRecord[]; total: number }>;
  create(
    userId: string,
    input: NormalizedPersonalFinanceRecord,
  ): Promise<BankPersonalFinanceRecord>;
  find(userId: string, recordId: string): Promise<BankPersonalFinanceRecord | null>;
  update(
    userId: string,
    recordId: string,
    input: NormalizedPersonalFinanceRecord,
  ): Promise<BankPersonalFinanceRecord | null>;
  delete(userId: string, recordId: string): Promise<boolean>;
  overview(userId: string, period: PersonalFinancePeriod): Promise<{
    period: PersonalFinancePeriod;
    currencySummaries: Array<{
      currency: BankPersonalFinanceRecord["currency"];
      expensesMinor: string;
      savingsBalanceMinor: string;
      savingsTargetMinor: string;
      investmentValueMinor: string;
      loanBalanceMinor: string;
      unpaidBillsMinor: string;
    }>;
    expenseTrend: Array<{
      period: string;
      currency: BankPersonalFinanceRecord["currency"];
      amountMinor: string;
    }>;
    expenseCategories: Array<{
      category: string;
      currency: BankPersonalFinanceRecord["currency"];
      amountMinor: string;
    }>;
    recentExpenses: BankPersonalFinanceRecord[];
  }>;
}

function financePeriodStart(period: PersonalFinancePeriod, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startMonth =
    period === "year"
      ? 0
      : period === "quarter"
        ? Math.floor(month / 3) * 3
        : month;
  return new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10);
}

export const drizzlePersonalFinanceStore: PersonalFinanceStore = {
  async list(userId, options) {
    const filters = [eq(bankPersonalFinanceRecordsTable.userId, userId)];
    if (options.kind) filters.push(eq(bankPersonalFinanceRecordsTable.kind, options.kind));
    if (options.currency) {
      filters.push(eq(bankPersonalFinanceRecordsTable.currency, options.currency));
    }
    const where = and(...filters);
    const [totalRow] = await db
      .select({ total: count() })
      .from(bankPersonalFinanceRecordsTable)
      .where(where);
    const records = await db
      .select()
      .from(bankPersonalFinanceRecordsTable)
      .where(where)
      .orderBy(
        desc(bankPersonalFinanceRecordsTable.recordDate),
        desc(bankPersonalFinanceRecordsTable.createdAt),
      )
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize);
    return { records, total: totalRow?.total ?? 0 };
  },

  async create(userId, input) {
    const [record] = await db
      .insert(bankPersonalFinanceRecordsTable)
      .values({ userId, ...input })
      .returning();
    if (!record) throw new Error("The finance record was not returned after saving.");
    return record;
  },

  async find(userId, recordId) {
    const [record] = await db
      .select()
      .from(bankPersonalFinanceRecordsTable)
      .where(
        and(
          eq(bankPersonalFinanceRecordsTable.id, recordId),
          eq(bankPersonalFinanceRecordsTable.userId, userId),
        ),
      )
      .limit(1);
    return record ?? null;
  },

  async update(userId, recordId, input) {
    const [record] = await db
      .update(bankPersonalFinanceRecordsTable)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(
          eq(bankPersonalFinanceRecordsTable.id, recordId),
          eq(bankPersonalFinanceRecordsTable.userId, userId),
        ),
      )
      .returning();
    return record ?? null;
  },

  async delete(userId, recordId) {
    const deleted = await db
      .delete(bankPersonalFinanceRecordsTable)
      .where(
        and(
          eq(bankPersonalFinanceRecordsTable.id, recordId),
          eq(bankPersonalFinanceRecordsTable.userId, userId),
        ),
      )
      .returning({ id: bankPersonalFinanceRecordsTable.id });
    return deleted.length > 0;
  },

  async overview(userId, period) {
    const startDate = financePeriodStart(period);
    const currencySummaries = await db
      .select({
        currency: bankPersonalFinanceRecordsTable.currency,
        expensesMinor: sql<string>`COALESCE(SUM(CASE WHEN ${bankPersonalFinanceRecordsTable.kind} = 'expense' AND ${bankPersonalFinanceRecordsTable.recordDate} >= ${startDate} THEN ${bankPersonalFinanceRecordsTable.amountMinor} ELSE 0 END), 0)::text`,
        savingsBalanceMinor: sql<string>`COALESCE(SUM(CASE WHEN ${bankPersonalFinanceRecordsTable.kind} = 'savings' AND ${bankPersonalFinanceRecordsTable.status} = 'active' THEN ${bankPersonalFinanceRecordsTable.amountMinor} ELSE 0 END), 0)::text`,
        savingsTargetMinor: sql<string>`COALESCE(SUM(CASE WHEN ${bankPersonalFinanceRecordsTable.kind} = 'savings' AND ${bankPersonalFinanceRecordsTable.status} = 'active' THEN ${bankPersonalFinanceRecordsTable.targetAmountMinor} ELSE 0 END), 0)::text`,
        investmentValueMinor: sql<string>`COALESCE(SUM(CASE WHEN ${bankPersonalFinanceRecordsTable.kind} = 'investment' AND ${bankPersonalFinanceRecordsTable.status} = 'active' THEN ${bankPersonalFinanceRecordsTable.amountMinor} ELSE 0 END), 0)::text`,
        loanBalanceMinor: sql<string>`COALESCE(SUM(CASE WHEN ${bankPersonalFinanceRecordsTable.kind} = 'loan' AND ${bankPersonalFinanceRecordsTable.status} = 'active' THEN ${bankPersonalFinanceRecordsTable.amountMinor} ELSE 0 END), 0)::text`,
        unpaidBillsMinor: sql<string>`COALESCE(SUM(CASE WHEN ${bankPersonalFinanceRecordsTable.kind} = 'bill' AND ${bankPersonalFinanceRecordsTable.status} = 'active' THEN ${bankPersonalFinanceRecordsTable.amountMinor} ELSE 0 END), 0)::text`,
      })
      .from(bankPersonalFinanceRecordsTable)
      .where(eq(bankPersonalFinanceRecordsTable.userId, userId))
      .groupBy(bankPersonalFinanceRecordsTable.currency);

    const bucket =
      period === "month"
        ? sql<string>`to_char(${bankPersonalFinanceRecordsTable.recordDate}, 'YYYY-MM-DD')`
        : sql<string>`to_char(${bankPersonalFinanceRecordsTable.recordDate}, 'YYYY-MM')`;
    const expenseFilters = and(
      eq(bankPersonalFinanceRecordsTable.userId, userId),
      eq(bankPersonalFinanceRecordsTable.kind, "expense"),
      gte(bankPersonalFinanceRecordsTable.recordDate, startDate),
    );
    const expenseTrend = await db
      .select({
        period: bucket,
        currency: bankPersonalFinanceRecordsTable.currency,
        amountMinor: sql<string>`COALESCE(SUM(${bankPersonalFinanceRecordsTable.amountMinor}), 0)::text`,
      })
      .from(bankPersonalFinanceRecordsTable)
      .where(expenseFilters)
      .groupBy(bucket, bankPersonalFinanceRecordsTable.currency)
      .orderBy(asc(bucket), asc(bankPersonalFinanceRecordsTable.currency));

    const category = sql<string>`COALESCE(NULLIF(btrim(${bankPersonalFinanceRecordsTable.category}), ''), 'Uncategorized')`;
    const expenseCategories = await db
      .select({
        category,
        currency: bankPersonalFinanceRecordsTable.currency,
        amountMinor: sql<string>`COALESCE(SUM(${bankPersonalFinanceRecordsTable.amountMinor}), 0)::text`,
      })
      .from(bankPersonalFinanceRecordsTable)
      .where(expenseFilters)
      .groupBy(category, bankPersonalFinanceRecordsTable.currency)
      .orderBy(desc(sql`SUM(${bankPersonalFinanceRecordsTable.amountMinor})`));

    const recentExpenses = await db
      .select()
      .from(bankPersonalFinanceRecordsTable)
      .where(
        and(
          eq(bankPersonalFinanceRecordsTable.userId, userId),
          eq(bankPersonalFinanceRecordsTable.kind, "expense"),
        ),
      )
      .orderBy(
        desc(bankPersonalFinanceRecordsTable.recordDate),
        desc(bankPersonalFinanceRecordsTable.createdAt),
      )
      .limit(6);

    return {
      period,
      currencySummaries,
      expenseTrend,
      expenseCategories,
      recentExpenses,
    };
  },
};
