# DUTSTAR BANK feature-parity implementation tracker

Status: implementation tracker for the staged migration branch. This is not a production-readiness or live-banking certification.

Source repository: `bgoffixia/GLOBUS_Bank`
Migration branch: `migration/dutstar-cloudflare`
Current verified commit at tracker creation: `4ddbbb97c53c52e4b22be2379f4893b30275a901`
Target: `https://www.bank.dutstar.online`
Legacy production: GLOBUS remains unchanged.

## Verified migration baseline

- Latest branch CI run: passed (run 46052209259).
- Latest DUTSTAR verification run: passed (run 46052209263).
- Typecheck, frontend production build, Worker/static-asset dry-run, and existing CI regression suite passed on the current branch head.
- Worker source implements authenticated, read-only routes: `GET /api/session`, `GET /api/bank/me`, `GET /api/bank/dashboard`, `GET /api/bank/wallets`, and `GET /api/bank/transactions`.
- Other `/api/*` routes deliberately return `503 BANKING_API_NOT_READY`.
- Customer read queries use verified Clerk JWT subject, parameterized SQL, a transaction-local customer context, and the non-login `dutstar_api` database role.
- Live database audit confirms `dutstar_api` is NOLOGIN, NOSUPERUSER, NOBYPASSRLS. Its current grants are read-only and limited to the read-model tables. Seven read policies exist for profile, wallets, transactions, ledger entries, restrictions, sandbox requests, and exchange rates.
- RLS is enabled on all 27 `bank_*` tables. Public API roles still have legacy table grants, but no broad customer policies; RLS therefore remains an important control and must be retested after any policy/grant change.
- The current Worker explicitly reports vault access, deposits, and withdrawals as disabled. The current API is not a real-money banking or settlement system.

## Feature parity matrix

| GLOBUS feature area | DUTSTAR migration state | Required completion work |
|---|---|---|
| Branding, landing page, authentication screens | Partially ported | Complete browser testing on canonical DUTSTAR domain; verify all links, redirects, PWA assets, and mobile layouts |
| Clerk registration, login, session, OTP | Infrastructure configured; Worker JWT validation implemented | End-to-end Clerk sign-in/sign-up, email OTP, recovery, session expiry/revocation, allowed-origin and callback tests |
| Customer profile | Read-only API route implemented | Verify profile field mapping, customer linking, updates, validation, and audit trail |
| Dashboard | Read-only dashboard API implemented | Wire frontend to Worker API and test empty/new/existing accounts, restrictions, tiers, and error states |
| Wallets and balances | Read-only wallet API implemented; balance derived from ledger | Reconcile all currencies and ledger-derived balances against source; verify pending/reserved amounts |
| Transaction history and receipts | Read-only transaction API implemented | Verify filtering, pagination, receipt templates, PDF generation, privacy and historical compatibility |
| Internal transfers | Not ported; source legacy API deliberately disabled | Implement simulation-only transfer workflow with PIN checks, atomic double-entry ledger, idempotency, limits, reversal and audit tests |
| Deposits and withdrawals | Disabled; no verified live settlement | Port simulation request workflow only; live money movement requires separately approved regulated provider, settlement/reconciliation and compliance controls |
| Transaction PIN | Not ported to Worker | Port secure hash/verify, rate limits, lockout, OTP recovery, session invalidation and audit tests |
| Private Vault | Not ported to Worker | Port access entitlements, sessions, passcode verification/reset, encrypted records, expiry, abuse controls and private-file authorization |
| Paystack Vault subscription | Not ported to Worker | Port checkout and webhook signature verification, event idempotency/replay protection, subscription reconciliation and failure handling |
| Customer notifications | Not ported to Worker | Port notification APIs, delivery provider adapters, preferences, retries and deduplication |
| Support conversations/messages | Not ported to Worker | Port customer-scoped read/write routes, attachment controls, staff access and audit trail |
| Personal finance tools | Not ported to Worker | Port feature routes and data ownership controls; validate calculations and export privacy |
| Admin workspace and customer management | Not ported to Worker | Establish DUTSTAR admin identity/roles, least privilege, MFA, dual control for sensitive actions, audit logs and admin-only routes |
| Account restrictions and tier controls | Read-only restriction display only | Port authorized admin workflows, effective dates, expiry, reason codes, notifications and audit logging |
| Identity documents/private storage | Not ported; Replit storage dependency remains in source | Migrate to private R2 with owner-scoped short-lived access, file signature checks, size limits, retention and deletion tests |
| Scheduled jobs | Not ported | Replace process timers with idempotent Cloudflare Cron/Workflows and explicit service authorization |
| Encryption compatibility | Not verified end-to-end | Verify legacy ciphertext decrypts using the exact original key/AAD; establish versioned dual-read/write and tested rollback before data migration |
| Observability and operations | Basic health endpoint only | Add structured redacted logs, metrics, alerts, request IDs, provider reconciliation monitoring and incident/rollback runbooks |

