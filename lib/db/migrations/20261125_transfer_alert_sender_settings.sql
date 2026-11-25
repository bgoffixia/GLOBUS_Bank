ALTER TABLE bank_admin_settings
  ADD COLUMN IF NOT EXISTS transfer_alert_email_from text NOT NULL
  DEFAULT 'transfer-comfirmation@globus.website';

UPDATE bank_admin_settings
SET customer_email_sender_display_name = 'Incoming Transfer',
    transfer_alert_email_from = COALESCE(
      NULLIF(transfer_alert_email_from, ''),
      'transfer-comfirmation@globus.website'
    )
WHERE id = 'operations';
