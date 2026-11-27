# DUTSTAR Cloudflare Worker

This directory contains the Cloudflare-native edge entrypoint for the DUTSTAR application.

## Safety state

- Static assets are served through the ASSETS binding when a production build exists.
- `/health` reports whether required infrastructure bindings exist.
- All `/api/*` routes intentionally return 503 until the existing Express banking routes are ported and security-tested.
- No database writes, customer data access, or financial operations are enabled by this scaffold.

## Required before enabling banking API

1. Create a Cloudflare Hyperdrive configuration using the existing Supabase PostgreSQL connection string. Keep the connection string private; never commit it.
2. Set the Hyperdrive ID in `wrangler.jsonc`.
3. Configure the production Clerk JWKS URL from the actual production Clerk instance; do not guess or replace the existing Clerk keys.
4. Port the existing Express route handlers and background jobs to Worker-compatible modules. Preserve ledger transactions, idempotency, authorization checks, audit logging, and existing encryption compatibility.
5. Add request-scoped authorization and secure database access. The existing database currently has tables without RLS policies, so it must not be exposed through the browser or an untrusted API.
6. Build, run unit/integration tests, upload assets, deploy to a preview, and verify before production activation.

Do not enable financial endpoints until these requirements are complete.
