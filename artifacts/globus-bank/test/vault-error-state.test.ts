import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canLoadVaultPrivateData,
  isVaultSessionRejected,
} from "../src/lib/vault-error-state";

test("private Vault data loads only with a session and active entitlement", () => {
  assert.equal(canLoadVaultPrivateData("", true), false);
  assert.equal(canLoadVaultPrivateData("session-token", false), false);
  assert.equal(canLoadVaultPrivateData("session-token", undefined), false);
  assert.equal(canLoadVaultPrivateData("  ", true), false);
  assert.equal(canLoadVaultPrivateData("session-token", true), true);
});

test("a forbidden Vault response is treated as a rejected session", () => {
  assert.equal(isVaultSessionRejected({ status: 403 }), true);
  assert.equal(isVaultSessionRejected({ status: 500 }), false);
  assert.equal(isVaultSessionRejected(new Error("network failure")), false);
});
