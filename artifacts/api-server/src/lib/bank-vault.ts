import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, gt, inArray, lte, or } from "drizzle-orm";
import {
  bankUsersTable,
  bankVaultAdminEntitlementsTable,
  bankVaultSessionsTable,
  db,
} from "@workspace/db";
import { getVaultSubscriptionPlan } from "./vault-subscription";
import { vaultSessionDurationMs } from "./vault-session-policy";

const KEY_LENGTH = 64;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export type VaultPasscodeResult =
  | "valid"
  | "invalid"
  | "not_configured"
  | "locked"
  | "missing_user";

export type VaultSubscriptionState =
  | "inactive"
  | "pending"
  | "active"
  | "rejected"
  | "expired";

export type EffectiveAccountTierSource =
  | "paystack_subscription"
  | "admin_assignment"
  | "default";

export type AdminAccountTierCode = "standard" | "silver" | "gold" | "bronze";

export type EffectiveAccountTier = {
  id: AdminAccountTierCode;
  name: string;
  source: EffectiveAccountTierSource;
};

const ADMIN_ACCOUNT_TIER_LABELS: Record<AdminAccountTierCode, string> = {
  standard: "Standard 🏦",
  silver: "Silver🥈",
  gold: "Gold 🪙",
  bronze: "Bronze 🥉",
};

export function vaultSubscriptionStatus(
  status: string,
  expiresAt: Date | null,
  now = new Date(),
): VaultSubscriptionState {
  if (status === "active" && expiresAt && expiresAt <= now) return "expired";
  if (["inactive", "pending", "active", "rejected", "expired"].includes(status)) {
    return status as VaultSubscriptionState;
  }
  return "inactive";
}

export function hasActiveVaultSubscription(user: {
  vaultSubscriptionStatus: string;
  vaultSubscriptionExpiresAt: Date | null;
}, now = new Date()): boolean {
  return vaultSubscriptionStatus(
    user.vaultSubscriptionStatus,
    user.vaultSubscriptionExpiresAt,
    now,
  ) === "active";
}

export function classifyVaultPaystackChargeFailure(
  user: {
    vaultSubscriptionStatus: string;
    vaultSubscriptionExpiresAt: Date | null;
    vaultSubscriptionPaymentReference: string | null;
    vaultSubscriptionPaymentStatus: string;
    vaultSubscriptionAmountMinor: string | null;
    vaultSubscriptionAutoRenew: boolean;
    vaultPaystackPlanCode: string | null;
    vaultPaystackSubscriptionCode: string | null;
    vaultPaystackCustomerCode: string | null;
  },
  charge: {
    reference: string;
    amount: number;
    currency: string;
    customerCode: string | null;
    subscriptionCode: string | null;
    providerPlanCode: string | null;
  },
  now = new Date(),
): "initial" | "renewal" | null {
  if (
    charge.currency !== "NGN" ||
    !Number.isSafeInteger(charge.amount) ||
    String(charge.amount) !== user.vaultSubscriptionAmountMinor
  ) {
    return null;
  }

  if (
    charge.reference === user.vaultSubscriptionPaymentReference &&
    user.vaultSubscriptionPaymentStatus === "pending"
  ) {
    return "initial";
  }

  const currentStatus = vaultSubscriptionStatus(
    user.vaultSubscriptionStatus,
    user.vaultSubscriptionExpiresAt,
    now,
  );
  if (
    user.vaultSubscriptionAutoRenew &&
    Boolean(user.vaultPaystackPlanCode) &&
    Boolean(user.vaultPaystackSubscriptionCode) &&
    user.vaultPaystackSubscriptionCode === charge.subscriptionCode &&
    user.vaultPaystackCustomerCode === charge.customerCode &&
    user.vaultPaystackPlanCode === charge.providerPlanCode &&
    ["active", "expired"].includes(currentStatus)
  ) {
    return "renewal";
  }

  return null;
}

