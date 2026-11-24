import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getVaultPasscodeResetSenderAddress,
  validateVaultPasscodeResetSenderAddress,
} from "../src/lib/vault-passcode-reset-email.js";

test("validates and preserves a configured sender mailbox", () => {
  assert.equal(
    validateVaultPasscodeResetSenderAddress("security@globus.website"),
    "security@globus.website",
  );
  assert.equal(
    getVaultPasscodeResetSenderAddress({
      GLOBUS_VAULT_PIN_RESET_EMAIL_FROM: "vault@globus.website",
      GLOBUS_SECURITY_EMAIL_FROM: "legacy@globus.website",
    }),
    "vault@globus.website",
  );
});

test("supports the legacy sender setting and secure default", () => {
  assert.equal(
    getVaultPasscodeResetSenderAddress({
      GLOBUS_SECURITY_EMAIL_FROM: "security@globus.website",
    }),
    "security@globus.website",
  );
  assert.equal(getVaultPasscodeResetSenderAddress({}), "security@globus.website");
});

test("rejects malformed, display-name, and header-injection sender values", () => {
  for (const address of [
    "",
    " ",
    "GLOBUS Security <security@globus.website>",
    "security@localhost",
    "security..team@globus.website",
    ".security@globus.website",
    "security@-globus.website",
    "security@globus-.website",
    "security@globus.website\\r\\nBcc:attacker@example.com",
  ]) {
    assert.throws(() => validateVaultPasscodeResetSenderAddress(address));
  }
});

test("does not silently fall back when the dedicated setting is explicitly empty", () => {
  assert.throws(
    () =>
      getVaultPasscodeResetSenderAddress({
        GLOBUS_VAULT_PIN_RESET_EMAIL_FROM: "",
        GLOBUS_SECURITY_EMAIL_FROM: "security@globus.website",
      }),
    /configured but empty/i,
  );
});
