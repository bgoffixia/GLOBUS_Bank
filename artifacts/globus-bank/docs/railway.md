# Railway deployment

The Railway deployment uses one Docker service for the Globus Bank web app and
API. Express serves the built Vite app and handles same-origin `/api` requests.
The database remains Supabase PostgreSQL; Railway is only the app host.

## Before connecting Railway

1. Push this repository to a Git provider Railway can access. The current Replit
   Git remote may not be available to Railway.
2. In Railway, create separate development and production environments.
3. Use separate empty Supabase PostgreSQL databases for the two environments.
   Do not point both environments at the same database.
4. Set the database URL in each environment's Railway variables as
   `SUPABASE_DATABASE_URL`. Keep it private and use the TLS-enabled connection
   string supplied by Supabase.
5. Apply the checked-in schema migrations to each empty database before
   starting the app:

   ```sh
   pnpm --filter @workspace/db run migrate
   ```

   Run this from a trusted shell with the intended environment's
   `SUPABASE_DATABASE_URL`. The migration creates the schema; it does not copy
   rows or files from the existing Replit database. Never run it with an
   unverified production target.

## Create the Railway service

1. Create a Railway project from the accessible Git repository.
2. Select the repository root as the service's source. Railway will use the
   root `Dockerfile`.
3. Set the health check path to `/api/healthz`.
4. Add the runtime variables below separately to the development and production
   environments. Railway supplies `PORT`.
5. Add the Clerk browser variables as Docker build variables so the Dockerfile
   can pass them to Vite:
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_CLERK_PROXY_URL` only if the external Clerk application uses a proxy
6. Deploy the development environment first, verify sign-in and account
   workflows, then deploy production.
7. Set `GLOBUS_APP_ORIGIN` in each environment to that environment's public
   HTTPS URL. Configure the corresponding allowed domains and redirect URLs in
   the external Clerk application.

## Runtime variables

Required for the app:

- `SUPABASE_DATABASE_URL` — environment-specific Supabase PostgreSQL URL.
- `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` — environment-specific Clerk
  server credentials.
- `SESSION_SECRET` — secret used for member session operations.
- `BANK_DETAILS_ENCRYPTION_KEY` — secret used to encrypt private bank details.
- `GLOBUS_ADMIN_CLERK_IDS` and/or `GLOBUS_ADMIN_EMAILS` — allowlisted
  administrator identities; leave unset to disable admin access.
- `GLOBUS_APP_ORIGIN` — public HTTPS origin for password-reset and notification
  links.

The browser build also requires `VITE_CLERK_PUBLISHABLE_KEY`. This is a public
Clerk key, not a secret, but must match the environment's Clerk application.

Optional integrations:

- `RESEND_API_KEY` and `GLOBUS_SECURITY_EMAIL_FROM` for security emails.
- `PAYSTACK_SECRET_KEY` for Paystack checkout. The code also recognizes the
  older misspelled `PAYSTACK_SCRET_KEY`.
- `WEBPUSHR_SITE_KEY`, `WEBPUSHR_REST_API_KEY`, and `WEBPUSHR_AUTH_TOKEN` for
  push notifications.
- `GREY_API_SECRET_KEY` for the optional exchange-rate fallback.

Do not copy secret values into source files, Docker build logs, or this guide.

## Removed upload workflows

Identity-document review and manual Private Vault payment-proof upload and
review are disabled. Their API routes return `410 Gone`. Existing database
records and stored files are not deleted or migrated; no file cleanup is part
of this deployment.

## Verification

After deployment, confirm `/api/healthz` returns `{"status":"ok"}`, test Clerk
sign-in, and verify a member can use account actions only while the Private
Vault subscription is active. Also verify administrators can review permitted
requests and that email links use the Railway public origin.
