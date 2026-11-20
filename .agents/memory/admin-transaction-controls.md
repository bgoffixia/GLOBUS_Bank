---
name: Admin transaction controls
description: Durable rules for internal transaction-status corrections and customer restrictions.
---

Administrative status corrections change processing metadata only; they never create, remove, or alter ledger postings. A transaction may be marked completed only when its existing postings are balanced. Completed and reversed history is immutable; corrections to posted funds use compensating entries.

The customer-visible transaction date is a separate nullable calendar date. Admins may change it only through the allowlisted, PIN-confirmed, audited control; never rewrite the original `created_at` timestamp or ledger entries.

Restrictions are additive and independently removable. Removing one restriction must not remove any other active restriction. Enforce restrictions on the server when an operation is requested and immediately before ledger changes are committed. Frozen wallets continue to accept credits but cannot send or withdraw.

**Why:** The user requires an auditable internal ledger, truthful transaction states, and restrictions that cannot be bypassed by UI-only controls or accidentally cleared together. A display-date override must not change when the ledger record was actually created.

**How to apply:** Preserve these invariants in admin status, date editing, reversal, funding, transfer, deposit, withdrawal, freeze, suspension, and restriction-removal workflows.
