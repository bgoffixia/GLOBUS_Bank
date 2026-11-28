-- Seed the existing configured DUTSTAR Vault prices as one-time Paystack plans.
-- Recurring Paystack plan codes remain optional and are not enabled by this migration.
BEGIN;
ALTER TABLE public.bank_vault_paystack_plans
  ALTER COLUMN provider_plan_code DROP NOT NULL;
ALTER TABLE public.bank_vault_paystack_plans
  ADD CONSTRAINT bank_vault_paystack_plans_plan_code_unique UNIQUE (plan_code);

INSERT INTO public.bank_vault_paystack_plans
  (plan_code, amount_minor, provider_plan_code, duration_days)
SELECT '1m', vault_plan_1m_price_minor, NULL, 30
FROM public.bank_admin_settings
WHERE id = 'operations'
  AND vault_plan_1m_price_minor ~ '^[1-9][0-9]{0,11}$'
ON CONFLICT (plan_code) DO UPDATE
SET amount_minor = EXCLUDED.amount_minor,
    duration_days = EXCLUDED.duration_days;

INSERT INTO public.bank_vault_paystack_plans
  (plan_code, amount_minor, provider_plan_code, duration_days)
SELECT '3m', vault_plan_3m_price_minor, NULL, 90
FROM public.bank_admin_settings
WHERE id = 'operations'
  AND vault_plan_3m_price_minor ~ '^[1-9][0-9]{0,11}$'
ON CONFLICT (plan_code) DO UPDATE
SET amount_minor = EXCLUDED.amount_minor,
    duration_days = EXCLUDED.duration_days;

INSERT INTO public.bank_vault_paystack_plans
  (plan_code, amount_minor, provider_plan_code, duration_days)
SELECT '1y', vault_plan_1y_price_minor, NULL, 365
FROM public.bank_admin_settings
WHERE id = 'operations'
  AND vault_plan_1y_price_minor ~ '^[1-9][0-9]{0,11}$'
ON CONFLICT (plan_code) DO UPDATE
SET amount_minor = EXCLUDED.amount_minor,
    duration_days = EXCLUDED.duration_days;
COMMIT;
