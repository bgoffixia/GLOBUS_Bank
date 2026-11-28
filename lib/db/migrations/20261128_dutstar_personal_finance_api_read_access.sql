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
