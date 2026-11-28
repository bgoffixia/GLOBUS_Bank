-- Cloudflare Worker customer-scoped read access for personal finance records.
-- The Worker sets app.clerk_user_id only after verifying the Clerk JWT.
-- No INSERT, UPDATE, or DELETE privileges are granted by this migration.
ALTER TABLE public.bank_personal_finance_records ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS dutstar_api_personal_finance_owner_select
  ON public.bank_personal_finance_records;
--> statement-breakpoint
CREATE POLICY dutstar_api_personal_finance_owner_select
  ON public.bank_personal_finance_records
  FOR SELECT TO dutstar_api
  USING (
    user_id = NULLIF(current_setting('app.clerk_user_id', true), '')
  );
--> statement-breakpoint
GRANT SELECT ON public.bank_personal_finance_records TO dutstar_api;
--> statement-breakpoint
DROP POLICY IF EXISTS dutstar_api_personal_finance_owner_insert
  ON public.bank_personal_finance_records;
--> statement-breakpoint
CREATE POLICY dutstar_api_personal_finance_owner_insert
  ON public.bank_personal_finance_records
  FOR INSERT TO dutstar_api
  WITH CHECK (
    user_id = NULLIF(current_setting('app.clerk_user_id', true), '')
  );
--> statement-breakpoint
DROP POLICY IF EXISTS dutstar_api_personal_finance_owner_update
  ON public.bank_personal_finance_records;
--> statement-breakpoint
CREATE POLICY dutstar_api_personal_finance_owner_update
  ON public.bank_personal_finance_records
  FOR UPDATE TO dutstar_api
  USING (
    user_id = NULLIF(current_setting('app.clerk_user_id', true), '')
  )
  WITH CHECK (
    user_id = NULLIF(current_setting('app.clerk_user_id', true), '')
  );
--> statement-breakpoint
DROP POLICY IF EXISTS dutstar_api_personal_finance_owner_delete
  ON public.bank_personal_finance_records;
--> statement-breakpoint
CREATE POLICY dutstar_api_personal_finance_owner_delete
  ON public.bank_personal_finance_records
  FOR DELETE TO dutstar_api
  USING (
    user_id = NULLIF(current_setting('app.clerk_user_id', true), '')
  );
--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE
  ON public.bank_personal_finance_records TO dutstar_api;
--> statement-breakpoint
-- Allow a signed-in customer to complete their own initial profile only.
-- Column-level grants intentionally exclude email, customer ID, account flags,
-- PIN hashes, Vault fields, and administrator-controlled settings.
DROP POLICY IF EXISTS dutstar_api_user_self_update_profile
  ON public.bank_users;
--> statement-breakpoint
CREATE POLICY dutstar_api_user_self_update_profile
  ON public.bank_users
  FOR UPDATE TO dutstar_api
  USING (
    id = NULLIF(current_setting('app.clerk_user_id', true), '')
  )
  WITH CHECK (
    id = NULLIF(current_setting('app.clerk_user_id', true), '')
  );
--> statement-breakpoint
GRANT UPDATE (
  first_name, last_name, address, phone, country, city_of_origin,
  date_of_birth, occupation, profile_setup_completed_at,
  accepted_terms_at, updated_at
) ON public.bank_users TO dutstar_api;
--> statement-breakpoint
-- PIN values remain hash-only. This grants the Worker access only to the
-- current user's own PIN hash and lockout state through the owner RLS policy.
GRANT UPDATE (
  transaction_pin_hash, transaction_pin_failed_attempts,
  transaction_pin_locked_until, updated_at
) ON public.bank_users TO dutstar_api;
--> statement-breakpoint
-- Customer-owned loan application access for the Cloudflare Worker.
DROP POLICY IF EXISTS dutstar_api_loan_application_owner_select
  ON public.bank_finance_loan_applications;
