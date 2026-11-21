ALTER TABLE public.bank_vault_admin_entitlements
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;
