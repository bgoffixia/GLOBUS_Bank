# DUTSTAR BANK Cloudflare Migration

Status: audit and staged migration branch. This document does not represent a completed production migration.

## Source baseline

- Source repository: `bgoffixia/GLOBUS_Bank`
- Baseline branch: `main`
- Baseline commit: `7d8ddc8cbe466a4ca6f5c592d54aaeab9befef46`
- Migration branch: `migration/dutstar-cloudflare`
- Target Worker: `dutstar-bank-api`
- Target D1 database: `dutstar-bank-production`

## Verified source architecture

The checked-in deployment guide describes a Vercel multi-service application: an Express API under `artifacts/api-server` and a Vite frontend under `artifacts/globus-bank`. The API uses Clerk and a Drizzle/PostgreSQL data layer. The database package connects through `SUPABASE_DATABASE_URL`; the Drizzle migration config also expects that variable. The root deployment guide separately lists `DATABASE_URL`, so environment-variable naming must be reconciled against the active production deployment before migration.

Replit-specific items found:
- Root `.replit` and `.replitignore` configuration, plus `replit.md` and per-artifact `.replit-artifact` metadata.
- `@replit/connectors-sdk` in root and API dependencies.
- Replit Vite development plugins in the frontend package.
- Private object storage implemented through a Replit sidecar at `127.0.0.1:1106`, using Replit external-account credentials and `PRIVATE_OBJECT_DIR`.
- Clerk proxy comments and host handling mention Replit deployment hostnames.

Other current dependencies that are not Replit:
- Vercel multi-service routing/build configuration.
- Clerk authentication.
- PostgreSQL + Drizzle.
- Google Cloud Storage SDK, currently used as a client for Replit's private object store.
- Existing external provider integrations (including Paystack and email delivery).

## Target architecture decision

1. Cloudflare Workers is the application runtime and public edge/API entrypoint.
2. Cloudflare Workers Static Assets serves the Vite frontend (or a separately deployed static frontend Worker if build separation requires it).
3. Cloudflare Hyperdrive is the preferred first-stage database bridge to the existing PostgreSQL provider. This preserves PostgreSQL semantics, Drizzle's PostgreSQL schema, and existing production data while the runtime is moved. Do not point this PostgreSQL application at D1 as if it were PostgreSQL.
4. Cloudflare R2 replaces Replit Private App Storage for private identity-document and subscription-proof objects. Preserve private access, short-lived upload URLs, owner scoping, content-signature validation, size limits, retention and deletion behavior.
5. Clerk remains the identity provider initially. Reconfigure allowed domains, redirect URLs, frontend API proxy behavior, and server verification for DUTSTAR's canonical domain.
6. Existing payment, email, and notification providers remain external integrations until individually tested. Secrets are configured as Worker secrets/Secrets Store bindings, never committed.
7. Scheduled expiration and reminder jobs move from in-process `setInterval` calls to authenticated Cloudflare Cron Triggers or Workflows. They must be idempotent and safe under retries.

D1 is currently provisioned but empty. It is not the first-stage production database for this migration. A later PostgreSQL-to-D1 migration would require an explicit schema/data conversion, query-layer rewrite, transaction/concurrency review, and reconciliation tests; it must not be assumed safe for this ledger application.

## Mandatory migration gates

- Export and verify backups of PostgreSQL data and private object storage before any cutover.
- Preserve the exact existing bank-details encryption key and verify decryption of existing encrypted records before moving traffic. Never generate a replacement key for existing ciphertext.
- Verify Clerk sign-in, session handling, admin allowlists and OTP/reset flows on DUTSTAR domains.
- Port and test the API runtime without relying on Node server sockets or Replit sidecars.
- Preserve double-entry ledger invariants, integer minor-unit arithmetic, transaction idempotency, authorization, rate limits, audit logging, and webhook signature verification.
- Test upload/download authorization and document retention on R2.
- Run all unit/integration tests, migration checks, security checks and smoke tests against a non-production environment first.
- Use a reversible traffic cutover. Keep the existing GLOBUS/Vercel deployment and source data intact until DUTSTAR passes the agreed verification window.

## Product scope and safety

The repository's deployment documentation states that the product is simulation-only: balances and transfers are fictional and do not move real money. This migration does not authorize real-money banking or payment services. Any future real-money capability requires separate regulatory, partner, KYC/AML, reconciliation, operational and security approvals.

## Current status

- Cloudflare D1 `dutstar-bank-production` exists and is empty.
- Cloudflare Worker `dutstar-bank-api` exists as a health/scaffold endpoint; it is not the migrated application.
- No customer records, production schema, encryption key, authentication flow, payment integration or private documents have been migrated.
- No Replit resource or existing production service has been deleted.
- This branch records the verified architecture and migration gates. Implementation must proceed in isolated, tested increments.
