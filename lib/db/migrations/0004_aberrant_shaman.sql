ALTER TABLE public.bank_users
  ADD COLUMN IF NOT EXISTS profile_setup_completed_at timestamp with time zone;
--> statement-breakpoint
ALTER TABLE public.bank_users
  ADD COLUMN IF NOT EXISTS testing_mode_disabled boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE public.bank_users
  ADD COLUMN IF NOT EXISTS transfer_access_granted boolean NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE public.bank_users
   SET profile_setup_completed_at = COALESCE(updated_at, created_at, now())
 WHERE NULLIF(btrim(first_name), '') IS NOT NULL
   AND NULLIF(btrim(last_name), '') IS NOT NULL
   AND profile_setup_completed_at IS NULL;