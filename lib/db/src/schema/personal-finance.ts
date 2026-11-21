import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { bankCurrencyEnum, bankUsersTable } from "./bank";

export const personalFinanceKindEnum = pgEnum("bank_personal_finance_kind", [
  "expense",
  "savings",
  "investment",
  "loan",
  "bill",
]);

export const personalFinanceStatusEnum = pgEnum(
  "bank_personal_finance_status",
  ["active", "paid", "closed"],
);

export const personalFinanceFrequencyEnum = pgEnum(
  "bank_personal_finance_frequency",
  ["once", "weekly", "monthly", "quarterly", "yearly"],
);

export const bankPersonalFinanceRecordsTable = pgTable(
  "bank_personal_finance_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => bankUsersTable.id, { onDelete: "cascade" }),
    kind: personalFinanceKindEnum("kind").notNull(),
    title: text("title").notNull(),
    category: text("category"),
    currency: bankCurrencyEnum("currency").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    targetAmountMinor: bigint("target_amount_minor", { mode: "bigint" }),
    recordDate: date("record_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    frequency: personalFinanceFrequencyEnum("frequency"),
    status: personalFinanceStatusEnum("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "bank_personal_finance_title_nonempty_check",
      sql`btrim(${table.title}) <> ''`,
    ),
    check(
      "bank_personal_finance_amount_nonnegative_check",
      sql`${table.amountMinor} >= 0 AND (${table.kind} <> 'expense' OR ${table.amountMinor} > 0)`,
    ),
    check(
      "bank_personal_finance_savings_target_check",
      sql`(${table.kind} = 'savings' AND ${table.targetAmountMinor} IS NOT NULL AND ${table.targetAmountMinor} > 0) OR (${table.kind} <> 'savings' AND ${table.targetAmountMinor} IS NULL)`,
    ),
    index("bank_personal_finance_user_kind_date_idx").on(
      table.userId,
      table.kind,
      table.recordDate,
    ),
    index("bank_personal_finance_user_currency_idx").on(
      table.userId,
      table.currency,
    ),
    index("bank_personal_finance_user_due_date_idx")
      .on(table.userId, table.dueDate)
      .where(sql`${table.dueDate} IS NOT NULL`),
  ],
);

export const insertBankPersonalFinanceRecordSchema = createInsertSchema(
  bankPersonalFinanceRecordsTable,
).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBankPersonalFinanceRecord = z.infer<
  typeof insertBankPersonalFinanceRecordSchema
>;
export type BankPersonalFinanceRecord =
  typeof bankPersonalFinanceRecordsTable.$inferSelect;
