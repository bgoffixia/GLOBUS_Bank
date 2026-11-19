ALTER TABLE public.bank_users
  ADD COLUMN IF NOT EXISTS preferred_receipt_template text NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bank_users_preferred_receipt_template_check'
      AND conrelid = 'public.bank_users'::regclass
  ) THEN
    ALTER TABLE public.bank_users
      ADD CONSTRAINT bank_users_preferred_receipt_template_check
      CHECK (preferred_receipt_template IN (
        'standard',
        'bank_payment',
        'transfer_journey',
        'transfer_ledger',
        'settlement_statement'
      ));
  END IF;
END;
$$;
