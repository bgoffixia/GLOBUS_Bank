const DEFAULT_VAULT_PASSCODE_RESET_SENDER = "security@globus.website";

const EMAIL_ADDRESS_PATTERN =
  /^[A-Za-z0-9!#$%&'*+=?^_{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+=?^_{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function validateVaultPasscodeResetSenderAddress(value: string): string {
  const address = value.trim();
  const [localPart, domain] = address.split("@");
  if (
    !address ||
    address.length > 254 ||
    !localPart ||
    localPart.length > 64 ||
    !domain ||
    domain.length > 253 ||
    !EMAIL_ADDRESS_PATTERN.test(address)
  ) {
    throw new Error(
      "GLOBUS_VAULT_PIN_RESET_EMAIL_FROM must be a valid mailbox address (for example, security@globus.website).",
    );
  }
  return address;
}

export function getVaultPasscodeResetSenderAddress(
  env: NodeJS.ProcessEnv = process.env,
): string {
  // Vault passcode mail has its own sender identity; never inherit the
  // transfer-alert sender configuration.
  const configured =
    env.GLOBUS_VAULT_PIN_RESET_EMAIL_FROM ??
    DEFAULT_VAULT_PASSCODE_RESET_SENDER;
  if (!configured.trim()) {
    throw new Error("GLOBUS_VAULT_PIN_RESET_EMAIL_FROM is configured but empty.");
  }
  return validateVaultPasscodeResetSenderAddress(configured);
}
