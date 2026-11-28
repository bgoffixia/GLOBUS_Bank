# DUTSTAR / GLOBUS PostgreSQL RLS design and validation plan

Status: design-only. No SQL in this document has been applied to the production database.

## Audited production facts

Project: `pqarxcnoarfjbyjymepe` (Supabase project `Globus_bank`, PostgreSQL 17, ACTIVE_HEALTHY).

- The public schema contains 27 `bank_*` tables.
- 25 tables have RLS disabled; `bank_transfer_inquiry_links` and `bank_vault_passcode_reset_tokens` already have RLS enabled.
- `pg_policies` returned zero policies for public schema.
- The Supabase inspection reported broad table grants to both `anon` and `authenticated` on the 25 RLS-disabled tables (including SELECT, INSERT, UPDATE and DELETE).
- This is a critical exposure. RLS disabled means those grants are not constrained by policies.
- The application uses Clerk (`@clerk/express`) for identity, and the Drizzle database package uses a direct `pg.Pool` connection via `SUPABASE_DATABASE_URL`. `bank_users.id` is the Clerk user ID (`ensureBankUser(clerkUserId)`).
- The server currently checks admin status in application code using `GLOBUS_ADMIN_CLERK_IDS` and verified primary emails in `GLOBUS_ADMIN_EMAILS`.
- The application is not using Supabase Auth JWTs for its customer identity. Therefore Supabase `auth.uid()` is not a valid mapping for the Clerk identity in the current architecture.

## Immediate containment design (not yet applied)

1. Enable RLS on every public `bank_*` table.
2. Revoke table-level privileges from `anon` and `authenticated` for all bank tables. Keep browser access through the authenticated Clerk API, not Supabase's auto-generated Data API.
3. Keep `service_role` and migration-owner privileges only where operationally required; never put a service-role key or database credential in the browser.
4. Do not add permissive policies for `anon` or `authenticated`. With RLS enabled and no policy, the default is deny.
5. Verify views, RPC functions, sequences and default privileges separately; table RLS alone does not secure every database object.
6. Keep the current backend database connection isolated to the API service. It may currently connect with a privileged database role that bypasses RLS; confirm the actual role before claiming RLS protects API queries.

This containment blocks direct browser/Data API access without disrupting the existing server API, provided the app's database role is not one of the revoked roles. It is not a substitute for hardening the server's database role.

## Application-level RLS design (second phase)

Clerk IDs are text identifiers, while Supabase Auth helpers expect Supabase Auth JWT claims. Do not write policies using `auth.uid() = bank_users.id` unless the identity integration is deliberately changed and verified.

For genuine per-row RLS behind the Clerk API, introduce a dedicated non-owner, `NOBYPASSRLS` database role and request-scoped transactions. After verifying the Clerk session and resolving the Clerk user ID, the API must set transaction-local context inside the same transaction that executes the protected query:

```sql
SELECT set_config('app.current_user_id', $1, true);
SELECT set_config('app.is_admin', $2, true);
```

The values must be set from verified server-side Clerk identity and the existing allowlist check, never from request body, query parameters, or browser headers. Use `SET LOCAL` / transaction-local `set_config(..., true)` so pooled connections cannot leak one user's identity into another request. The application must fail closed if the context is absent. A custom GUC is not a substitute for protecting the database credentials; only the trusted API service may hold this role's credentials.

Before enabling this second phase, refactor the current global Drizzle `db` usage to guarantee that every protected query runs through the same request-scoped transaction/context. Background jobs and webhooks need explicit system-job contexts and separate least-privilege handling. The current code's global pool and background sweeps mean this prerequisite is not yet satisfied.

## Table policy matrix

