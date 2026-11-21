import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyIncompleteVaultAttempt,
  VAULT_DEVICE_COOKIE_NAME,
  VAULT_DEVICE_COOKIE_PATH,
  VAULT_REMEMBERED_SESSION_DURATION_MS,
  VAULT_SESSION_DURATION_MS,
  vaultSessionDurationMs,
} from "../src/lib/vault-session-policy";

test("remembered Vault access lasts seven days without extending ordinary sessions", () => {
  assert.equal(vaultSessionDurationMs(true), 7 * 24 * 60 * 60 * 1000);
  assert.equal(vaultSessionDurationMs(false), 15 * 60 * 1000);
  assert.equal(VAULT_REMEMBERED_SESSION_DURATION_MS, 7 * 24 * 60 * 60 * 1000);
  assert.equal(VAULT_SESSION_DURATION_MS, 15 * 60 * 1000);
  assert.equal(VAULT_DEVICE_COOKIE_NAME, "globus_vault_device");
  assert.equal(VAULT_DEVICE_COOKIE_PATH, "/api/bank/vault");
});

test("only unpaid incomplete subscription attempts can be cleared", () => {
  assert.equal(classifyIncompleteVaultAttempt({
    subscriptionStatus: "pending",
    paymentStatus: "pending",
    paymentReference: "GBV-reference",
    paymentVerifiedAt: null,
    autoRenew: false,
    providerSubscriptionCode: null,
  }), "verify_with_paystack");

  assert.equal(classifyIncompleteVaultAttempt({
    subscriptionStatus: "inactive",
    paymentStatus: "failed",
    paymentReference: "GBV-reference",
    paymentVerifiedAt: null,
    autoRenew: false,
    providerSubscriptionCode: null,
  }), "clearable");

  assert.equal(classifyIncompleteVaultAttempt({
    subscriptionStatus: "active",
    paymentStatus: "success",
    paymentReference: "GBV-reference",
    paymentVerifiedAt: new Date(),
    autoRenew: true,
    providerSubscriptionCode: "SUB_code",
  }), "protected");

  assert.equal(classifyIncompleteVaultAttempt({
    subscriptionStatus: "inactive",
    paymentStatus: "none",
    paymentReference: null,
    paymentVerifiedAt: null,
    autoRenew: false,
    providerSubscriptionCode: null,
  }), "none");
});
