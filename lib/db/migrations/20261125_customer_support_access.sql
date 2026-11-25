ALTER TABLE bank_users
  ADD COLUMN IF NOT EXISTS support_access_granted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS bank_users_support_access_idx
  ON bank_users (support_access_granted)
  WHERE support_access_granted = true;
