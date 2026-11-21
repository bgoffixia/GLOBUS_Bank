ALTER TABLE public.bank_users
  ADD COLUMN IF NOT EXISTS address text;
