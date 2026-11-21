DO $$
BEGIN
  CREATE TYPE public.bank_financial_account_type AS ENUM ('savings', 'investment');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE public.bank_financial_account_status AS ENUM ('active', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE public.bank_finance_loan_application_status AS ENUM ('submitted', 'withdrawn');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.bank_financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.bank_users(id) ON DELETE CASCADE,
  account_type public.bank_financial_account_type NOT NULL,
  name text NOT NULL,
  currency public.bank_currency_code NOT NULL,
  current_value_minor bigint NOT NULL DEFAULT 0,
  target_amount_minor bigint,
  opened_on date NOT NULL,
  status public.bank_financial_account_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_financial_account_name_nonempty_check
    CHECK (btrim(name) <> ''),
  CONSTRAINT bank_financial_account_values_nonnegative_check
    CHECK (
      current_value_minor >= 0
      AND (
        target_amount_minor IS NULL
        OR (account_type = 'savings' AND target_amount_minor > 0)
      )
    )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bank_financial_account_user_type_status_idx
  ON public.bank_financial_accounts (user_id, account_type, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bank_financial_account_user_currency_idx
  ON public.bank_financial_accounts (user_id, currency);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.bank_finance_loan_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.bank_users(id) ON DELETE CASCADE,
  requested_amount_minor bigint NOT NULL,
  currency public.bank_currency_code NOT NULL,
  purpose text NOT NULL,
  term_months integer NOT NULL,
  status public.bank_finance_loan_application_status NOT NULL DEFAULT 'submitted',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_finance_loan_application_amount_positive_check
    CHECK (requested_amount_minor > 0),
  CONSTRAINT bank_finance_loan_application_purpose_nonempty_check
    CHECK (btrim(purpose) <> ''),
  CONSTRAINT bank_finance_loan_application_term_months_check
    CHECK (term_months >= 1 AND term_months <= 600)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bank_finance_loan_application_user_created_idx
  ON public.bank_finance_loan_applications (user_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bank_finance_loan_application_user_status_idx
  ON public.bank_finance_loan_applications (user_id, status);
