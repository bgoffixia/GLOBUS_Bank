CREATE TABLE IF NOT EXISTS public.bank_vault_admin_entitlements (
  user_id text PRIMARY KEY,
  granted_by_user_id text NOT NULL,
  reason text NOT NULL,
  granted_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bank_vault_admin_entitlements_user_id_bank_users_id_fk'
      AND conrelid = 'public.bank_vault_admin_entitlements'::regclass
  ) THEN
    ALTER TABLE public.bank_vault_admin_entitlements
      ADD CONSTRAINT bank_vault_admin_entitlements_user_id_bank_users_id_fk
      FOREIGN KEY (user_id) REFERENCES public.bank_users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bank_vault_admin_entitlements_granted_by_user_id_bank_users_id_fk'
      AND conrelid = 'public.bank_vault_admin_entitlements'::regclass
  ) THEN
    ALTER TABLE public.bank_vault_admin_entitlements
      ADD CONSTRAINT bank_vault_admin_entitlements_granted_by_user_id_bank_users_id_fk
      FOREIGN KEY (granted_by_user_id) REFERENCES public.bank_users(id);
  END IF;
END;
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bank_vault_admin_entitlement_grantor_idx
  ON public.bank_vault_admin_entitlements (granted_by_user_id, granted_at);
