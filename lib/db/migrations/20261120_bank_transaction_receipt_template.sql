ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS receipt_template text NOT NULL DEFAULT 'standard';
