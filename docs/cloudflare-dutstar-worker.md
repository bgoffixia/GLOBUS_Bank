# Dutstar Bank — Cloudflare Workers API deployment

This deployment is for the Express API in `artifacts/api-server`. The React/Vite client in
`artifacts/globus-bank` is a separate static frontend deployment and must not be built as
the API Worker.

## Cloudflare Git integration settings

- Repository: `bgoffixia/GLOBUS_Bank`
- Root directory: repository root (`/`)
- Project/Worker name: `dutstar-bank-api`
- Build command: `pnpm install --frozen-lockfile`
- Deploy command: `npx wrangler@4.44.0 deploy --config wrangler.dutstar.jsonc`
- Preview command: `npx wrangler@4.44.0 dev --config wrangler.dutstar.jsonc`
- Wrangler configuration: `wrangler.dutstar.jsonc`

Do not use the generic `pnpm run build` command in this Worker project: the root
workspace build builds every artifact and is not the Worker deployment entrypoint.
Wrangler bundles `artifacts/api-server/src/worker.ts` directly.

## Required Worker secrets and variables

Configure these in the Worker settings, not in Git:

### Required secrets

- `SUPABASE_DATABASE_URL`: the existing Supabase PostgreSQL connection string.
- `CLERK_SECRET_KEY`: existing Clerk secret key.
- `RESEND_API_KEY`: Resend API key (used over HTTPS by Workers).
- `BANK_DETAILS_ENCRYPTION_KEY`: existing application encryption key.
- `PAYSTACK_SECRET_KEY`: required if the existing Paystack workflows are enabled.

### Required variables

- `CLERK_PUBLISHABLE_KEY`: existing Clerk publishable key.
- `DUTSTAR_TRANSFER_ALERT_EMAIL_FROM=paymentnotification@infomail.click`
- `GLOBUS_APP_ORIGIN=https://www.global-internetbanking.globus.website`
- `NODE_ENV=production` (already in Wrangler config).

Retain any other production variables used by enabled integrations (for example
Webpushr, Google Cloud Storage, Paystack, vault reset mail, and support configuration).
Do not paste secrets into GitHub files or chat.

## Email transport

Cloudflare Worker transactional mail uses the Resend HTTPS API at
`https://api.resend.com/emails`, authenticated by `RESEND_API_KEY`. The requested
visible From address is `paymentnotification@infomail.click`. Verify `infomail.click`
in Resend and publish the exact SPF/DKIM DNS records Resend provides before testing.
The SMTP host/port/username variables are not needed by the Worker HTTPS transport.

## Database

The current database module expects `SUPABASE_DATABASE_URL` and creates a
node-postgres pool. This first Worker adapter preserves that existing connection
configuration. Cloudflare Hyperdrive is the recommended next step for managed
connection pooling; it requires creating a Hyperdrive configuration in the Cloudflare
account and adding its binding ID. Do not change or migrate the Supabase database.

## Background jobs

The Node process used `setInterval()`. The Worker adapter replaces those timers with
Cron Triggers:
- Every minute: expire Private Vault subscriptions and revoke sessions.
- Every six hours: process Private Vault expiry reminder emails.

## Release gate

Do not route production traffic to this Worker until all of the following pass:
1. Worker bundle/build succeeds.
2. API health endpoint returns healthy.
3. Clerk sign-in/session and protected routes work on the intended host.
4. Supabase read/write checks pass using the existing schema and RLS.
5. Vault PIN, encryption, Paystack webhook signature and idempotency tests pass.
6. Resend test email is accepted from the verified sender.
7. Transfer notification tests confirm simulated-ledger wording and correct recipient.
8. Scheduled expiration/reminder handlers are exercised.
9. CORS, origin checks, rate limits and admin allowlists are verified.

This app's existing records are simulation-only. Do not present its internal ledger
events as external bank settlement or real-world payment confirmation.
