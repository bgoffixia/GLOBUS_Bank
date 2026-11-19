---
name: Verified signup and dashboard continuity
description: Customer-ID creation and dashboard navigation after email verification.
---

After email OTP succeeds and Clerk has a completed sign-in session, finalize the session and navigate directly to the customer dashboard even if optional profile details are missing, malformed, or not saved. Invalid optional values must be ignored and must never gate account creation. Ensure the server creates or resolves the customer profile with its Customer ID before returning dashboard data. Keep genuinely required Clerk fields and session requirements intact.

**Why:** The user asked that successful email verification always produce a Customer ID and dashboard access regardless of incomplete or invalid optional profile details.

**How to apply:** Keep optional profile persistence non-blocking, validate and sanitize it separately from required sign-up fields, and verify existing profiles also receive a Customer ID before dashboard responses.
