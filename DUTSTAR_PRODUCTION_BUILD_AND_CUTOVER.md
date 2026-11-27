# DUTSTAR BANK production build and cutover runbook

Status: staged implementation plan; NOT production-ready and NOT a completed migration.

Canonical target: https://www.bank.dutstar.online
Cloudflare Worker scaffold: dutstar-bank-api
Existing source: Vercel multi-service app (Express API + Vite SPA)
Database: existing Supabase PostgreSQL (project ref pqarxcnoarfjbyjymepe)
Identity: Clerk
Private files: migrate Replit private object storage to Cloudflare R2
Old GLOBUS production: keep unchanged.

## Verified blockers

- The Cloudflare Worker currently contains only a health/scaffold response. It has no application routes, authentication middleware, database binding, R2 binding, or static frontend assets.
- The source API is a Node/Express 5 server using Node APIs, a global pg.Pool/Drizzle connection, Clerk Express middleware, Replit connector SDK, and a Replit object-storage sidecar. It cannot be deployed as a Worker by simply uploading the current Express entrypoint.
- The Vite app build currently imports Replit development plugins and requires PORT/BASE_PATH at build time. It must be built in production mode and its runtime API origin, Clerk publishable key, allowed origins and callback URLs must be configured.
- The application uses Supabase PostgreSQL. D1 is empty and is not a drop-in PostgreSQL replacement.
- The DUTSTAR AES-256 key exists in Cloudflare Secrets Store as DUTSTAR_BANK_DETAILS_ENCRYPTION_KEY_V1, but its status is pending and it is not bound to the Worker or consumed by application code.
- No verified production frontend deployment artifact or Worker static-assets bundle is present.
- DNS for www.bank.dutstar.online must remain absent until the frontend and API are deployed and smoke-tested.

## Required build work

1. Extract the API route/middleware inventory and classify each dependency as Worker-compatible, requiring a compatibility adapter, or requiring a separate Node runtime. Do not silently omit a route.
2. Build a Worker-native API entrypoint with Clerk JWT/session verification, strict CORS for the DUTSTAR origin, rate limiting, structured audit logging, request validation, and explicit error handling.
3. Configure Hyperdrive to the existing Supabase PostgreSQL connection. Store the database URL in an encrypted Cloudflare secret and bind Hyperdrive to the Worker. Do not copy database credentials into source, frontend variables, or logs.
4. Refactor Drizzle access to request-scoped transactions and a least-privilege PostgreSQL role. Preserve current schema and transaction invariants. No production RLS/grant changes until staging tests pass.
5. Port private object storage to R2. Preserve owner checks, short-lived access, content-signature validation, file-size limits, retention, and deletion behavior. Never expose the bucket publicly.
6. Add a versioned encryption provider. New DUTSTAR records use key version v1; existing GLOBUS ciphertext continues to use the exact legacy key and original AAD purpose. Do not attempt bulk re-encryption until decrypt/reencrypt round-trip tests pass and a verified backup exists. Key rotation must support dual-read during migration.
7. Port background expiration/reminder jobs to Cron Triggers or Workflows with idempotency and explicit system-job authorization.
8. Build the Vite SPA with NODE_ENV=production, PORT set for build compatibility, BASE_PATH=/, and no Replit development plugins. Serve it via Workers Static Assets or a separately verified static deployment.
9. Configure Clerk allowed origins, sign-in/sign-up URLs, callback URLs, session verification and admin allowlists for the DUTSTAR hostname. Never accept admin identity from request payloads.
10. Run unit/typecheck/build, API contract tests, auth tests, receipt export tests, vault PIN/OTP tests, database integration tests, encryption compatibility tests, R2 authorization tests, and production-host smoke tests.

## Environment configuration inventory

Configure only through encrypted secrets or bindings:

- SUPABASE_DATABASE_URL (secret; only if Hyperdrive cannot be used directly)
- Clerk server secret and verified Clerk issuer/domain configuration
- DUTSTAR_BANK_DETAILS_ENCRYPTION_KEY_V1 (Secrets Store secret; status must become active and Worker binding verified)
- legacy encryption key under a separately named legacy version only after secure controlled transfer and exact compatibility verification
- payment-provider secrets and webhook verification secrets, only after provider endpoint allowlisting and signature tests
- email-provider credentials
- R2 bucket binding and any required scoped access credentials

Never put server secrets in VITE_ variables or commit them.

## DNS and cutover gate

Do not create the www CNAME/Worker route until:
- static frontend deployment exists and returns the expected DUTSTAR app;
- API health and all required routes are deployed;
- Clerk login/session tests pass on the canonical hostname;
- PostgreSQL read/write integration tests pass against a staging clone;
- encryption tests prove old ciphertext decrypts with the legacy version and new ciphertext decrypts with v1;
- private object authorization tests pass;
- receipts, vault access, PIN reset OTP, and admin controls pass;
- rollback and monitoring are ready.

After passing the gate, attach the hostname to the actual frontend Worker/static service and create only the DNS records required by that attachment. Verify TLS, redirects, API routing, CSP, CORS and health checks. Keep GLOBUS/Vercel untouched until the DUTSTAR verification window is complete.

## Current deployment decision

No public DNS record has been created. No production database schema, grants, customer data, legacy encryption key, Clerk settings, or GLOBUS services have been modified. The current Cloudflare Worker remains a scaffold and must not be represented as the migrated banking application.

## Product scope

The existing source documentation describes the product as simulation-only. This migration does not authorize real-money banking, deposits, transfers, or payment custody. Any real-money service requires separate regulatory, partner, AML/KYC, operational and security approvals.