## Delivery sequence

### Phase A — Read-only customer experience
1. Deploy frontend and Worker assets together to a non-production preview.
2. Complete Clerk session and customer-linking tests.
3. Connect the frontend dashboard, profile, wallets and transaction history to the existing read-only API.
4. Test customer A/B isolation, missing profiles, restricted accounts, empty ledgers, currency filters and error handling.
5. Confirm no secrets or personal data appear in browser bundles or logs.

### Phase B — Simulation-only customer workflows
1. Port transaction PIN and OTP recovery.
2. Port internal transfer requests and ledger posting as simulation-only operations.
3. Enforce atomic balanced ledger entries, integer minor-unit arithmetic, idempotency, sufficient funds, limits, reversals and audit records.
4. Port notifications, support and personal finance features.
5. Add contract, integration, concurrency and authorization tests.

### Phase C — Private Vault and administration
1. Port Vault sessions, entitlements, passcode reset and encrypted data handling.
2. Migrate private objects to R2 with strict owner checks.
3. Port Paystack subscription checkout/webhooks with signature verification and replay protection.
4. Port admin routes with explicit DUTSTAR roles, MFA, least privilege, dual-control approvals and immutable audit trails.
5. Test all sensitive actions with dedicated customer/admin accounts.

### Phase D — Release readiness
1. Verify backup and restore, encryption compatibility, data reconciliation and rollback.
2. Run full test suite, security review, browser tests, load/concurrency tests and production-host smoke tests.
3. Verify monitoring, alerts, incident response and support readiness.
4. Perform controlled traffic cutover only after sign-off. Keep GLOBUS production intact through the agreed observation window.

## Non-negotiable safeguards

- Do not merge this draft PR or change production traffic solely because CI passes.
- Do not point the application at D1 as a substitute for its PostgreSQL database.
- Do not modify existing GLOBUS customer records, credentials, encryption keys, DNS, or production services as part of this staged work.
- Do not expose database, Clerk, encryption, email, or payment secrets in source or frontend variables.
- Do not enable live deposits, withdrawals, custody, or interbank settlement based on a simulation ledger or Paystack subscription checkout.
- Do not broaden RLS policies or grant customer write permissions until the exact request-scoped authorization design and negative cross-customer tests pass.
- Do not treat the `app.clerk_user_id` transaction setting as a cryptographic identity proof. It must only be set by the trusted Worker after Clerk JWT verification; never accept it from a client parameter or expose arbitrary SQL execution.
- Preserve the legacy GLOBUS service and provide a tested rollback path until DUTSTAR passes acceptance.

## Current release decision

The latest branch build and verification workflows pass, but the feature-parity work is incomplete. DUTSTAR is a staged read-only customer-data experience, not a complete replacement for GLOBUS and not a live-money banking platform. Production cutover remains blocked until the phases and gates above are completed.
