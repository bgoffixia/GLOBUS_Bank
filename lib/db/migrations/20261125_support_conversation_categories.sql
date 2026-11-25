ALTER TABLE bank_support_conversations
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS transfer_reference text;

ALTER TABLE bank_support_conversations
  ADD CONSTRAINT bank_support_conversation_category_check
  CHECK (category IN ('general', 'private_vault', 'transfer'));

ALTER TABLE bank_support_conversations
  ADD CONSTRAINT bank_support_conversation_transfer_reference_check
  CHECK (category = 'transfer' OR transfer_reference IS NULL);

CREATE INDEX IF NOT EXISTS bank_support_conversation_category_queue_idx
  ON bank_support_conversations (category, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS bank_support_conversation_transfer_reference_idx
  ON bank_support_conversations (transfer_reference)
  WHERE transfer_reference IS NOT NULL;
