import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canLoadVaultPrivateData,
  isVaultSessionActive,
  isVaultSessionRejected,
} from "../src/lib/vault-error-state";

test("private Vault data loads only with a session and active entitlement", () => {
  assert.equal(canLoadVaultPrivateData("", true), false);
  assert.equal(canLoadVaultPrivateData("session-token", false), false);
  assert.equal(canLoadVaultPrivateData("session-token", undefined), false);
  assert.equal(canLoadVaultPrivateData("  ", true), false);
  assert.equal(canLoadVaultPrivateData("session-token", true), true);
});

test("the Vault page is visible only for a non-expired unlocked session", () => {
  const now = Date.parse("2026-11-20T12:00:00.000Z");
  assert.equal(isVaultSessionActive("", "2026-11-20T12:10:00.000Z", now), false);
  assert.equal(isVaultSessionActive("session-token", "", now), false);
  assert.equal(isVaultSessionActive("session-token", "not-a-date", now), false);
  assert.equal(isVaultSessionActive("session-token", "2026-11-20T11:59:59.000Z", now), false);
  assert.equal(isVaultSessionActive("session-token", "2026-11-20T12:00:01.000Z", now), true);
});

test("a forbidden Vault response is treated as a rejected session", () => {
  assert.equal(isVaultSessionRejected({ status: 403 }), true);
  assert.equal(isVaultSessionRejected({ status: 500 }), false);
  assert.equal(isVaultSessionRejected(new Error("network failure")), false);
});