| Table group | Rows/operations | Intended rule |
|---|---|---|
| `bank_users` | customer profile | Customer can read only own profile; sensitive columns (PIN/passcode hashes, lockout counters, payment identifiers, admin flags, internal restriction fields) remain API-only/column-restricted. Customer updates go through validated API, not direct SQL writes. |
| `bank_wallets` | wallets | Customer can read own wallets; all balance-affecting changes remain API/ledger-only. |
| `bank_transactions` | transactions | Customer read if `from_user_id`, `to_user_id`, or `initiated_by_user_id` is current user; mutations are server-only. |
| `bank_ledger_entries` | ledger | Customer read only when linked transaction belongs to them; writes server-only. |
| `bank_notifications` | notifications | Owner-only read/update of read state; creation server-only. |
| `bank_saved_payment_methods` | saved payment methods | Owner-only access via curated API; encrypted account data never directly exposed. |
| `bank_sandbox_requests` | deposit/withdrawal/exchange requests | Owner-only read; writes and status changes server-only. |
| `bank_identity_documents` | identity metadata | Owner-only metadata through API; private object bytes via signed, short-lived storage access; admin review through admin API. |
| `bank_personal_finance_records`, `bank_financial_accounts`, `bank_finance_loan_applications` | personal finance | Owner-only CRUD subject to field validation; never expose cross-customer rows. |
| `bank_support_conversations`, `bank_support_messages` | support | Customer sees own conversations/messages; allowlisted admin sees support queue; sender identity/role must be validated by API. |
| `bank_push_subscriptions` | push subscriptions | Owner-only; encrypted subscription payloads remain API-only. |
| `bank_vault_transaction_notes` | private notes | Owner-only; note writes through API. |
| `bank_restrictions` | restrictions | Customer can see only safe restriction status; internal notes and staff metadata are API-only/admin-only. Prefer curated view/API rather than direct table access. |
| `bank_international_transfer_requests` | international transfer metadata | Owner-only safe fields; encrypted recipient email and routing/account details remain API-only. |
| `bank_vault_sessions`, `bank_vault_passcode_reset_tokens`, `bank_transfer_inquiry_links` | sessions and bearer/reset tokens | No direct browser table access. API-only, strict expiry/hash validation and one-time use. |
| `bank_vault_paystack_events` | provider webhook events | No direct browser access; webhook/API-only. |
| `bank_vault_paystack_plans`, `bank_account_tiers`, `bank_exchange_rates` | reference/configuration | Public display only through curated read endpoints; mutations admin/server-only. |
| `bank_admin_settings`, `bank_audit_logs`, `bank_vault_admin_entitlements` | operations/admin | Admin-only through verified allowlist API; no browser direct access. |

Important: RLS filters rows, not individual columns. Tables containing secret hashes, internal notes, encrypted payloads, admin settings, or payment metadata should stay API-only unless column privileges or safe `security_invoker` views are designed and tested.

## Validation plan (staging only)

### Static/database checks
- Confirm every public bank table has RLS enabled.
- Confirm no permissive policies exist for `anon`.
- Confirm `anon` and `authenticated` have no table privileges on API-only tables.
- Confirm only the intended API role has DML grants.
- Confirm API role is not superuser, table owner, or `BYPASSRLS`.
- Inspect views, functions/RPCs, sequences, triggers, and default privileges.

### Positive/negative authorization cases
1. No Clerk identity / no DB context: all customer rows denied.
2. Customer A reads own user, wallet, notifications, support and finance rows: allowed only for intended safe columns.
3. Customer A attempts to read Customer B rows: denied.
4. Customer A attempts to insert/update rows with Customer B's `user_id`: denied.
5. Customer A attempts to change `bank_users.id`, role/admin flags, account status, PIN hashes, balances or ledger rows: denied.
6. Customer A reads a transaction where they are sender or recipient: allowed; unrelated transaction: denied.
7. Customer A reads ledger entries only through their own transaction: allowed; unrelated ledger entries: denied.
8. Non-admin attempts admin settings, audit logs, restrictions' internal notes, vault entitlements and provider events: denied.
9. Allowlisted admin has the required admin-only access; a non-allowlisted user with a similar email or unverified email is denied.
10. Expired/revoked reset tokens, vault sessions and transfer inquiry links are rejected even when the owner ID matches.
11. Two concurrent requests for different users on pooled connections do not share transaction-local context.
12. Webhook and scheduled jobs use separate system contexts and cannot impersonate a customer.

### Cutover gate
Run the tests on an isolated staging database/branch with the same schema and role grants. Do not run a blanket RLS migration against production until the API role, all code paths, scheduled jobs, webhooks, and all positive/negative tests pass. Take a verified backup and have a rollback plan before production deployment.

## Current outcome

- This plan is based on read-only metadata inspection and source review.
- No production DDL, policies, grants, customer data, or secrets were changed.
- A staging branch/test database was not created; no policy behavior is claimed as runtime-tested yet.
