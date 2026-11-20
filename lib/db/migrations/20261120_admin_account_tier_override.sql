ALTER TABLE public.bank_users
  ADD COLUMN IF NOT EXISTS admin_account_tier text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.bank_users'::regclass
       AND conname = 'bank_users_admin_account_tier_check'
  ) THEN
    ALTER TABLE public.bank_users
      ADD CONSTRAINT bank_users_admin_account_tier_check
      CHECK (
        admin_account_tier IS NULL
        OR admin_account_tier IN ('standard', 'silver', 'gold', 'bronze')
      );
  END IF;
END;
$$;
