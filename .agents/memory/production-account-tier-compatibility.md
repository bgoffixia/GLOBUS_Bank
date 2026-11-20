---
name: Production-compatible account tiers
description: Keep tier display derived from subscription fields when production has no tier catalog.
---

In the production-compatible Globus Bank schema, account tiers are not persisted. Customers use Standard as the base display tier; only an active paid Vault subscription maps to a tier ID and label from the existing application plan configuration. Do not query or write `bank_users.account_tier_id` or `bank_account_tiers`, and do not represent administrator tier assignments as stored state without an approved persistence model.

**Why:** Production intentionally omits both objects. Drizzle full-row reads and dashboard/profile tier lookups fail when runtime code expects them.

**How to apply:** Keep the current Drizzle bank-user model aligned with production, compute display tiers purely from subscription status, expiry, and plan fields, and avoid admin controls that imply persisted assignments.
