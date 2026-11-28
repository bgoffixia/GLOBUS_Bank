# DUTSTAR BANK preview deployment

Cloudflare Pages project: `dutstar-bank-preview`
Preview hostname: `https://dutstar-bank-preview.pages.dev`
Source repository: `bgoffixia/GLOBUS_Bank`
Preview branch: `migration/dutstar-cloudflare`

The Pages project is configured to build only the migration branch. Production deployments from `main` are explicitly disabled. No custom domain or production DNS record is attached to this preview.

Build command:
`pnpm install --frozen-lockfile && pnpm --filter @workspace/globus-bank run build`

Output directory:
`artifacts/globus-bank/dist/public`

The Clerk publishable key is configured as a preview build variable. No Clerk secret, database credential, payment secret, or encryption key is placed in Pages build variables.

This preview is for frontend acceptance testing only. The current Cloudflare Worker API still exposes read-only customer routes and returns 503 for unported banking operations. This preview is not a live-money banking deployment and must not be treated as a production cutover.
