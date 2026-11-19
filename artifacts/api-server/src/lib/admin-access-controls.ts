export const MIN_ADMIN_ACCESS_REASON_LENGTH = 8;
export const MAX_ADMIN_ACCESS_REASON_LENGTH = 500;

export function normalizeAdminAccessReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  if (
    reason.length < MIN_ADMIN_ACCESS_REASON_LENGTH ||
    reason.length > MAX_ADMIN_ACCESS_REASON_LENGTH
  ) {
    return null;
  }
  return reason;
}

export function buildAdminAccessControlsAuditReason(
  reason: string,
  controls: {
    testingModeDisabled: boolean;
    transferAccessGranted: boolean;
  },
): string {
  return `${reason} Testing Mode disabled: ${controls.testingModeDisabled}; separate transfer access granted: ${controls.transferAccessGranted}. Neither setting grants Private Vault access.`;
}

export function buildAdminAccessControlsAuditEntry(input: {
  actorUserId: string;
  targetUserId: string;
  reason: string;
  testingModeDisabled: boolean;
  transferAccessGranted: boolean;
}) {
  return {
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    action: "update_customer_access_controls",
    reason: buildAdminAccessControlsAuditReason(input.reason, {
      testingModeDisabled: input.testingModeDisabled,
      transferAccessGranted: input.transferAccessGranted,
    }),
  };
}
