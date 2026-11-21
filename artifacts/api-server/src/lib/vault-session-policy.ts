export const VAULT_DEVICE_COOKIE_NAME = "globus_vault_device";
export const VAULT_DEVICE_COOKIE_PATH = "/api/bank/vault";
export const VAULT_REMEMBERED_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const VAULT_SESSION_DURATION_MS = 15 * 60 * 1000;

export function vaultSessionDurationMs(rememberDevice: boolean): number {
  return rememberDevice
    ? VAULT_REMEMBERED_SESSION_DURATION_MS
    : VAULT_SESSION_DURATION_MS;
}

export type IncompleteVaultAttemptState = {
  subscriptionStatus: string;
  paymentStatus: string;
  paymentReference: string | null;
  paymentVerifiedAt: Date | null;
  autoRenew: boolean;
  providerSubscriptionCode: string | null;
};

export function classifyIncompleteVaultAttempt(
  state: IncompleteVaultAttemptState,
): "clearable" | "verify_with_paystack" | "protected" | "none" {
  if (
    state.subscriptionStatus === "active" ||
    state.paymentStatus === "success" ||
    state.paymentVerifiedAt !== null ||
    state.autoRenew ||
    state.providerSubscriptionCode !== null
  ) {
    return "protected";
  }

  if (state.paymentStatus === "pending") {
    return state.paymentReference ? "verify_with_paystack" : "protected";
  }

  if (
    state.paymentStatus === "failed" ||
    state.subscriptionStatus === "pending"
  ) {
    return "clearable";
  }

  return "none";
}

export function isTerminalUnpaidPaystackStatus(status: string): boolean {
  return status === "failed" || status === "abandoned";
}
