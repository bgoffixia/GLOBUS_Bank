CREATE TABLE IF NOT EXISTS "bank_vault_passcode_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "bank_users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "requested_by_user_id" text NOT NULL REFERENCES "bank_users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "bank_vault_passcode_reset_user_created_idx"
  ON "bank_vault_passcode_reset_tokens" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "bank_vault_passcode_reset_expiry_idx"
  ON "bank_vault_passcode_reset_tokens" ("expires_at");