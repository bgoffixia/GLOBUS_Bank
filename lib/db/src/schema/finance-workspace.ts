import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { bankCurrencyEnum, bankUsersTable } from "./bank";

export const financialAccountTypeEnum = pgEnum(
  "bank_financial_account_type",
  ["savings", "investment"],
);

export const financialAccountStatusEnum = pgEnum(
  "bank_financial_account_status",
  ["active", "closed"],
);

export const loanApplicationStatusEnum = pgEnum(
  "bank_finance_loan_application_status",
  ["submitted", "withdrawn"],
);

export const bankFinancialAccountsTable = pgTable(
  "bank_financial_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => bankUsersTable.id, { onDelete: "cascade" }),
    type: financialAccountTypeEnum("account_type").notNull(),
    name: text("name").notNull(),
    currency: bankCurrencyEnum("currency").notNull(),
    currentValueMinor: bigint("current_value_minor", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    targetAmountMinor: bigint("target_amount_minor", { mode: "bigint" }),
    openedOn: date("opened_on", { mode: "string" }).notNull(),
    status: financialAccountStatusEnum("status").notNull().default("active"),
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
      "bank_financial_account_name_nonempty_check",
      sql`btrim(${table.name}) <> ''`,
    ),
    check(
      "bank_financial_account_values_nonnegative_check",
      sql`${table.currentValueMinor} >= 0 AND (${table.targetAmountMinor} IS NULL OR (${table.type} = 'savings' AND ${table.targetAmountMinor} > 0))`,
    ),
    index("bank_financial_account_user_type_status_idx").on(
      table.userId,
      table.type,
      table.status,
    ),
    index("bank_financial_account_user_currency_idx").on(
      table.userId,
      table.currency,
    ),
  ],
);

export const bankFinanceLoanApplicationsTable = pgTable(
  "bank_finance_loan_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => bankUsersTable.id, { onDelete: "cascade" }),
    requestedAmountMinor: bigint("requested_amount_minor", {
      mode: "bigint",
    }).notNull(),
    currency: bankCurrencyEnum("currency").notNull(),
    purpose: text("purpose").notNull(),
    termMonths: integer("term_months").notNull(),
    status: loanApplicationStatusEnum("status").notNull().default("submitted"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
      "bank_finance_loan_application_amount_positive_check",
      sql`${table.requestedAmountMinor} > 0`,
    ),
    check(
      "bank_finance_loan_application_purpose_nonempty_check",
      sql`btrim(${table.purpose}) <> ''`,
    ),
    check(
      "bank_finance_loan_application_term_months_check",
      sql`${table.termMonths} >= 1 AND ${table.termMonths} <= 600`,
    ),
    index("bank_finance_loan_application_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("bank_finance_loan_application_user_status_idx").on(
      table.userId,
      table.status,
    ),
  ],
);

export const insertBankFinancialAccountSchema = createInsertSchema(
  bankFinancialAccountsTable,
).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBankFinancialAccount = z.infer<
  typeof insertBankFinancialAccountSchema
>;
export type BankFinancialAccount =
  typeof bankFinancialAccountsTable.$inferSelect;

export const insertBankFinanceLoanApplicationSchema = createInsertSchema(
  bankFinanceLoanApplicationsTable,
).omit({
  id: true,
  userId: true,
  status: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBankFinanceLoanApplication = z.infer<
  typeof insertBankFinanceLoanApplicationSchema
>;
export type BankFinanceLoanApplication =
  typeof bankFinanceLoanApplicationsTable.$inferSelect;
