# DUTSTAR API recovery inventory

Status: source recovery completed; Cloudflare port is still in progress.
Branch: `migration/dutstar-cloudflare`
Source repository: `bgoffixia/GLOBUS_Bank`

## Key finding

The original API source is present in the migration branch. A separate live runtime is not required to recover its route definitions or business logic. The source is in `artifacts/api-server/src`, with route composition in `routes/index.ts`, Express middleware in `app.ts`, and database/business logic in `lib/`. The existing Worker is in `workers/dutstar-bank-api/src/index.ts`.

The API is not yet fully ported. The Worker currently has Clerk JWT verification and read-only customer endpoints; unported `/api/*` operations intentionally return `503 BANKING_API_NOT_READY`.

## Recovered route inventory

The five source route modules contain 121 registered route declarations:

- `routes/bank.ts`: 63 routes
- `routes/bankAdmin.ts`: 45 routes
- `routes/bankFinanceWorkspace.ts`: 7 routes
- `routes/bankPersonalFinance.ts`: 5 routes
- `routes/health.ts`: 1 route

### Customer, wallet, transfer, vault, support and notification API

Source: `artifacts/api-server/src/routes/bank.ts`

```text
POST /bank/customer-id/lookup
POST /bank/vault/passcode-reset/complete
POST /bank/vault/passcode-reset/complete-otp
POST /bank/vault/passcode-reset/request-by-email
GET /bank/transfer-inquiries/:token
POST /bank/transfer-inquiries/:token/messages
POST /bank/vault/passcode-reset/request
GET /bank/support/conversations
POST /bank/support/conversations
GET /bank/support/conversations/:conversationId/messages
POST /bank/support/conversations/:conversationId/messages
POST /bank/support/conversations/:conversationId/read
GET /bank/vault/session
POST /bank/vault/session/lock
POST /bank/vault/subscription/clear-incomplete
POST /bank/me/password-reset/complete
GET /bank/me
PUT /bank/signup-profile
GET /bank/receipt-preferences
PATCH /bank/receipt-preferences
GET /bank/dashboard
GET /bank/wallets
GET /bank/saved-payment-methods
POST /bank/saved-payment-methods
DELETE /bank/saved-payment-methods/:paymentMethodId
GET /bank/transactions
PUT /bank/profile
PUT /bank/transaction-pin
POST /bank/transfers
GET /bank/exchange-rates/quote
GET /bank/exchange-rates
GET /bank/international-transfer-requests
POST /bank/international-transfer-requests
POST /bank/external-transfers
POST /bank/incoming-external-transfers
POST /bank/ledger-requests
GET /bank/vault/status
GET /bank/vault/billing
GET /bank/vault/transfer-email-alert
POST /bank/vault/paystack/initialize
POST /bank/vault/paystack/verify
POST /bank/vault/paystack/manage-renewal
POST /bank/vault/paystack/webhook
POST /bank/vault/status
POST /bank/vault/unlock
PATCH /bank/vault/passcode
GET /bank/vault/email-preferences
PATCH /bank/vault/email-preferences
GET /bank/vault/receipt-preference
PATCH /bank/vault/receipt-preference
GET /bank/vault/transaction-notes
PUT /bank/vault/transaction-notes/:transactionId
DELETE /bank/vault/transaction-notes/:transactionId
GET /bank/vault/wallet-controls
PATCH /bank/vault/wallet-controls/:walletId
GET /bank/notifications
DELETE /bank/notifications
PATCH /bank/notifications/:notificationId/read
GET /bank/push/config
GET /bank/push/preferences
PATCH /bank/push/preferences
PUT /bank/push/subscriptions
DELETE /bank/push/subscriptions/:subscriptionId
```

### Admin API

Source: `artifacts/api-server/src/routes/bankAdmin.ts`

