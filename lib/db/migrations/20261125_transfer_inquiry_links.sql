CREATE TABLE IF NOT EXISTS bank_transfer_inquiry_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  conversation_id uuid NOT NULL REFERENCES bank_support_conversations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES bank_users(id) ON DELETE CASCADE,
  transfer_reference text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_transfer_inquiry_owner_transfer_idx
  ON bank_transfer_inquiry_links (user_id, transfer_reference);
CREATE INDEX IF NOT EXISTS bank_transfer_inquiry_expiry_idx
  ON bank_transfer_inquiry_links (expires_at);