export function resolveEffectiveAccountTier(
  user: {
    vaultSubscriptionStatus: string;
    vaultSubscriptionExpiresAt: Date | null;
    vaultSubscriptionPlan: string | null;
    adminAccountTier?: string | null;
  },
  now = new Date(),
): EffectiveAccountTier {
  if (hasActiveVaultSubscription(user, now) && user.vaultSubscriptionPlan) {
    const plan = getVaultSubscriptionPlan(user.vaultSubscriptionPlan);
    if (plan) {
      return {
        id: plan.tierId as AdminAccountTierCode,
        name: plan.tierName,
        source: "paystack_subscription",
      };
    }
  }
  if (
    user.adminAccountTier &&
    Object.hasOwn(ADMIN_ACCOUNT_TIER_LABELS, user.adminAccountTier)
  ) {
    const id = user.adminAccountTier as AdminAccountTierCode;
    return {
      id,
      name: ADMIN_ACCOUNT_TIER_LABELS[id],
      source: "admin_assignment",
    };
  }
  return { id: "standard", name: "Standard 🏦", source: "default" };
}

export function isVaultTestingMode(
  accessSource: "none" | "paystack_subscription" | "admin_grant",
  testingModeDisabled = false,
): boolean {
  return accessSource === "none" && !testingModeDisabled;
}

export function getEffectiveAccountTier(
  user: {
    vaultSubscriptionStatus: string;
    vaultSubscriptionExpiresAt: Date | null;
    vaultSubscriptionPlan: string | null;
    adminAccountTier?: string | null;
  },
  now = new Date(),
): EffectiveAccountTier {
  return resolveEffectiveAccountTier(user, now);
}

type VaultAccessExecutor = Pick<typeof db, "select">;

export async function hasAdminVaultEntitlement(
  userId: string,
  executor: VaultAccessExecutor = db,
): Promise<boolean> {
  const [entitlement] = await executor
    .select({ userId: bankVaultAdminEntitlementsTable.userId })
    .from(bankVaultAdminEntitlementsTable)
    .where(eq(bankVaultAdminEntitlementsTable.userId, userId))
    .limit(1);
  return Boolean(entitlement);
}

export async function getVaultAccessSource(
  user: {
    id: string;
    vaultSubscriptionStatus: string;
    vaultSubscriptionExpiresAt: Date | null;
  },
  executor: VaultAccessExecutor = db,
  now = new Date(),
): Promise<"none" | "paystack_subscription" | "admin_grant"> {
  if (await hasAdminVaultEntitlement(user.id, executor)) return "admin_grant";
  return hasActiveVaultSubscription(user, now)
    ? "paystack_subscription"
    : "none";
}

export async function hasActiveVaultAccess(
  user: {
    id: string;
    vaultSubscriptionStatus: string;
    vaultSubscriptionExpiresAt: Date | null;
  },
  executor: VaultAccessExecutor = db,
  now = new Date(),
): Promise<boolean> {
  return (await getVaultAccessSource(user, executor, now)) !== "none";
}

export async function expireVaultSubscriptions(now = new Date()): Promise<number> {
  return db.transaction(async (tx) => {
    const expiredUsers = await tx
      .update(bankUsersTable)
      .set({
        vaultSubscriptionStatus: "expired",
        updatedAt: now,
      })
      .where(
        and(
          eq(bankUsersTable.vaultSubscriptionStatus, "active"),
          lte(bankUsersTable.vaultSubscriptionExpiresAt, now),
        ),
      )
      .returning({ id: bankUsersTable.id });

    if (expiredUsers.length === 0) return 0;

    await tx
      .delete(bankVaultSessionsTable)
      .where(inArray(
        bankVaultSessionsTable.userId,
        expiredUsers.map((user) => user.id),
      ));

    return expiredUsers.length;
  });
}

export async function vaultTransferEmailAlertsEnabled(
  user: {
    id: string;
    vaultEmailAlertsEnabled: boolean;
    vaultSubscriptionStatus: string;
    vaultSubscriptionExpiresAt: Date | null;
  },
  executor: VaultAccessExecutor = db,
  now = new Date(),
): Promise<boolean> {
  return (
    user.vaultEmailAlertsEnabled &&
    await hasActiveVaultAccess(user, executor, now)
  );
}

