---
name: Receipt preference snapshots
description: The Globus Bank rule for applying a customer's selected transaction receipt layout.
---

Apply a customer's saved receipt layout to new transfers only. Store the selected layout on each transfer when it is created so later preference changes do not alter historical receipts.

**Why:** the user requested that saved receipt preferences affect future transfers while keeping prior receipts unchanged.

**How to apply:** when changing receipt preferences or transfer receipt rendering, use the saved preference as a creation-time snapshot; keep existing transaction receipt layouts immutable.
