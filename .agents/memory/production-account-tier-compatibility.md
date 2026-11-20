---
name: Production-compatible account tiers
description: Keep admin-assigned base tiers separate from paid Vault access and avoid unsupported tier catalog tables.
---

The production-compatible Globus Bank schema has no `bank_account_tiers` table or `bank_users.account_tier_id`. The user has requested administrator assignment of customer base tiers, including an administrator's own customer profile. Persist this only as nullable `bank_users.admin_account_tier`, constrained to the existing tier codes; never use it to grant Vault access or administrator privileges. An active paid Vault plan takes precedence, then the assigned base tier, then Standard.

**Why:** Production intentionally omits the tier catalog and subscription foreign key, but a requested persistent admin assignment needs a separate small field that does not introduce either unsupported object.

**How to apply:** Keep plan-to-tier mapping as the paid source of truth; use the nullable admin base tier only when no active mapped subscription applies. Require the allowlisted admin guard, transaction PIN, and audit log. Keep Vault entitlement checks independent from all tier values.
