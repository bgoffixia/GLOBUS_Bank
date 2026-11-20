ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS receipt_template text NOT NULL DEFAULT 'standard';
--> statement-breakpoint
ALTER TABLE public.bank_users
  ADD COLUMN IF NOT EXISTS preferred_receipt_template text NOT NULL DEFAULT 'standard';