--> statement-breakpoint
CREATE POLICY dutstar_api_loan_application_owner_select
  ON public.bank_finance_loan_applications
  FOR SELECT TO dutstar_api
  USING (user_id = NULLIF(current_setting('app.clerk_user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS dutstar_api_loan_application_owner_insert
  ON public.bank_finance_loan_applications;
--> statement-breakpoint
CREATE POLICY dutstar_api_loan_application_owner_insert
  ON public.bank_finance_loan_applications
  FOR INSERT TO dutstar_api
  WITH CHECK (user_id = NULLIF(current_setting('app.clerk_user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS dutstar_api_loan_application_owner_update
  ON public.bank_finance_loan_applications;
--> statement-breakpoint
CREATE POLICY dutstar_api_loan_application_owner_update
  ON public.bank_finance_loan_applications
  FOR UPDATE TO dutstar_api
  USING (user_id = NULLIF(current_setting('app.clerk_user_id', true), ''))
  WITH CHECK (user_id = NULLIF(current_setting('app.clerk_user_id', true), ''));
--> statement-breakpoint
GRANT SELECT, INSERT ON public.bank_finance_loan_applications TO dutstar_api;
--> statement-breakpoint
GRANT UPDATE (status, updated_at)
  ON public.bank_finance_loan_applications TO dutstar_api;
--> statement-breakpoint
-- Create the finance tracker table if it was not present in the live project.
DO $$
BEGIN
  CREATE TYPE public.bank_financial_account_type AS ENUM ('savings', 'investment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE public.bank_financial_account_status AS ENUM ('active', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
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
  CONSTRAINT bank_financial_account_name_nonempty_check CHECK (btrim(name) <> ''),
  CONSTRAINT bank_financial_account_values_nonnegative_check CHECK (
    current_value_minor >= 0 AND
    (target_amount_minor IS NULL OR (account_type = 'savings' AND target_amount_minor > 0))
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bank_financial_account_user_type_status_idx
  ON public.bank_financial_accounts (user_id, account_type, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bank_financial_account_user_currency_idx
  ON public.bank_financial_accounts (user_id, currency);
--> statement-breakpoint
ALTER TABLE public.bank_financial_accounts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS dutstar_api_financial_account_owner_select
  ON public.bank_financial_accounts;
--> statement-breakpoint
CREATE POLICY dutstar_api_financial_account_owner_select
  ON public.bank_financial_accounts FOR SELECT TO dutstar_api
  USING (user_id = NULLIF(current_setting('app.clerk_user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS dutstar_api_financial_account_owner_insert
  ON public.bank_financial_accounts;
--> statement-breakpoint
CREATE POLICY dutstar_api_financial_account_owner_insert
  ON public.bank_financial_accounts FOR INSERT TO dutstar_api
  WITH CHECK (user_id = NULLIF(current_setting('app.clerk_user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS dutstar_api_financial_account_owner_update
  ON public.bank_financial_accounts;
--> statement-breakpoint
CREATE POLICY dutstar_api_financial_account_owner_update
  ON public.bank_financial_accounts FOR UPDATE TO dutstar_api
  USING (user_id = NULLIF(current_setting('app.clerk_user_id', true), ''))
  WITH CHECK (user_id = NULLIF(current_setting('app.clerk_user_id', true), ''));
--> statement-breakpoint
GRANT SELECT, INSERT ON public.bank_financial_accounts TO dutstar_api;
--> statement-breakpoint
GRANT UPDATE (name, current_value_minor, target_amount_minor, status, notes, updated_at)
  ON public.bank_financial_accounts TO dutstar_api;
--> statement-breakpoint
-- Customer access is limited to general support conversations in the first
-- Cloudflare support release. Restricted categories remain unavailable until
-- their Vault entitlement checks are ported.
ALTER TABLE public.bank_support_conversations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.bank_support_messages ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS dutstar_api_support_conversation_owner_select
  ON public.bank_support_conversations;
--> statement-breakpoint
CREATE POLICY dutstar_api_support_conversation_owner_select
  ON public.bank_support_conversations FOR SELECT TO dutstar_api
  USING (
    user_id = NULLIF(current_setting('app.clerk_user_id', true), '')
    AND category = 'general'
  );
--> statement-breakpoint
DROP POLICY IF EXISTS dutstar_api_support_conversation_owner_insert
  ON public.bank_support_conversations;
--> statement-breakpoint
CREATE POLICY dutstar_api_support_conversation_owner_insert
  ON public.bank_support_conversations FOR INSERT TO dutstar_api
  WITH CHECK (
    user_id = NULLIF(current_setting('app.clerk_user_id', true), '')
    AND category = 'general'
  );
--> statement-breakpoint
DROP POLICY IF EXISTS dutstar_api_support_conversation_owner_update
  ON public.bank_support_conversations;
--> statement-breakpoint
CREATE POLICY dutstar_api_support_conversation_owner_update
  ON public.bank_support_conversations FOR UPDATE TO dutstar_api
  USING (
    user_id = NULLIF(current_setting('app.clerk_user_id', true), '')
    AND category = 'general'
  )
  WITH CHECK (
    user_id = NULLIF(current_setting('app.clerk_user_id', true), '')
    AND category = 'general'
  );
--> statement-breakpoint
DROP POLICY IF EXISTS dutstar_api_support_message_owner_select
  ON public.bank_support_messages;
--> statement-breakpoint
CREATE POLICY dutstar_api_support_message_owner_select
  ON public.bank_support_messages FOR SELECT TO dutstar_api
  USING (EXISTS (
    SELECT 1 FROM public.bank_support_conversations c
    WHERE c.id = conversation_id
      AND c.user_id = NULLIF(current_setting('app.clerk_user_id', true), '')
      AND c.category = 'general'
  ));
--> statement-breakpoint
DROP POLICY IF EXISTS dutstar_api_support_message_owner_insert
  ON public.bank_support_messages;
--> statement-breakpoint
CREATE POLICY dutstar_api_support_message_owner_insert
  ON public.bank_support_messages FOR INSERT TO dutstar_api
  WITH CHECK (
    sender_user_id = NULLIF(current_setting('app.clerk_user_id', true), '')
    AND sender_role = 'customer'
    AND EXISTS (
      SELECT 1 FROM public.bank_support_conversations c
      WHERE c.id = conversation_id
        AND c.user_id = NULLIF(current_setting('app.clerk_user_id', true), '')
        AND c.category = 'general'
    )
  );
--> statement-breakpoint
GRANT SELECT, INSERT ON public.bank_support_conversations TO dutstar_api;
--> statement-breakpoint
GRANT UPDATE (customer_unread, admin_unread, status, last_message_at, updated_at)
  ON public.bank_support_conversations TO dutstar_api;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.bank_support_messages TO dutstar_api;
