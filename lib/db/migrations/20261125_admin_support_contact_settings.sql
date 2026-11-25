ALTER TABLE bank_admin_settings
  ADD COLUMN IF NOT EXISTS default_support_url text,
  ADD COLUMN IF NOT EXISTS support_email text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bank_admin_settings_support_url_https_check'
  ) THEN
    ALTER TABLE bank_admin_settings
      ADD CONSTRAINT bank_admin_settings_support_url_https_check
      CHECK (default_support_url IS NULL OR default_support_url ~ '^https://');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bank_admin_settings_support_email_check'
  ) THEN
    ALTER TABLE bank_admin_settings
      ADD CONSTRAINT bank_admin_settings_support_email_check
      CHECK (support_email IS NULL OR support_email ~ '^[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+$');
  END IF;
END $$;
