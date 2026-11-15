---
name: Identity workflow retirement and data retention
description: Retired identity review, upload, and authorization behavior.
---

Identity document upload, admin review, payment-proof upload, and their related UI/API workflows are retired. Existing database metadata, historical status values, audit records, and stored files are preserved; workflow removal is not permission to clean up or migrate those records and files.

An active, unexpired Private Vault subscription replaces identity status as the authorization gate for eligible account operations. Account and wallet restrictions remain independent.

**Why:** The user asked to remove the full identity and payment-proof workflows, preserve existing records/files, and replace the verification gate with Vault subscription.

**How to apply:** Do not restore upload/review controls or delete historical identity/payment-proof data as part of deployment. Check active subscription status and expiry for the affected operations; continue enforcing account and wallet restrictions separately.
