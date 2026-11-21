export function canLoadVaultPrivateData(
  sessionActive: boolean,
  accessActive: boolean | null | undefined,
): boolean {
  return sessionActive && accessActive === true;
}

export function isVaultSessionActive(
  sessionActive: boolean,
  expiresAt: string,
  now = Date.now(),
): boolean {
  const expiryTime = Date.parse(expiresAt);
  return sessionActive && Number.isFinite(expiryTime) && expiryTime > now;
}

export function isVaultSessionRejected(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return false;
  }

  return (error as { status?: unknown }).status === 403;
}
