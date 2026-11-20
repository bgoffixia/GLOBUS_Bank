---
name: Supabase migration ordering
description: Handle Drizzle migration watermarks and PostgreSQL's identifier truncation safely.
---

When reconciling migrations against an established Supabase database, Drizzle applies only journal entries newer than the latest `created_at` watermark. Ensure the pending entries remain ordered and newer than that watermark; otherwise an unapplied migration can be silently skipped. PostgreSQL truncates identifiers beyond 63 bytes, so idempotent foreign-key migrations should detect the constrained/referenced columns and delete action rather than compare only a long constraint name.

**Why:** Production retained migration history that predated the current checked-in journal, and an existing foreign-key name had been truncated by PostgreSQL.

**How to apply:** Before running production migrations, inspect the migration watermark and relevant `pg_constraint` metadata, then verify each migration hash and resulting schema after applying.
