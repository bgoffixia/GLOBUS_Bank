ALTER TABLE bank_admin_settings
  ADD COLUMN IF NOT EXISTS default_support_url text,
  ADD COLUMN IF NOT EXISTS support_email text;

ALTER TABLE bank_admin_settings
  ADD CONSTRAINT bank_admin_settings_support_url_https_check
  CHECK (default_support_url IS NULL OR default_support_url ~ '^https://');

ALTER TABLE bank_admin_settings
  ADD CONSTRAINT bank_admin_settings_support_email_check
  CHECK (support_email IS NULL OR support_email ~ '^[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+$');
