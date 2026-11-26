# Dutstar Bank 🏦

Globus Bank is a simulation-only multi-currency wallet experience. It is software for exploring account and ledger workflows—not a licensed bank, custodian, payment institution, or source of real financial balances.

## Current capabilities

- Clerk email sign-in and sign-up, with a server-side Globus profile.
- USD, EUR, GBP, NGN, CAD and AUD wallets backed by a double-entry ledger.
- Simulated starting value and member-to-member or external-recipient transfers.
- Admin-only simulated wallet funding with a recorded reason and audit entry.
- Printable simulation receipts for completed transfers, available again from activity history.
- Transaction search, user profile settings, and recorded provider-setup requests.
- Server-authorized operations summary, account status actions, and ledger review.
- Public about, help, fees, privacy, terms and contact pages.

Member, incoming and external-recipient transfers and admin funding update fictional ledger records only. External party names and countries are labels; no bank details are collected, and no outside account is credited. Receipts are internal ledger records, not proof of outside payment. Vault wallet funding creates a balanced internal Globus ledger credit after server-side Vault-access, account, wallet, restriction, amount, and transaction-PIN checks; the customer may add a description that appears in transaction history. It does not receive, hold, or move outside funds. Withdrawals and currency exchanges are not connected to a provider and remain internal request records.

## Run and configure

The managed `artifacts/globus-bank: web` and `artifacts/api-server: API Server` workflows run the app and API. The app uses Supabase PostgreSQL through `SUPABASE_DATABASE_URL`; configure it separately in Replit development Secrets and Production app secrets.

```sh
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run generate
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/globus-bank run typecheck
```

The post-merge setup applies checked-in migrations to the development database. Production migrations are manual: set `SUPABASE_DATABASE_URL` to the production Supabase connection string in a trusted shell and run `pnpm --filter @workspace/db run migrate` before publishing code that needs the new schema. Do not run migrations from app startup or deployment build steps.

The app uses your external Clerk application. Configure `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` separately in Replit's development Secrets and Publishing → Production app secrets. Use the external app's development keys in development and its production keys in production. Do not copy values into source files, chat or `.env.example`; configure the app's allowed domains and redirect URLs in Clerk.

### Simulation behavior

Each new account receives a one-time USD 2,500.00 simulated ledger credit. It is fictional and has no cash value. The credit and simulated transfers use balanced ledger entries and idempotency keys.

Simulated transfers are available in the published app and only alter fictional ledger entries. The app has no live financial provider adapter, and no simulated transaction contacts or credits an external account. Provider request records remain pending and never post to a real payment network.

### Administrator access

Set `GLOBUS_ADMIN_CLERK_IDS` and/or `GLOBUS_ADMIN_EMAILS` in the API server environment. Email entries are matched only against the signed-in Clerk user's verified primary email; never trust an email supplied by the browser. Leave both unset to keep the operations API unavailable. The current build has one allowlisted administrator role; privileged MFA and additional roles still need to be configured and verified before production use.

See:

- [API reference](docs/api.md)
- [Security and production-readiness checklist](docs/security.md)
- [Backup and recovery](docs/operations.md)
- [Railway deployment](docs/railway.md)
- [Environment example](.env.example)
