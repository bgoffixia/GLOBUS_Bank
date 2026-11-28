-- Paystack Vault subscription lifecycle support.
-- Applied to the live Supabase project before this migration was committed.
BEGIN;
ALTER TABLE public.bank_vault_paystack_plans
  ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 30;
ALTER TABLE public.bank_vault_paystack_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bank_vault_paystack_events_owner ON public.bank_vault_paystack_events;
CREATE POLICY bank_vault_paystack_events_owner
  ON public.bank_vault_paystack_events
  FOR ALL TO dutstar_api
  USING (user_id = current_setting('app.clerk_user_id', true))
  WITH CHECK (user_id = current_setting('app.clerk_user_id', true));
GRANT SELECT ON public.bank_vault_paystack_plans TO dutstar_api;
GRANT SELECT, INSERT ON public.bank_vault_paystack_events TO dutstar_api;
GRANT UPDATE (
  vault_subscription_status,
  vault_subscription_requested_at,
  vault_subscription_expires_at,
  vault_subscription_plan,
  vault_subscription_amount_minor,
  vault_subscription_payment_reference,
  vault_subscription_payment_status,
  vault_subscription_payment_initialized_at,
  vault_subscription_payment_verified_at,
  vault_paystack_plan_code,
  vault_paystack_subscription_code,
  vault_paystack_customer_code,
  updated_at
) ON public.bank_users TO dutstar_api;
COMMIT;
