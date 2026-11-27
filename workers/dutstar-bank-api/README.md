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

## Database access controls

The Worker uses Hyperdrive and opens a transaction per authenticated customer read. It switches to the non-login, non-superuser, non-BYPASSRLS role `dutstar_api`, then sets the transaction-local `app.clerk_user_id` from the verified Clerk JWT subject. RLS policies scope reads to the matching bank user, owned wallets, participant transactions, wallet ledger entries, and customer restrictions/requests.

The role currently has SELECT-only grants for the read-model tables. No INSERT, UPDATE, DELETE, ledger posting, payment provider, transfer, vault passcode, or administrative operation is enabled in this Worker. The customer profile response fails closed for deposit/withdrawal eligibility and vault access until those controls are ported and verified.

## Production safety

- Existing Supabase customer records are preserved.
- No balance, ledger, transaction, or customer data was modified by this API setup.
- No customer write endpoint is enabled.
- Do not deploy this Worker to the production hostname until its static assets are built and attached in the same deployment, Clerk session verification is tested end-to-end, and remaining API modules are ported.
- Keep Hyperdrive connection details and Clerk secrets out of source control.
