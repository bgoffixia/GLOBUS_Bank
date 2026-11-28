-- Restrict Private Vault recovery-code access to the authenticated customer scope.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bank_vault_passcode_reset_tokens TO dutstar_api;
DROP POLICY IF EXISTS dutstar_vault_passcode_reset_owner ON public.bank_vault_passcode_reset_tokens;
CREATE POLICY dutstar_vault_passcode_reset_owner
ON public.bank_vault_passcode_reset_tokens
FOR ALL
TO dutstar_api
USING (user_id = NULLIF(current_setting('app.clerk_user_id', true), ''))
WITH CHECK (user_id = NULLIF(current_setting('app.clerk_user_id', true), ''));