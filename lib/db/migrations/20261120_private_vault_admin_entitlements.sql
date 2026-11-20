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
    WHERE conrelid = 'public.bank_vault_admin_entitlements'::regclass
      AND contype = 'f'
      AND confrelid = 'public.bank_users'::regclass
      AND conkey = ARRAY[(
        SELECT attnum
        FROM pg_attribute
        WHERE attrelid = 'public.bank_vault_admin_entitlements'::regclass
          AND attname = 'user_id'
          AND NOT attisdropped
      )]::smallint[]
      AND confkey = ARRAY[(
        SELECT attnum
        FROM pg_attribute
        WHERE attrelid = 'public.bank_users'::regclass
          AND attname = 'id'
          AND NOT attisdropped
      )]::smallint[]
      AND confdeltype = 'c'
  ) THEN
    ALTER TABLE public.bank_vault_admin_entitlements
      ADD CONSTRAINT bank_vault_entitlement_user_fk
      FOREIGN KEY (user_id) REFERENCES public.bank_users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bank_vault_admin_entitlements'::regclass
      AND contype = 'f'
      AND confrelid = 'public.bank_users'::regclass
      AND conkey = ARRAY[(
        SELECT attnum
        FROM pg_attribute
        WHERE attrelid = 'public.bank_vault_admin_entitlements'::regclass
          AND attname = 'granted_by_user_id'
          AND NOT attisdropped
      )]::smallint[]
      AND confkey = ARRAY[(
        SELECT attnum
        FROM pg_attribute
        WHERE attrelid = 'public.bank_users'::regclass
          AND attname = 'id'
          AND NOT attisdropped
      )]::smallint[]
      AND confdeltype = 'a'
  ) THEN
    ALTER TABLE public.bank_vault_admin_entitlements
      ADD CONSTRAINT bank_vault_entitlement_grantor_fk
      FOREIGN KEY (granted_by_user_id) REFERENCES public.bank_users(id);
  END IF;
END;
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS bank_vault_admin_entitlement_grantor_idx
  ON public.bank_vault_admin_entitlements (granted_by_user_id, granted_at);
