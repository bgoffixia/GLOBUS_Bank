# Backup and recovery

This project uses PostgreSQL. Confirm the database target and workspace before running a restore. Never restore a development dump over production data.

## Create a backup

Run from a trusted shell with the intended environment's `SUPABASE_DATABASE_URL` supplied:

```sh
pg_dump "$SUPABASE_DATABASE_URL" --format=custom --file="globus-bank-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Keep backup files in an approved private storage location. Do not commit them to the repository or share database URLs.

## Restore to a separately confirmed target

First confirm the target database is isolated and that the existing target has its own backup. Then restore:

```sh
pg_restore --clean --if-exists --dbname="$SUPABASE_RESTORE_DATABASE_URL" globus-bank-backup.dump
```

This command replaces matching objects in the selected target. Verify the target connection before running it.

## Supabase schema migrations

Development and production use separate Supabase databases. Add `SUPABASE_DATABASE_URL` to Replit's development Secrets for development and to Publishing → Production app secrets for production. Do not use the Replit-managed `DATABASE_URL`.

The checked-in migration files create the schema but do not copy records. The old Replit-managed databases are left untouched. After setting the development secret, post-merge setup applies migrations there. For production, run the migration manually from a trusted shell with the production Supabase URL set as `SUPABASE_DATABASE_URL`:

```sh
pnpm --filter @workspace/db run migrate
```

Do not run production migrations from application startup or deployment build steps. Confirm the production target before running the command; its migrations change the selected Supabase database.

## Recovery checks

1. Confirm the database is reachable and the expected schema is present.
2. Check that each completed ledger transaction has equal total debits and credits per currency.
3. Reconcile wallet balances from posted ledger entries; do not edit balances directly.
4. Review the newest audit records and provider reconciliation exceptions.
5. Keep the app in simulation-only mode until account access, balances and audit history are verified.
6. Record recovery time, target and outcome in the operational log.

Provider reconciliation and production recovery runbooks are not configured yet because no financial provider is connected.
