const DEFAULT_VAULT_PASSCODE_RESET_SENDER = "security@globus.website";

const EMAIL_ADDRESS_PATTERN =
  /^(?=.{3,254}$)(?=.{1,64}@)[A-Za-z0-9!#$%&'*+\\/=?^`{|}~.-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function validateVaultPasscodeResetSenderAddress(value: string): string {
  const address = value.trim();
  if (
    address !== value.trim() ||
    !EMAIL_ADDRESS_PATTERN.test(address) ||
    address.includes("..") ||
    address.startsWith(".") ||
    address.includes("@.") ||
    address.includes(".@") ||
    address.endsWith(".")
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
  const configured =
    env.GLOBUS_VAULT_PIN_RESET_EMAIL_FROM ??
    env.GLOBUS_SECURITY_EMAIL_FROM ??
    DEFAULT_VAULT_PASSCODE_RESET_SENDER;
  if (!configured.trim()) {
    throw new Error("GLOBUS_VAULT_PIN_RESET_EMAIL_FROM is configured but empty.");
  }
  return validateVaultPasscodeResetSenderAddress(configured);
}