```text
GET /bank/admin/access
POST /bank/admin/test-transaction-alert-email
PUT /bank/admin/exchange-rates
GET /bank/admin/summary
GET /bank/admin/accounts
GET /bank/admin/wallet-currency-migration
POST /bank/admin/wallet-currency-migration
PATCH /bank/admin/wallets/:walletId
GET /bank/admin/audit-logs
GET /bank/admin/settings
PUT /bank/admin/settings
GET /bank/admin/restrictions
POST /bank/admin/restrictions
POST /bank/admin/restrictions/:restrictionId/remove
GET /bank/admin/users
GET /bank/admin/vault-access
POST /bank/admin/users/:userId/vault-access/grant
POST /bank/admin/users/:userId/vault-access/revoke
GET /bank/admin/users/:userId
POST /bank/admin/users/:userId/transaction-pin/reset
POST /bank/admin/users/:userId/vault-passcode-reset
POST /bank/admin/users/:userId/password-reset
PATCH /bank/admin/users/:userId/status
PATCH /bank/admin/users/:userId/profile
PATCH /bank/admin/users/:userId/account-tier
PATCH /bank/admin/users/:userId/access-controls
PATCH /bank/admin/users/:userId/vault-subscription
GET /bank/admin/users/:userId/vault-subscription/proof
POST /bank/admin/users/:userId/funding
POST /bank/admin/transactions/:transactionId/funding-review
GET /bank/admin/ledger-requests
PATCH /bank/admin/ledger-requests/:requestId
GET /bank/admin/transactions
GET /bank/admin/transactions/:transactionId
POST /bank/admin/transactions/:transactionId
GET /bank/admin/ledger
GET /bank/admin/transactions/:transactionId/status-history
POST /bank/admin/transactions/:transactionId/process
PATCH /bank/admin/transactions/:transactionId
PATCH /bank/admin/transactions/:transactionId/date
GET /bank/admin/support/conversations
GET /bank/admin/support/conversations/:conversationId/messages
POST /bank/admin/support/conversations/:conversationId/messages
POST /bank/admin/support/conversations/:conversationId/read
POST /bank/admin/users/:userId/delete
```

### Personal finance API

Source: `artifacts/api-server/src/routes/bankFinanceWorkspace.ts` and `bankPersonalFinance.ts`

```text
GET /bank/personal-finance/report
GET /bank/personal-finance/accounts
POST /bank/personal-finance/accounts
PATCH /bank/personal-finance/accounts/:accountId
GET /bank/personal-finance/loan-applications
POST /bank/personal-finance/loan-applications
PATCH /bank/personal-finance/loan-applications/:applicationId
GET /bank/personal-finance/records
POST /bank/personal-finance/records
PATCH /bank/personal-finance/records/:recordId
DELETE /bank/personal-finance/records/:recordId
GET /bank/personal-finance/overview
```

### Health API

Source: `artifacts/api-server/src/routes/health.ts`

```text
GET /healthz
```

## Porting order and safety gates

1. **Runtime foundation:** replace Express-only request/response and middleware assumptions with Worker-compatible routing, strict same-origin CORS, Clerk JWT validation, request validation, rate limits, redacted structured logs and consistent errors.
2. **Read-only customer parity:** compare the existing profile, dashboard, wallets, transaction, exchange-rate and receipt-preference handlers against the current Worker read endpoints. Keep customer scoping and least-privilege database role.
3. **Customer settings and support:** profile/signup, PIN, receipts, notifications, push preferences and customer-scoped support.
4. **Simulation ledger operations:** transfer, incoming/external labels, ledger requests and admin funding only as simulation ledger records. Require atomic double-entry posting, idempotency, limits, restrictions, audit entries and concurrency tests.
5. **Vault and provider workflows:** port vault access/passcode/reset, subscription state, Paystack checkout/webhooks and private-file authorization with replay protection and exact encryption compatibility. Keep secrets server-side.
6. **Admin and personal finance:** port admin authorization and every admin endpoint with least privilege, MFA/allowlist controls and audit logging; then personal finance routes and data ownership controls.
7. **Storage and scheduled work:** replace Replit object storage with private R2 and process timers with idempotent Cron/Workflows.

Do not expose a route as ready until its original behavior, authorization, schema validation, database transaction behavior and error contract have been checked. Do not broaden database grants or RLS policies as a shortcut. Keep the production hostname disconnected until preview tests pass. Preserve GLOBUS production unchanged. The product remains simulation-only; no real-money movement or settlement is enabled by this migration.
