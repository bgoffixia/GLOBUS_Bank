---
name: Receipt preference snapshots
description: The Globus Bank rule for applying a customer's selected transaction receipt layout.
---

Apply a customer's saved receipt layout to each new customer-visible transaction. Snapshot the selected layout when the transaction is created so later preference changes do not alter historical receipts.

Customers must unlock the Vault to view receipt layouts. Once unlocked, they may preview layouts without paid access using clearly labeled illustrative data when no authorized transaction is available. Saving a preference requires an active Vault session and active Vault access.

**Why:** the user requested the selected design for all customer receipts and future transfers, while keeping prior receipts unchanged. Previewing requires an unlocked Vault, and saving requires active Vault access.

**How to apply:** when changing receipt preferences or transfer receipt rendering, use the saved preference as a creation-time snapshot; keep existing transaction receipt layouts immutable. Treat sample previews as non-persisted presentation data, and never reveal live transaction data without the existing session/access checks.