export function normalizeFutureTransferMode(
  mode: string,
): "successful" | "pending" | "failed" {
  if (mode === "normal") return "successful";
  if (mode === "hold") return "pending";
  if (mode === "reject") return "failed";
  if (mode === "successful" || mode === "pending" || mode === "failed") {
    return mode;
  }
  return "successful";
}

export function resolveFutureTransferStatus(
  mode: string,
  vaultAccessActive = true,
): "completed" | "pending" | "failed" {
  if (!vaultAccessActive) return "completed";
  const normalized = normalizeFutureTransferMode(mode);
  if (normalized === "failed") return "failed";
  if (normalized === "pending") return "pending";
  return "completed";
}

function derive(passcode: string, salt: Buffer): Promise<Buffer> {
  const pepper = process.env.SESSION_SECRET;
  if (!pepper) throw new Error("Vault passcode security is unavailable.");
  return new Promise((resolve, reject) => {
    scrypt(`${passcode}:${pepper}`, salt, KEY_LENGTH, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

async function hashPasscode(passcode: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(passcode, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function comparePasscode(
  passcode: string,
  encodedHash: string,
): Promise<boolean> {
  const parts = encodedHash.split("$");
  if (
    parts.length !== 3 ||
    parts[0] !== "scrypt" ||
    !/^[a-f0-9]{32}$/.test(parts[1]) ||
    !/^[a-f0-9]{128}$/.test(parts[2])
  ) {
    return false;
  }
  const expected = Buffer.from(parts[2], "hex");
  const actual = await derive(passcode, Buffer.from(parts[1], "hex"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function initializeVaultPasscode(
  userId: string,
  passcode: string,
): Promise<boolean> {
  const encodedHash = await hashPasscode(passcode);
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        id: bankUsersTable.id,
        configured: bankUsersTable.vaultPasscodeHash,
      })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, userId))
      .for("update");
    if (!user) return false;
    if (user.configured) return false;
    await tx
      .update(bankUsersTable)
      .set({
        vaultPasscodeHash: encodedHash,
        vaultPasscodeFailedAttempts: 0,
        vaultPasscodeLockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(bankUsersTable.id, userId));
    return true;
  });
}

export async function unlockVault(
  userId: string,
  passcode: string,
  options: { rememberDevice?: boolean; previousSessionToken?: string } = {},
): Promise<
  | { result: "valid"; sessionToken: string; expiresAt: Date }
  | { result: Exclude<VaultPasscodeResult, "valid"> }
> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        hash: bankUsersTable.vaultPasscodeHash,
        attempts: bankUsersTable.vaultPasscodeFailedAttempts,
        lockedUntil: bankUsersTable.vaultPasscodeLockedUntil,
      })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, userId))
      .for("update");
    if (!user) return { result: "missing_user" as const };
    if (!user.hash) return { result: "not_configured" as const };
    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      return { result: "locked" as const };
    }
    if (!(await comparePasscode(passcode, user.hash))) {
      const attempts = user.attempts + 1;
      const locked = attempts >= MAX_FAILED_ATTEMPTS;
      await tx
        .update(bankUsersTable)
        .set({
          vaultPasscodeFailedAttempts: locked ? 0 : attempts,
          vaultPasscodeLockedUntil: locked
            ? new Date(now.getTime() + LOCK_DURATION_MS)
            : null,
        })
        .where(eq(bankUsersTable.id, userId));
      return { result: locked ? "locked" as const : "invalid" as const };
    }
    await tx
      .update(bankUsersTable)
      .set({
        vaultPasscodeFailedAttempts: 0,
        vaultPasscodeLockedUntil: null,
      })
      .where(eq(bankUsersTable.id, userId));
    await tx
      .delete(bankVaultSessionsTable)
      .where(
        and(
          eq(bankVaultSessionsTable.userId, userId),
          or(
            lte(bankVaultSessionsTable.expiresAt, now),
            ...(options.previousSessionToken
              ? [
                  eq(
                    bankVaultSessionsTable.tokenHash,
                    createHash("sha256")
                      .update(options.previousSessionToken)
                      .digest("hex"),
                  ),
                ]
              : []),
          ),
        ),
      );
    const sessionToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      now.getTime() + vaultSessionDurationMs(options.rememberDevice === true),
    );
    await tx.insert(bankVaultSessionsTable).values({
      userId,
      tokenHash: createHash("sha256").update(sessionToken).digest("hex"),
      expiresAt,
    });
    return { result: "valid" as const, sessionToken, expiresAt };
  });
}

