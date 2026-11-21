DO $$
BEGIN
  CREATE TYPE public.bank_personal_finance_kind AS ENUM (
    'expense', 'savings', 'investment', 'loan', 'bill'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE public.bank_personal_finance_status AS ENUM (
    'active', 'paid', 'closed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE public.bank_personal_finance_frequency AS ENUM (
    'once', 'weekly', 'monthly', 'quarterly', 'yearly'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.bank_personal_finance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.bank_users(id) ON DELETE CASCADE,
  kind public.bank_personal_finance_kind NOT NULL,
  title text NOT NULL,
  category text,
  currency public.bank_currency_code NOT NULL,
  amount_minor bigint NOT NULL,
  target_amount_minor bigint,
  record_date date NOT NULL,
  due_date date,
  frequency public.bank_personal_finance_frequency,
  status public.bank_personal_finance_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_personal_finance_title_nonempty_check
    CHECK (btrim(title) <> ''),
  CONSTRAINT bank_personal_finance_amount_nonnegative_check
    CHECK (amount_minor >= 0 AND (kind <> 'expense' OR amount_minor > 0)),
  CONSTRAINT bank_personal_finance_savings_target_check
    CHECK (
      (kind = 'savings' AND target_amount_minor IS NOT NULL AND target_amount_minor > 0)
      OR (kind <> 'savings' AND target_amount_minor IS NULL)
    )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bank_personal_finance_user_kind_date_idx
  ON public.bank_personal_finance_records (user_id, kind, record_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bank_personal_finance_user_currency_idx
  ON public.bank_personal_finance_records (user_id, currency);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bank_personal_finance_user_due_date_idx
  ON public.bank_personal_finance_records (user_id, due_date)
  WHERE due_date IS NOT NULL;
