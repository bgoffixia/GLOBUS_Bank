export function canLoadVaultPrivateData(
  sessionToken: string,
  accessActive: boolean | null | undefined,
): boolean {
  return sessionToken.trim().length > 0 && accessActive === true;
}

export function isVaultSessionActive(
  sessionToken: string,
  expiresAt: string,
  now = Date.now(),
): boolean {
  const expiryTime = Date.parse(expiresAt);
  return sessionToken.trim().length > 0 && Number.isFinite(expiryTime) && expiryTime > now;
}

export function isVaultSessionRejected(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return false;
  }

  return (error as { status?: unknown }).status === 403;
}
