ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS transaction_date date;
