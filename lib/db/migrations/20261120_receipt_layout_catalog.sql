ALTER TABLE public.bank_users
  DROP CONSTRAINT IF EXISTS bank_users_preferred_receipt_template_check;
--> statement-breakpoint
ALTER TABLE public.bank_users
  ADD CONSTRAINT bank_users_preferred_receipt_template_check
  CHECK (preferred_receipt_template IN (
    'standard',
    'bank_payment',
    'transfer_journey',
    'transfer_ledger',
    'settlement_statement',
    'editorial_ledger',
    'transfer_ledger_columnar',
    'settlement_ledger',
    'reconciliation_statement',
    'settlement_timeline',
    'archival_statement'
  ));
