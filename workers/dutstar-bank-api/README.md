# DUTSTAR Cloudflare Worker

This directory contains the Cloudflare-native edge entrypoint for the DUTSTAR application.

## Current API surface

- `GET /health` and `GET /api/healthz`: infrastructure readiness probe.
- `GET /api/session`: verifies the Clerk JWT signature and core claims.
- `GET /api/bank/me`: read-only customer profile.
- `GET /api/bank/dashboard`: read-only profile, wallet balances, and recent transactions.
- `GET /api/bank/wallets`: read-only customer wallets and ledger-derived balances.
- `GET /api/bank/transactions`: read-only transaction history with bounded filters.
- Other `/api/*` endpoints return 503 until their handlers and safeguards are ported.

## Cloudflare bindings

The checked-in `wrangler.jsonc` is the source of truth for both Worker environments:

- `DB`: existing Supabase PostgreSQL connection through Hyperdrive config `dutstar-bank-db` (`3fbe4aa6fa17456aa0eb2a33a6774534`).
- `PRIVATE_FILES`: existing R2 bucket `dutstar-bank-private`.
- `ASSETS`: frontend build output at `artifacts/globus-bank/dist/public`.
- Clerk issuer and JWKS URL are environment variables in the config.

The preview deployment workflow derives its isolated Worker configuration from this file, so the preview receives the same Hyperdrive, R2, and frontend asset bindings. It must not silently deploy without the DB or assets binding.

## Required runtime secrets

Set these as Cloudflare Worker secrets separately in each environment when those integrations are enabled:

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `DUTSTAR_BANK_DETAILS_ENCRYPTION_KEY_V1` (the existing key; do not rotate or replace it during migration).

Secrets are not written to Git. The preview Worker currently has Paystack and Resend secrets; production did not expose those bindings during the last audit. Copy the existing approved values through Cloudflare's secret-management UI/API without printing them in logs or source control. Never create replacement encryption keys for existing encrypted customer data.

## Database access controls

The Worker uses Hyperdrive and opens a transaction per authenticated customer read. It switches to the non-login, non-superuser, non-BYPASSRLS role `dutstar_api`, then sets the transaction-local `app.clerk_user_id` from the verified Clerk JWT subject. RLS policies scope reads to the matching bank user, owned wallets, participant transactions, wallet ledger entries, and customer restrictions/requests.

The role currently has SELECT-only grants for the read-model tables. No INSERT, UPDATE, DELETE, ledger posting, payment provider, transfer, vault passcode, or administrative operation is enabled in this Worker. The customer profile response fails closed for deposit/withdrawal eligibility and vault access until those controls are ported and verified.

## Production safety

- Existing Supabase customer records and Clerk identities are preserved.
- No balance, ledger, transaction, or customer data is modified by this API setup.
- No customer write endpoint is enabled.
- Do not deploy this Worker to the production hostname until remaining API modules, secret bindings, encryption compatibility, authorization, and feature parity are complete.
- Keep Hyperdrive credentials and all runtime secrets out of source control.
