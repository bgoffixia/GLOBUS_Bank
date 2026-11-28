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