async function hasValidVaultPasscodeSession(
  userId: string,
  sessionToken: string,
): Promise<boolean> {
  const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
  const [session] = await db
    .select({ id: bankVaultSessionsTable.id })
    .from(bankVaultSessionsTable)
    .where(
      and(
        eq(bankVaultSessionsTable.userId, userId),
        eq(bankVaultSessionsTable.tokenHash, tokenHash),
        gt(bankVaultSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return !!session;
}

export async function isVaultPasscodeSessionValid(
  userId: string,
  sessionToken: string,
): Promise<boolean> {
  return hasValidVaultPasscodeSession(userId, sessionToken);
}

export async function getVaultPasscodeSessionExpiry(
  userId: string,
  sessionToken: string,
): Promise<Date | null> {
  if (!sessionToken) return null;
  const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
  const [session] = await db
    .select({ expiresAt: bankVaultSessionsTable.expiresAt })
    .from(bankVaultSessionsTable)
    .where(
      and(
        eq(bankVaultSessionsTable.userId, userId),
        eq(bankVaultSessionsTable.tokenHash, tokenHash),
        gt(bankVaultSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return session?.expiresAt ?? null;
}

export async function revokeVaultPasscodeSession(
  userId: string,
  sessionToken: string,
): Promise<boolean> {
  if (!sessionToken) return false;
  const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
  const [session] = await db
    .delete(bankVaultSessionsTable)
    .where(
      and(
        eq(bankVaultSessionsTable.userId, userId),
        eq(bankVaultSessionsTable.tokenHash, tokenHash),
      ),
    )
    .returning({ id: bankVaultSessionsTable.id });
  return !!session;
}

export async function isVaultSessionActive(
  userId: string,
  sessionToken: string,
): Promise<boolean> {
  const [user] = await db
    .select({
      id: bankUsersTable.id,
      vaultSubscriptionStatus: bankUsersTable.vaultSubscriptionStatus,
      vaultSubscriptionExpiresAt: bankUsersTable.vaultSubscriptionExpiresAt,
    })
    .from(bankUsersTable)
    .where(eq(bankUsersTable.id, userId))
    .limit(1);
  if (!user || !(await hasActiveVaultAccess(user))) return false;
  return hasValidVaultPasscodeSession(userId, sessionToken);
}

export async function updateVaultPasscode(
  userId: string,
  sessionToken: string,
  newPasscode: string,
): Promise<boolean> {
  const newHash = await hashPasscode(newPasscode);
  const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        id: bankUsersTable.id,
        vaultSubscriptionStatus: bankUsersTable.vaultSubscriptionStatus,
        vaultSubscriptionExpiresAt: bankUsersTable.vaultSubscriptionExpiresAt,
      })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, userId))
      .for("update");
    if (!user || !(await hasActiveVaultAccess(user, tx))) return false;
    const [session] = await tx
      .select({ id: bankVaultSessionsTable.id })
      .from(bankVaultSessionsTable)
      .where(
        and(
          eq(bankVaultSessionsTable.userId, userId),
          eq(bankVaultSessionsTable.tokenHash, tokenHash),
          gt(bankVaultSessionsTable.expiresAt, new Date()),
        ),
      )
      .limit(1)
      .for("update");
    if (!session) return false;
    await tx
      .update(bankUsersTable)
      .set({
        vaultPasscodeHash: newHash,
        vaultPasscodeFailedAttempts: 0,
        vaultPasscodeLockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(bankUsersTable.id, userId));
    await tx
      .delete(bankVaultSessionsTable)
      .where(eq(bankVaultSessionsTable.userId, userId));
    return true;
  });
}
