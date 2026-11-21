ALTER TABLE public.bank_wallets
  ALTER COLUMN transfers_enabled SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE public.bank_wallets
  ALTER COLUMN future_transfer_mode SET DEFAULT 'successful';
