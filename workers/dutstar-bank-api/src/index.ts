import { Client } from "pg";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

export interface Env {
  APP_NAME: string;
  APP_ORIGIN: string;
  APP_ENV: string;
  AUTH_PROVIDER: string;
  DATABASE_PROVIDER: string;
  ASSETS?: Fetcher;
  DB?: Hyperdrive;
  CLERK_JWKS_URL?: string;
  CLERK_ISSUER?: string;
  SESSION_SECRET?: string;
  PAYSTACK_SECRET_KEY?: string;
  PAYSTACK_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  PRIVATE_FILES?: unknown;
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

type ClerkClaims = {
  sub?: string;
  iss?: string;
  exp?: number;
  nbf?: number;
  sid?: string;
  azp?: string;
  fva?: number[];
};

type JwkSet = { keys: JsonWebKey[] };
const jwksCache = new Map<string, { expiresAt: number; keys: JsonWebKey[] }>();

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJwtPart<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

async function getClerkKeys(jwksUrl: string): Promise<JsonWebKey[]> {
  const now = Date.now();
  const cached = jwksCache.get(jwksUrl);
  if (cached && cached.expiresAt > now) return cached.keys;

  const response = await fetch(jwksUrl, {
    headers: { accept: "application/json" },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!response.ok) throw new Error("Clerk key service unavailable");

  const body = await response.json() as JwkSet;
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new Error("Clerk signing keys unavailable");
  }
  jwksCache.set(jwksUrl, { keys: body.keys, expiresAt: now + 5 * 60_000 });
  return body.keys;
}

async function verifyClerkSession(request: Request, env: Env): Promise<ClerkClaims | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!token || !env.CLERK_JWKS_URL || !env.CLERK_ISSUER) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const header = decodeJwtPart<{ alg?: string; kid?: string }>(parts[0]);
    const claims = decodeJwtPart<ClerkClaims>(parts[1]);
    if (header.alg !== "RS256" || !header.kid) return null;

    const now = Math.floor(Date.now() / 1000);
    if (
      claims.iss !== env.CLERK_ISSUER ||
      claims.azp !== env.APP_ORIGIN ||
      typeof claims.sub !== "string" ||
      claims.sub.length === 0 ||
      typeof claims.exp !== "number" ||
      claims.exp <= now ||
      (typeof claims.nbf === "number" && claims.nbf > now + 30)
    ) return null;

    const keyData = (await getClerkKeys(env.CLERK_JWKS_URL))
      .find((key) => key.kid === header.kid && key.kty === "RSA");
    if (!keyData) return null;

    const publicKey = await crypto.subtle.importKey(
      "jwk",
      keyData,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    return valid ? claims : null;
  } catch {
    return null;
  }
}

/**
 * Read-only infrastructure check. Hyperdrive owns the reusable origin pool;
 * this invocation creates and closes its own pg client and only runs SELECT 1.
 */
async function checkDatabase(env: Env): Promise<boolean> {
  if (!env.DB) return false;
  const client = new Client({
    connectionString: env.DB.connectionString,
    connectionTimeoutMillis: 5_000,
    query_timeout: 5_000,
  });
  try {
    await client.connect();
    const result = await client.query<{ ok: number }>("SELECT 1 AS ok");
    return result.rows[0]?.ok === 1;
  } catch {
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      // The connection may already have closed after a failed connect.
    }
  }
}


type DbClient = InstanceType<typeof Client>;

async function withCustomerRead<T>(
  env: Env,
  clerkUserId: string,
  work: (client: DbClient) => Promise<T>,
): Promise<T> {
  if (!env.DB) throw new Error("Database is not configured");
  const client = new Client({
    connectionString: env.DB.connectionString,
    connectionTimeoutMillis: 5_000,
    query_timeout: 8_000,
  });
  let inTransaction = false;
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    inTransaction = true;
    await client.query("SET LOCAL ROLE dutstar_api");
    await client.query(
      "SELECT set_config('app.clerk_user_id', $1, true)",
      [clerkUserId],
    );
    const result = await work(client);
    await client.query("COMMIT");
    inTransaction = false;
    return result;
  } catch (error) {
    if (inTransaction) {
      try { await client.query("ROLLBACK"); } catch { /* connection may be closed */ }
    }
    throw error;
  } finally {
    try { await client.end(); } catch { /* close best-effort */ }
  }
}

const TRANSACTION_PIN_KEY_LENGTH = 64;
const TRANSACTION_PIN_MAX_FAILURES = 5;
const TRANSACTION_PIN_LOCK_MS = 15 * 60 * 1000;

function deriveTransactionPinKey(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(pin, salt, TRANSACTION_PIN_KEY_LENGTH, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

async function hashTransactionPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveTransactionPinKey(pin, salt);
  return `scrypt${salt.toString("hex")}${key.toString("hex")}`;
}

async function matchesTransactionPin(pin: string, encodedHash: string): Promise<boolean> {
  const parts = encodedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt" ||
      !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const expected = Buffer.from(parts[2], "hex");
  const actual = await deriveTransactionPinKey(pin, Buffer.from(parts[1], "hex"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function moneyMinor(value: string | number | bigint | null | undefined): string {
  const amount = BigInt(value ?? 0);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  return `${negative ? "-" : ""}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

function transactionPayload(row: Record<string, unknown>, viewerId: string) {
  const rawType = String(row.type);
  const type = rawType === "transfer"
    ? (row.to_user_id === viewerId ? "transfer_in" : "transfer_out")
    : rawType === "sandbox_credit" ? "simulation_credit"
    : rawType === "admin_funding" && row.from_user_id === viewerId ? "admin_debit"
    : rawType;
  const legacyExternal = rawType === "external_transfer" || rawType === "external_transfer_in";
  return {
    id: row.id,
    reference: row.reference,
    type,
    status: row.status,
    receiptTemplate: row.receipt_template ?? "standard",
    currency: row.currency,
    amount: moneyMinor(row.amount_minor as string),
    fee: moneyMinor(row.fee_minor as string),
    counterparty: legacyExternal ? "Internal ledger" : row.counterparty ?? null,
    description: legacyExternal ? "Prior internal ledger entry" : String(row.description ?? ""),
    mode: "internal_ledger",
    transactionDate: row.transaction_date ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

async function withCustomerWrite<T>(
  env: Env,
  clerkUserId: string,
  work: (client: DbClient) => Promise<T>,
): Promise<T> {
  if (!env.DB) throw new Error("Database is not configured");
  const client = new Client({
    connectionString: env.DB.connectionString,
    connectionTimeoutMillis: 5_000,
    query_timeout: 8_000,
  });
  let inTransaction = false;
  try {
    await client.connect();
    await client.query("BEGIN");
    inTransaction = true;
    await client.query("SET LOCAL ROLE dutstar_api");
    await client.query("SELECT set_config('app.clerk_user_id', $1, true)", [clerkUserId]);
    const result = await work(client);
    await client.query("COMMIT");
    inTransaction = false;
    return result;
  } catch (error) {
    if (inTransaction) {
      try { await client.query("ROLLBACK"); } catch { /* connection may be closed */ }
    }
    throw error;
  } finally {
    try { await client.end(); } catch { /* close best-effort */ }
  }
}

async function customerProfile(client: DbClient, clerkUserId: string) {
  const result = await client.query(
    `SELECT id, email, customer_id, first_name, last_name, address, phone,
            country, date_of_birth, city_of_origin, occupation,
            profile_setup_completed_at, transfer_access_granted,
            (transaction_pin_hash IS NOT NULL) AS transaction_pin_configured,
            account_status, admin_account_tier, testing_mode_disabled,
            vault_subscription_status, vault_subscription_expires_at,
            created_at,
            ARRAY(SELECT x.restriction_type FROM public.bank_restrictions x WHERE x.user_id = bank_users.id AND x.wallet_id IS NULL AND x.status = 'active' AND x.effective_at <= now() AND (x.expires_at IS NULL OR x.expires_at > now())) AS active_restrictions
       FROM public.bank_users
      WHERE id = $1
      LIMIT 1`,
    [clerkUserId],
  );
  return result.rows[0] ?? null;
}

async function customerWallets(client: DbClient, clerkUserId: string) {
  const result = await client.query(
    `SELECT w.id, w.currency,
            CASE WHEN w.status = 'restricted' OR COALESCE(r.frozen, false)
                 THEN 'restricted' ELSE 'active' END AS status,
            (COALESCE(l.balance_minor, 0) - COALESCE(p.reserved_minor, 0))::text AS available_minor,
            COALESCE(p.pending_minor, 0)::text AS pending_minor,
            COALESCE(p.reserved_minor, 0)::text AS reserved_minor
       FROM public.bank_wallets w
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(CASE WHEN side = 'credit' THEN amount_minor ELSE -amount_minor END), 0) AS balance_minor
           FROM public.bank_ledger_entries WHERE wallet_id = w.id
       ) l ON true
       LEFT JOIN LATERAL (
         SELECT
           COALESCE(SUM(CASE WHEN q.type = 'deposit' AND t.to_wallet_id = w.id
                             AND q.status IN ('pending_review','pending_provider_setup')
                             THEN q.amount_minor ELSE 0 END), 0) AS pending_minor,
           COALESCE(SUM(CASE WHEN q.type = 'withdrawal' AND t.from_wallet_id = w.id
                             AND q.status IN ('pending_review','pending_provider_setup')
                             THEN q.amount_minor ELSE 0 END), 0) AS reserved_minor
         FROM public.bank_sandbox_requests q
         JOIN public.bank_transactions t ON t.id = q.transaction_id
         WHERE q.user_id = $1
       ) p ON true
       LEFT JOIN LATERAL (
         SELECT EXISTS (
           SELECT 1 FROM public.bank_restrictions x
            WHERE x.user_id = $1 AND x.wallet_id = w.id
              AND x.restriction_type = 'freeze_wallet' AND x.status = 'active'
              AND x.effective_at <= now()
              AND (x.expires_at IS NULL OR x.expires_at > now())
         ) AS frozen
       ) r ON true
      WHERE w.user_id = $1
      ORDER BY w.currency`,
    [clerkUserId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    currency: row.currency,
    available: moneyMinor(row.available_minor),
    pending: moneyMinor(row.pending_minor),
    reserved: moneyMinor(row.reserved_minor),
    status: row.status,
  }));
}

async function customerTransactions(
  client: DbClient,
  clerkUserId: string,
  url: URL,
  limit: number,
) {
  const conditions = ["(from_user_id = $1 OR to_user_id = $1 OR initiated_by_user_id = $1)"];
  const values: unknown[] = [clerkUserId];
  const currency = url.searchParams.get("currency");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search")?.trim();
  if (currency && ["USD","EUR","GBP","NGN","CAD","AUD"].includes(currency)) {
    values.push(currency);
    conditions.push(`currency = ${values.length}`);
  }
  if (status && ["completed","pending","failed","rejected","reversed"].includes(status)) {
    values.push(status);
    conditions.push(`status = ${values.length}`);
  }
  if (search) {
    values.push(`%${search.slice(0, 80)}%`);
    conditions.push(`(reference ILIKE ${values.length} OR counterparty ILIKE ${values.length} OR description ILIKE ${values.length})`);
  }
  values.push(limit);
  const result = await client.query(
    `SELECT id, reference, type, status, receipt_template, currency,
            amount_minor::text, fee_minor::text, from_user_id, to_user_id,
            counterparty, description, transaction_date, created_at
       FROM public.bank_transactions
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT ${values.length}`,
    values,
  );
  return result.rows.map((row) => transactionPayload(row, clerkUserId));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if ((url.pathname === "/health" || url.pathname === "/api/healthz") && request.method === "GET") {
      const databaseConnected = await checkDatabase(env);
      const checks = {
        staticAssets: Boolean(env.ASSETS),
        hyperdriveBinding: Boolean(env.DB),
        databaseConnection: databaseConnected,
        clerkJwksConfigured: Boolean(env.CLERK_JWKS_URL && env.CLERK_ISSUER),
        bankingApi: Boolean(env.DB && databaseConnected && env.CLERK_JWKS_URL && env.CLERK_ISSUER),
        paystackSubscriptions: Boolean(env.PAYSTACK_SECRET_KEY && (env.PAYSTACK_WEBHOOK_SECRET || env.PAYSTACK_SECRET_KEY)),
        privateFileStorage: Boolean(env.PRIVATE_FILES),
        emailDelivery: Boolean(env.RESEND_API_KEY),
      };
      const ready = checks.staticAssets
        && checks.hyperdriveBinding
        && checks.databaseConnection
        && checks.clerkJwksConfigured;
      return json({
        service: env.APP_NAME,
        origin: env.APP_ORIGIN,
        environment: env.APP_ENV,
        authProvider: env.AUTH_PROVIDER,
        databaseProvider: env.DATABASE_PROVIDER,
        status: ready ? "infrastructure_configured" : "setup_required",
        checks,
      }, ready ? 200 : 503);
    }

    // A minimal identity probe: validates Clerk's signature and core claims.
    // It deliberately does not query customer records or grant banking access.
    if (url.pathname === "/api/session" && request.method === "GET") {
      const claims = await verifyClerkSession(request, env);
      if (!claims) return json({ error: "UNAUTHENTICATED" }, 401);
      return json({
        authenticated: true,
        userId: claims.sub,
        sessionId: claims.sid ?? null,
      });
    }

    if (url.pathname === "/api/bank/dashboard" && request.method === "GET") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      try {
        const dashboard = await withCustomerRead(env, claims.sub, async (client) => {
          const profile = await customerProfile(client, claims.sub!);
          if (!profile) return null;
          const accountStatus = profile.account_status === "suspended" || profile.active_restrictions.includes("suspend_user")
            ? "suspended"
            : profile.account_status === "restricted" || profile.active_restrictions.length > 0
              ? "restricted"
              : "active";
          const wallets = await customerWallets(client, claims.sub!);
          const recentTransactions = await customerTransactions(client, claims.sub!, url, 10);
          const tierId = ["silver","gold","bronze"].includes(profile.admin_account_tier) ? profile.admin_account_tier : "standard";
          const tierNames: Record<string,string> = { standard: "Standard 🏦", silver: "Silver", gold: "Gold", bronze: "Bronze" };
          return {
            profile: {
              id: profile.id, email: profile.email, customerId: profile.customer_id,
              firstName: profile.first_name, lastName: profile.last_name, address: profile.address,
              phone: profile.phone, country: profile.country, dateOfBirth: profile.date_of_birth,
              cityOfOrigin: profile.city_of_origin, occupation: profile.occupation,
              profileSetupComplete: Boolean(profile.profile_setup_completed_at),
              transferAccessGranted: Boolean(profile.transfer_access_granted),
              transactionPinConfigured: Boolean(profile.transaction_pin_configured),
              accountStatus,
              vaultSubscriptionActive: profile.vault_subscription_status === "active" && profile.vault_subscription_expires_at && new Date(profile.vault_subscription_expires_at).getTime() > Date.now(),
              vaultAccessActive: false, vaultAccessSource: "none",
              depositAllowed: false, withdrawalAllowed: false,
              accountTier: { id: tierId, name: tierNames[tierId], source: profile.admin_account_tier ? "admin_assignment" : "default" },
              testingMode: false,
              createdAt: profile.created_at,
            },
            wallets, recentTransactions, referenceCurrency: "USD", internalLedger: true,
          };
        });
        if (!dashboard) return json({ error: "BANK_ACCOUNT_NOT_FOUND" }, 404);
        return json(dashboard);
      } catch {
        return json({ error: "BANK_DASHBOARD_UNAVAILABLE" }, 503);
      }
    }

    if (url.pathname === "/api/bank/me" && request.method === "GET") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      try {
        const profile = await withCustomerRead(env, claims.sub, (client) => customerProfile(client, claims.sub!));
        if (!profile) return json({ error: "BANK_ACCOUNT_NOT_FOUND", message: "Your bank profile is not yet linked. Contact support to complete account linking." }, 404);
        return json({
          id: profile.id, email: profile.email, customerId: profile.customer_id,
          firstName: profile.first_name, lastName: profile.last_name, address: profile.address,
          phone: profile.phone, country: profile.country, dateOfBirth: profile.date_of_birth,
          cityOfOrigin: profile.city_of_origin, occupation: profile.occupation,
          profileSetupComplete: Boolean(profile.profile_setup_completed_at),
          transferAccessGranted: Boolean(profile.transfer_access_granted),
          transactionPinConfigured: Boolean(profile.transaction_pin_configured),
          accountStatus: profile.account_status === "suspended" || profile.active_restrictions.includes("suspend_user") ? "suspended" : profile.account_status === "restricted" || profile.active_restrictions.length > 0 ? "restricted" : "active",
          vaultSubscriptionActive: profile.vault_subscription_status === "active" && profile.vault_subscription_expires_at && new Date(profile.vault_subscription_expires_at).getTime() > Date.now(),
          vaultAccessActive: false, vaultAccessSource: "none",
          depositAllowed: false, withdrawalAllowed: false,
          accountTier: { id: ["silver","gold","bronze"].includes(profile.admin_account_tier) ? profile.admin_account_tier : "standard", name: ({standard:"Standard 🏦",silver:"Silver",gold:"Gold",bronze:"Bronze"} as Record<string,string>)[profile.admin_account_tier] ?? "Standard 🏦", source: profile.admin_account_tier ? "admin_assignment" : "default" },
          createdAt: profile.created_at,
        });
      } catch {
        return json({ error: "BANK_PROFILE_UNAVAILABLE" }, 503);
      }
    }

    if ((url.pathname === "/api/bank/signup-profile" || url.pathname === "/api/bank/profile") && request.method === "PUT") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "INVALID_JSON" }, 400); }
      const allowed = new Set(["firstName","lastName","address","phone","country","cityOfOrigin","dateOfBirth","occupation","acceptedTerms"]);
      if (Object.keys(body).some((key) => !allowed.has(key))) return json({ error: "INVALID_PROFILE_FIELDS" }, 400);
      const normalizeName = (value: unknown) => typeof value === "string" && value.trim().length > 0 &&
        value.trim().length <= 80 && /\p{L}/u.test(value) && !/[\p{Cc}\p{Cf}]/u.test(value)
        ? value.trim() : null;
      const firstName = normalizeName(body.firstName);
      const lastName = normalizeName(body.lastName);
      if (!firstName || !lastName) return json({ error: "FIRST_AND_LAST_NAME_REQUIRED" }, 400);
      const validText = (value: unknown, max: number) => typeof value === "string" &&
        value.trim().length > 0 && value.trim().length <= max &&
        /^[\p{L}\p{M}\p{N} .,'’()&/-]+$/u.test(value.trim()) ? value.trim() : null;
      const optionalText = (key: string, max: number) => {
        if (!(key in body)) return undefined;
        if (body[key] === null) return null;
        return validText(body[key], max);
      };
      const address = optionalText("address", 1024);
      const country = optionalText("country", 1024);
      const cityOfOrigin = optionalText("cityOfOrigin", 1024);
      const occupation = optionalText("occupation", 1024);
      if ((address === null && body.address !== null) || (country === null && body.country !== null) ||
          (cityOfOrigin === null && body.cityOfOrigin !== null) || (occupation === null && body.occupation !== null)) {
        return json({ error: "INVALID_PROFILE_TEXT" }, 400);
      }
      let phone: string | null | undefined;
      if ("phone" in body) {
        if (body.phone === null) phone = null;
        else if (typeof body.phone === "string") {
          const v = body.phone.trim(), digits = v.replace(/\D/g, "").length;
          if (!v || v.length > 1024 || !/^\+?[0-9(). -]+$/.test(v) || digits < 7 || digits > 15) {
            return json({ error: "INVALID_PHONE" }, 400);
          }
          phone = v;
        } else return json({ error: "INVALID_PHONE" }, 400);
      }
      let dateOfBirth: string | null | undefined;
      if ("dateOfBirth" in body) {
        if (body.dateOfBirth === null) dateOfBirth = null;
        else if (typeof body.dateOfBirth === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth) &&
          Number.isFinite(new Date(body.dateOfBirth + "T00:00:00.000Z").getTime()) &&
          new Date(body.dateOfBirth + "T00:00:00.000Z").toISOString().slice(0,10) === body.dateOfBirth &&
          body.dateOfBirth <= new Date().toISOString().slice(0,10)) dateOfBirth = body.dateOfBirth;
        else return json({ error: "INVALID_DATE_OF_BIRTH" }, 400);
      }
      if ("acceptedTerms" in body && typeof body.acceptedTerms !== "boolean") return json({ error: "INVALID_ACCEPTED_TERMS" }, 400);
      try {
        const result = await withCustomerWrite(env, claims.sub, (client) => client.query(
          `UPDATE public.bank_users
              SET first_name = $3, last_name = $4,
                  address = CASE WHEN $4 THEN $5 ELSE address END,
                  phone = CASE WHEN $6 THEN $7 ELSE phone END,
                  country = CASE WHEN $8 THEN $9 ELSE country END,
                  city_of_origin = CASE WHEN $10 THEN $11 ELSE city_of_origin END,
                  date_of_birth = CASE WHEN $12 THEN $13::date ELSE date_of_birth END,
                  occupation = CASE WHEN $14 THEN $15 ELSE occupation END,
                  profile_setup_completed_at = now(),
                  accepted_terms_at = CASE WHEN $16 THEN now() ELSE accepted_terms_at END,
                  updated_at = now()
            WHERE id = $1 AND profile_setup_completed_at IS NULL
            RETURNING id, email, customer_id, first_name, last_name, address, phone,
              country, city_of_origin, date_of_birth, occupation, profile_setup_completed_at,
              transfer_access_granted, (transaction_pin_hash IS NOT NULL) AS transaction_pin_configured,
              account_status, created_at`,
          [claims.sub, firstName, lastName,
           address !== undefined, address ?? null, phone !== undefined, phone ?? null,
           country !== undefined, country ?? null, cityOfOrigin !== undefined, cityOfOrigin ?? null,
           dateOfBirth !== undefined, dateOfBirth ?? null, occupation !== undefined, occupation ?? null,
           body.acceptedTerms === true],
        ));
        const user = result.rows[0];
        if (!user) return json({ error: "PROFILE_SETUP_ALREADY_COMPLETED_OR_ACCOUNT_NOT_FOUND" }, 409);
        return json({
          id: user.id, email: user.email, customerId: user.customer_id,
          firstName: user.first_name, lastName: user.last_name, address: user.address,
          phone: user.phone, country: user.country, cityOfOrigin: user.city_of_origin,
          dateOfBirth: user.date_of_birth, occupation: user.occupation,
          profileSetupComplete: Boolean(user.profile_setup_completed_at),
          transferAccessGranted: Boolean(user.transfer_access_granted),
          transactionPinConfigured: Boolean(user.transaction_pin_configured),
          accountStatus: user.account_status, createdAt: user.created_at,
        });
      } catch { return json({ error: "BANK_PROFILE_UPDATE_UNAVAILABLE" }, 503); }
    }

    if (url.pathname === "/api/bank/transaction-pin" && request.method === "PUT") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      let body: { pin?: unknown; currentPin?: unknown };
      try { body = await request.json() as typeof body; }
      catch { return json({ error: "INVALID_JSON" }, 400); }
      if (typeof body.pin !== "string" || !/^[0-9]{6}$/.test(body.pin) ||
          (body.currentPin !== undefined && (typeof body.currentPin !== "string" || !/^[0-9]{6}$/.test(body.currentPin)))) {
        return json({ error: "INVALID_TRANSACTION_PIN" }, 400);
      }
      try {
        const result = await withCustomerWrite(env, claims.sub, async (client) => {
          const selected = await client.query(
            `SELECT transaction_pin_hash, transaction_pin_failed_attempts, transaction_pin_locked_until
               FROM public.bank_users WHERE id = $1 FOR UPDATE`,
            [claims.sub],
          );
          const user = selected.rows[0];
          if (!user) return "missing_user" as const;
          if (user.transaction_pin_hash) {
            if (!body.currentPin) return "current_pin_required" as const;
            if (user.transaction_pin_locked_until && new Date(user.transaction_pin_locked_until).getTime() > Date.now()) {
              return "locked" as const;
            }
            const valid = await matchesTransactionPin(body.currentPin, String(user.transaction_pin_hash));
            if (!valid) {
              const attempts = Number(user.transaction_pin_failed_attempts ?? 0) + 1;
              const locked = attempts >= TRANSACTION_PIN_MAX_FAILURES;
              await client.query(
                `UPDATE public.bank_users
                    SET transaction_pin_failed_attempts = $2,
                        transaction_pin_locked_until = $3,
                        updated_at = now()
                  WHERE id = $1`,
                [claims.sub, locked ? 0 : attempts, locked ? new Date(Date.now() + TRANSACTION_PIN_LOCK_MS) : null],
              );
              return locked ? "locked" as const : "invalid" as const;
            }
          }
          const encoded = await hashTransactionPin(body.pin);
          await client.query(
            `UPDATE public.bank_users
                SET transaction_pin_hash = $2,
                    transaction_pin_failed_attempts = 0,
                    transaction_pin_locked_until = NULL,
                    updated_at = now()
              WHERE id = $1`,
            [claims.sub, encoded],
          );
          return "updated" as const;
        });
        if (result === "updated") return json({ configured: true });
        if (result === "current_pin_required") return json({ error: "CURRENT_PIN_REQUIRED" }, 400);
        if (result === "locked") return json({ error: "PIN_LOCKED", retryAfterSeconds: 900 }, 429);
        if (result === "invalid") return json({ error: "CURRENT_PIN_INCORRECT" }, 403);
        return json({ error: "BANK_ACCOUNT_NOT_FOUND" }, 404);
      } catch { return json({ error: "TRANSACTION_PIN_UPDATE_UNAVAILABLE" }, 503); }
    }


    // Vault recovery requires a recent first-factor verification performed by Clerk.
    // The email OTP is issued and checked by Clerk; the Worker never generates or emails codes.
    if (
      (url.pathname === "/api/bank/vault/passcode-reset/complete-otp" ||
       url.pathname === "/api/bank/vault/passcode-reset/complete") &&
      request.method === "POST"
    ) {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      const firstFactorAge = Array.isArray(claims.fva) ? claims.fva[0] : undefined;
      if (typeof firstFactorAge !== "number" || firstFactorAge < 0 || firstFactorAge > 300) {
        return json({ error: "CLERK_EMAIL_OTP_REQUIRED" }, 403);
      }
      if (!env.SESSION_SECRET) return json({ error: "VAULT_SECURITY_NOT_CONFIGURED" }, 503);
      let body: { customerId?: unknown; newPasscode?: unknown; passcode?: unknown };
      try { body = await request.json() as typeof body; }
      catch { return json({ error: "INVALID_JSON" }, 400); }
      const passcode = typeof body.newPasscode === "string" ? body.newPasscode : body.passcode;
      if (
        typeof passcode !== "string" || !/^\\d{6,12}$/.test(passcode) ||
        (body.customerId !== undefined &&
          (typeof body.customerId !== "string" || !/^[A-Za-z0-9]{7}$/.test(body.customerId)))
      ) return json({ error: "INVALID_RECOVERY_INPUT" }, 400);
      try {
        const salt = randomBytes(16);
        const encoded = await new Promise<string>((resolve, reject) => {
          scryptCallback(`${passcode}:${env.SESSION_SECRET}`, salt, 64,
            (error, key) => error ? reject(error) : resolve(`scrypt$${salt.toString("hex")}$${(key as Buffer).toString("hex")}`));
        });
        const updated = await withCustomerWrite(env, claims.sub, async (client) => {
          const profile = await client.query(
            `SELECT customer_id FROM public.bank_users WHERE id = $1 FOR UPDATE`,
            [claims.sub],
          );
          if (!profile.rows[0]) return "not_found" as const;
          if (
            typeof body.customerId === "string" &&
            String(profile.rows[0].customer_id ?? "").toUpperCase() !== body.customerId.toUpperCase()
          ) return "customer_mismatch" as const;
          await client.query(
            `UPDATE public.bank_users
                SET vault_passcode_hash = $2,
                    vault_passcode_failed_attempts = 0,
                    vault_passcode_locked_until = NULL,
                    updated_at = now()
              WHERE id = $1`,
            [claims.sub, encoded],
          );
          await client.query("DELETE FROM public.bank_vault_sessions WHERE user_id = $1", [claims.sub]);
          // Remove legacy recovery records; Clerk is the sole OTP authority.
          await client.query("DELETE FROM public.bank_vault_passcode_reset_tokens WHERE user_id = $1", [claims.sub]);
          return "updated" as const;
        });
        if (updated === "not_found") return json({ error: "BANK_ACCOUNT_NOT_FOUND" }, 404);
        if (updated === "customer_mismatch") return json({ error: "CUSTOMER_ID_MISMATCH" }, 403);
        return json({ passcodeReset: true, sessionsRevoked: true, recoveryProvider: "clerk" });
      } catch {
        return json({ error: "VAULT_PASSCODE_RESET_FAILED" }, 503);
      }
    }

    if (url.pathname === "/api/bank/vault/session" && request.method === "POST") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      if (!env.SESSION_SECRET) return json({ error: "VAULT_SECURITY_NOT_CONFIGURED" }, 503);
      let body: { passcode?: unknown; rememberDevice?: unknown };
      try { body = await request.json() as typeof body; }
      catch { return json({ error: "INVALID_JSON" }, 400); }
      if (typeof body.passcode !== "string" || !/^\d{6,12}$/.test(body.passcode) ||
          (body.rememberDevice !== undefined && typeof body.rememberDevice !== "boolean")) {
        return json({ error: "INVALID_VAULT_PASSCODE" }, 400);
      }
      try {
        const result = await withCustomerWrite(env, claims.sub, async (client) => {
          const selected = await client.query(
            `SELECT vault_passcode_hash, vault_passcode_failed_attempts, vault_passcode_locked_until,
                    vault_subscription_status, vault_subscription_expires_at
               FROM public.bank_users WHERE id = $1 FOR UPDATE`,
            [claims.sub],
          );
          const user = selected.rows[0];
          if (!user) return { status: "missing" as const };
          const now = Date.now();
          if (user.vault_passcode_locked_until && new Date(user.vault_passcode_locked_until).getTime() > now) {
            return { status: "locked" as const };
          }
          if (!user.vault_passcode_hash) return { status: "not_configured" as const };
          const entitlement = await client.query(
            `SELECT 1 FROM public.bank_vault_admin_entitlements
              WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > now()) LIMIT 1`,
            [claims.sub],
          );
          const subscribed = user.vault_subscription_status === "active" &&
            user.vault_subscription_expires_at &&
            new Date(user.vault_subscription_expires_at).getTime() > now;
          if (!subscribed && entitlement.rowCount === 0) return { status: "no_access" as const };
          const parts = String(user.vault_passcode_hash).split("$");
          if (parts.length !== 3 || parts[0] !== "scrypt" ||
              !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) {
            return { status: "invalid_hash" as const };
          }
          const actual = await new Promise<Buffer>((resolve, reject) => {
            scryptCallback(`${body.passcode as string}:${env.SESSION_SECRET}`,
              Buffer.from(parts[1], "hex"), 64, (error, key) => error ? reject(error) : resolve(key as Buffer));
          });
          const expected = Buffer.from(parts[2], "hex");
          const valid = actual.length === expected.length && timingSafeEqual(actual, expected);
          if (!valid) {
            const attempts = Number(user.vault_passcode_failed_attempts ?? 0) + 1;
            const locked = attempts >= 5;
            await client.query(
              `UPDATE public.bank_users
                  SET vault_passcode_failed_attempts = $2,
                      vault_passcode_locked_until = $3, updated_at = now()
                WHERE id = $1`,
              [claims.sub, locked ? 0 : attempts, locked ? new Date(now + 15 * 60_000) : null],
            );
            return { status: locked ? "locked" as const : "invalid" as const };
          }
          const tokenBytes = randomBytes(32);
          const token = tokenBytes.toString("base64url");
          const tokenHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
          const hashHex = Array.from(new Uint8Array(tokenHash), (b) => b.toString(16).padStart(2, "0")).join("");
          const expiresAt = new Date(now + (body.rememberDevice === true ? 7 * 24 * 60 * 60_000 : 15 * 60_000));
          await client.query("DELETE FROM public.bank_vault_sessions WHERE user_id = $1", [claims.sub]);
          await client.query(
            `INSERT INTO public.bank_vault_sessions (user_id, token_hash, expires_at)
             VALUES ($1, $2, $3)`,
            [claims.sub, hashHex, expiresAt],
          );
          await client.query(
            `UPDATE public.bank_users SET vault_passcode_failed_attempts = 0,
                    vault_passcode_locked_until = NULL, updated_at = now() WHERE id = $1`,
            [claims.sub],
          );
          return { status: "valid" as const, token, expiresAt: expiresAt.toISOString() };
        });
        if (result.status === "valid") return json({ sessionToken: result.token, expiresAt: result.expiresAt });
        if (result.status === "missing") return json({ error: "BANK_ACCOUNT_NOT_FOUND" }, 404);
        if (result.status === "not_configured") return json({ error: "VAULT_PASSCODE_NOT_CONFIGURED" }, 409);
        if (result.status === "no_access") return json({ error: "VAULT_SUBSCRIPTION_REQUIRED" }, 403);
        if (result.status === "locked") return json({ error: "VAULT_PASSCODE_LOCKED", retryAfterSeconds: 900 }, 429);
        if (result.status === "invalid_hash") return json({ error: "VAULT_CREDENTIALS_UNAVAILABLE" }, 503);
        return json({ error: "VAULT_PASSCODE_INCORRECT" }, 403);
      } catch { return json({ error: "VAULT_SESSION_UNAVAILABLE" }, 503); }
    }

    if (url.pathname === "/api/bank/vault/session/lock" && request.method === "POST") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      const token = request.headers.get("x-dutstar-vault-session") ?? "";
      if (!token) return json({ locked: true });
      try {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
        const tokenHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
        await withCustomerWrite(env, claims.sub, async (client) => {
          await client.query("DELETE FROM public.bank_vault_sessions WHERE user_id = $1 AND token_hash = $2",
            [claims.sub, tokenHash]);
        });
        return json({ locked: true });
      } catch { return json({ error: "VAULT_SESSION_LOCK_UNAVAILABLE" }, 503); }
    }

    if (url.pathname === "/api/bank/wallets" && request.method === "GET") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      try {
        const wallets = await withCustomerRead(env, claims.sub, (client) => customerWallets(client, claims.sub!));
        return json(wallets);
      } catch {
        return json({ error: "BANK_WALLETS_UNAVAILABLE" }, 503);
      }
    }

    if (url.pathname === "/api/bank/transactions" && request.method === "GET") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      const rawLimit = Number(url.searchParams.get("limit") ?? 25);
      const limit = Number.isInteger(rawLimit) ? Math.max(1, Math.min(rawLimit, 100)) : 25;
      try {
        const transactions = await withCustomerRead(env, claims.sub, (client) => customerTransactions(client, claims.sub!, url, limit));
        return json(transactions);
      } catch {
        return json({ error: "BANK_TRANSACTIONS_UNAVAILABLE" }, 503);
      }
    }

    if ((url.pathname === "/api/bank/notification-preferences" &&
         (request.method === "GET" || request.method === "PATCH"))) {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      const sessionToken = request.headers.get("x-dutstar-vault-session") ?? "";
      if (!sessionToken) return json({ error: "VAULT_SESSION_REQUIRED" }, 403);
      let updates: Record<string, unknown> = {};
      if (request.method === "PATCH") {
        try { updates = await request.json() as Record<string, unknown>; }
        catch { return json({ error: "INVALID_JSON" }, 400); }
        const allowed = ["emailAlertsEnabled", "transferAlertsEnabled", "walletAlertsEnabled", "securityAlertsEnabled"];
        if (!Object.keys(updates).length || Object.keys(updates).some((key) => !allowed.includes(key)) ||
            Object.values(updates).some((value) => typeof value !== "boolean")) {
          return json({ error: "INVALID_NOTIFICATION_PREFERENCES" }, 400);
        }
      }
      try {
        const preferences = await withCustomerWrite(env, claims.sub, async (client) => {
          const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionToken));
          const tokenHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
          const activeSession = await client.query(
            `SELECT 1 FROM public.bank_vault_sessions
              WHERE user_id = $1 AND token_hash = $2 AND expires_at > now() LIMIT 1`,
            [claims.sub, tokenHash],
          );
          if (!activeSession.rowCount) return null;
          if (request.method === "PATCH") {
            await client.query(
              `UPDATE public.bank_users SET
                vault_email_alerts_enabled = COALESCE($2, vault_email_alerts_enabled),
                push_transfer_alerts_enabled = COALESCE($3, push_transfer_alerts_enabled),
                push_wallet_alerts_enabled = COALESCE($4, push_wallet_alerts_enabled),
                push_security_alerts_enabled = COALESCE($5, push_security_alerts_enabled),
                updated_at = now()
               WHERE id = $1`,
              [claims.sub, updates.emailAlertsEnabled ?? null, updates.transferAlertsEnabled ?? null,
               updates.walletAlertsEnabled ?? null, updates.securityAlertsEnabled ?? null],
            );
          }
          const selected = await client.query(
            `SELECT vault_email_alerts_enabled, push_transfer_alerts_enabled,
                    push_wallet_alerts_enabled, push_security_alerts_enabled
               FROM public.bank_users WHERE id = $1 LIMIT 1`,
            [claims.sub],
          );
          const row = selected.rows[0];
          return row ? {
            emailAlertsEnabled: Boolean(row.vault_email_alerts_enabled),
            transferAlertsEnabled: Boolean(row.push_transfer_alerts_enabled),
            walletAlertsEnabled: Boolean(row.push_wallet_alerts_enabled),
            securityAlertsEnabled: Boolean(row.push_security_alerts_enabled),
          } : null;
        });
        if (!preferences) return json({ error: "VAULT_SESSION_EXPIRED" }, 403);
        return json(preferences);
      } catch { return json({ error: "NOTIFICATION_PREFERENCES_UNAVAILABLE" }, 503); }
    }

    if (url.pathname === "/api/bank/notifications" && request.method === "GET") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      try {
        const result = await withCustomerRead(env, claims.sub, (client) => client.query(
          `SELECT id, category, title, body, reference, read_at, created_at
             FROM public.bank_notifications WHERE user_id = $1
            ORDER BY created_at DESC LIMIT 50`,
          [claims.sub],
        ));
        return json(result.rows.map((row) => ({
          id: row.id, category: row.category, title: row.title, body: row.body,
          reference: row.reference, readAt: row.read_at, createdAt: row.created_at,
        })));
      } catch { return json({ error: "BANK_NOTIFICATIONS_UNAVAILABLE" }, 503); }
    }

    if (url.pathname === "/api/bank/notifications" && request.method === "DELETE") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      try {
        const result = await withCustomerWrite(env, claims.sub, (client) => client.query(
          "DELETE FROM public.bank_notifications WHERE user_id = $1 RETURNING id",
          [claims.sub],
        ));
        return json({ deletedCount: result.rowCount ?? 0 });
      } catch { return json({ error: "BANK_NOTIFICATIONS_CLEAR_FAILED" }, 503); }
    }

    const notificationReadMatch = url.pathname.match(/^\/api\/bank\/notifications\/([0-9a-f-]{36})\/read$/i);
    if (notificationReadMatch && request.method === "PATCH") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      try {
        const result = await withCustomerWrite(env, claims.sub, (client) => client.query(
          `UPDATE public.bank_notifications SET read_at = now()
            WHERE id = $1 AND user_id = $2
            RETURNING id, category, title, body, reference, read_at, created_at`,
          [notificationReadMatch[1], claims.sub],
        ));
        const row = result.rows[0];
        if (!row) return json({ error: "NOTIFICATION_NOT_FOUND" }, 404);
        return json({
          id: row.id, category: row.category, title: row.title, body: row.body,
          reference: row.reference, readAt: row.read_at, createdAt: row.created_at,
        });
      } catch { return json({ error: "BANK_NOTIFICATION_READ_FAILED" }, 503); }
    }

    if (url.pathname === "/api/bank/support/conversations" && request.method === "GET") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      try {
        const result = await withCustomerRead(env, claims.sub, (client) => client.query(
          `SELECT c.id, c.subject, c.category, c.transfer_reference, c.status,
                  c.customer_unread, c.last_message_at, c.created_at, c.updated_at,
                  (SELECT left(m.body, 160) FROM public.bank_support_messages m
                    WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_preview
             FROM public.bank_support_conversations c
            WHERE c.user_id = $1 AND c.category = 'general'
            ORDER BY c.last_message_at DESC LIMIT 100`,
          [claims.sub],
        ));
        return json({ conversations: result.rows.map((row) => ({
          id: row.id, subject: row.subject, category: "general",
          transferReference: row.transfer_reference, status: row.status,
          customerUnread: row.customer_unread, lastMessagePreview: row.last_message_preview,
          lastMessageAt: row.last_message_at, createdAt: row.created_at, updatedAt: row.updated_at,
        })) });
      } catch { return json({ error: "SUPPORT_CONVERSATIONS_UNAVAILABLE" }, 503); }
    }

    if (url.pathname === "/api/bank/support/conversations" && request.method === "POST") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "INVALID_JSON" }, 400); }
      const subject = typeof body.subject === "string" ? body.subject.trim() : "";
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (Object.keys(body).some((key) => !["subject","message","category"].includes(key)) ||
          !subject || subject.length > 120 || !message || message.length > 4000 ||
          (body.category !== undefined && body.category !== "general")) {
        return json({ error: "INVALID_SUPPORT_CONVERSATION" }, 400);
      }
      try {
        const created = await withCustomerWrite(env, claims.sub, async (client) => {
          const conversation = await client.query(
            `INSERT INTO public.bank_support_conversations
              (user_id, subject, category, status, customer_unread, admin_unread, last_message_at, updated_at)
             VALUES ($1,$2,'general','open',false,true,now(),now())
             RETURNING id, subject, status, customer_unread, last_message_at, created_at, updated_at`,
            [claims.sub, subject],
          );
          const row = conversation.rows[0];
          const messageResult = await client.query(
            `INSERT INTO public.bank_support_messages
              (conversation_id, sender_user_id, sender_role, body)
             VALUES ($1,$2,'customer',$3) RETURNING id, conversation_id, sender_role, body, created_at`,
            [row.id, claims.sub, message],
          );
          return { conversation: row, message: messageResult.rows[0] };
        });
        return json({ conversation: {
          id: created.conversation.id, subject: created.conversation.subject, status: created.conversation.status,
          customerUnread: created.conversation.customer_unread,
          lastMessagePreview: created.message.body.slice(0,160),
          lastMessageAt: created.conversation.last_message_at,
          createdAt: created.conversation.created_at, updatedAt: created.conversation.updated_at,
        } }, 201);
      } catch { return json({ error: "SUPPORT_CONVERSATION_CREATE_FAILED" }, 503); }
    }

    const supportMessagesMatch = url.pathname.match(/^\/api\/bank\/support\/conversations\/([0-9a-f-]{36})\/messages$/i);
    if (supportMessagesMatch && request.method === "GET") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      try {
        const result = await withCustomerRead(env, claims.sub, (client) => client.query(
          `SELECT m.id, m.conversation_id, m.sender_role, m.body, m.created_at
             FROM public.bank_support_messages m
             JOIN public.bank_support_conversations c ON c.id = m.conversation_id
            WHERE c.id = $1 AND c.user_id = $2 AND c.category = 'general'
            ORDER BY m.created_at ASC LIMIT 500`,
          [supportMessagesMatch[1], claims.sub],
        ));
        return json({ messages: result.rows.map((row) => ({
          id: row.id, conversationId: row.conversation_id, senderRole: row.sender_role,
          senderName: row.sender_role === "customer" ? "You" : "DUTSTAR support",
          body: row.body, createdAt: row.created_at,
        })) });
      } catch { return json({ error: "SUPPORT_MESSAGES_UNAVAILABLE" }, 503); }
    }

    if (supportMessagesMatch && request.method === "POST") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "INVALID_JSON" }, 400); }
      const message = typeof body.body === "string" ? body.body.trim() : "";
      if (Object.keys(body).length !== 1 || !message || message.length > 4000) {
        return json({ error: "INVALID_SUPPORT_MESSAGE" }, 400);
      }
      try {
        const created = await withCustomerWrite(env, claims.sub, async (client) => {
          const conversation = await client.query(
            `SELECT id FROM public.bank_support_conversations
              WHERE id = $1 AND user_id = $2 AND category = 'general'
              FOR UPDATE`,
            [supportMessagesMatch[1], claims.sub],
          );
          if (!conversation.rows[0]) return null;
          const result = await client.query(
            `INSERT INTO public.bank_support_messages
              (conversation_id, sender_user_id, sender_role, body)
             VALUES ($1,$2,'customer',$3)
             RETURNING id, conversation_id, sender_role, body, created_at`,
            [supportMessagesMatch[1], claims.sub, message],
          );
          await client.query(
            `UPDATE public.bank_support_conversations
                SET customer_unread = false, admin_unread = true,
                    last_message_at = now(), updated_at = now()
              WHERE id = $1 AND user_id = $2`,
            [supportMessagesMatch[1], claims.sub],
          );
          return result.rows[0];
        });
        if (!created) return json({ error: "SUPPORT_CONVERSATION_NOT_FOUND_OR_CLOSED" }, 404);
        return json({ message: {
          id: created.id, conversationId: created.conversation_id, senderRole: created.sender_role,
          senderName: "You", body: created.body, createdAt: created.created_at,
        } }, 201);
      } catch { return json({ error: "SUPPORT_MESSAGE_SEND_FAILED" }, 503); }
    }

    const supportReadMatch = url.pathname.match(/^\/api\/bank\/support\/conversations\/([0-9a-f-]{36})\/read$/i);
    if (supportReadMatch && request.method === "POST") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      try {
        const result = await withCustomerWrite(env, claims.sub, (client) => client.query(
          `UPDATE public.bank_support_conversations SET customer_unread = false, updated_at = now()
            WHERE id = $1 AND user_id = $2 AND category = 'general' RETURNING id`,
          [supportReadMatch[1], claims.sub],
        ));
        return result.rowCount ? json({ markedRead: true }) : json({ error: "SUPPORT_CONVERSATION_NOT_FOUND" }, 404);
      } catch { return json({ error: "SUPPORT_READ_UPDATE_FAILED" }, 503); }
    }

    if (url.pathname === "/api/bank/personal-finance/loan-applications" && request.method === "GET") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      try {
        const result = await withCustomerRead(env, claims.sub, (client) => client.query(
          `SELECT id, requested_amount_minor::text, currency, purpose, term_months,
                  status, submitted_at, created_at, updated_at
             FROM public.bank_finance_loan_applications
            WHERE user_id = $1 ORDER BY submitted_at DESC LIMIT 100`,
          [claims.sub],
        ));
        return json(result.rows.map((row) => ({
          id: row.id, requestedAmountMinor: row.requested_amount_minor,
          currency: row.currency, purpose: row.purpose, termMonths: row.term_months,
          status: row.status, submittedAt: row.submitted_at,
          createdAt: row.created_at, updatedAt: row.updated_at,
        })));
      } catch { return json({ error: "FINANCE_LOAN_APPLICATIONS_UNAVAILABLE" }, 503); }
    }

    if (url.pathname === "/api/bank/personal-finance/loan-applications" && request.method === "POST") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "INVALID_JSON" }, 400); }
      const currencies = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD"];
      const amount = typeof body.requestedAmountMinor === "string" ? body.requestedAmountMinor : "";
      const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "";
      const termMonths = Number(body.termMonths);
      if (Object.keys(body).some((key) => !["requestedAmountMinor", "currency", "purpose", "termMonths"].includes(key)) ||
          !/^[0-9]{1,19}$/.test(amount) || BigInt(amount) <= 0n ||
          !currencies.includes(String(body.currency)) || !purpose || purpose.length > 160 ||
          !Number.isInteger(termMonths) || termMonths < 1 || termMonths > 600) {
        return json({ error: "INVALID_FINANCE_LOAN_APPLICATION" }, 400);
      }
      try {
        const result = await withCustomerWrite(env, claims.sub, (client) => client.query(
          `INSERT INTO public.bank_finance_loan_applications
             (user_id, requested_amount_minor, currency, purpose, term_months)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, requested_amount_minor::text, currency, purpose, term_months,
             status, submitted_at, created_at, updated_at`,
          [claims.sub, amount, body.currency, purpose, termMonths],
        ));
        const row = result.rows[0];
        if (!row) return json({ error: "FINANCE_LOAN_APPLICATION_SAVE_FAILED" }, 503);
        return json({
          id: row.id, requestedAmountMinor: row.requested_amount_minor,
          currency: row.currency, purpose: row.purpose, termMonths: row.term_months,
          status: row.status, submittedAt: row.submitted_at,
          createdAt: row.created_at, updatedAt: row.updated_at,
        }, 201);
      } catch { return json({ error: "FINANCE_LOAN_APPLICATION_SAVE_FAILED" }, 503); }
    }

    const loanApplicationMatch = url.pathname.match(/^\/api\/bank\/personal-finance\/loan-applications\/([0-9a-f-]{36})$/i);
    if (loanApplicationMatch && request.method === "PATCH") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "INVALID_JSON" }, 400); }
      if (Object.keys(body).length !== 1 || body.status !== "withdrawn") {
        return json({ error: "INVALID_WITHDRAWAL_REQUEST" }, 400);
      }
      try {
        const result = await withCustomerWrite(env, claims.sub, (client) => client.query(
          `UPDATE public.bank_finance_loan_applications
              SET status = 'withdrawn', updated_at = now()
            WHERE id = $1 AND user_id = $2 AND status = 'submitted'
            RETURNING id, requested_amount_minor::text, currency, purpose, term_months,
              status, submitted_at, created_at, updated_at`,
          [loanApplicationMatch[1], claims.sub],
        ));
        const row = result.rows[0];
        if (!row) return json({ error: "LOAN_APPLICATION_NOT_FOUND_OR_ALREADY_WITHDRAWN" }, 404);
        return json({
          id: row.id, requestedAmountMinor: row.requested_amount_minor,
          currency: row.currency, purpose: row.purpose, termMonths: row.term_months,
          status: row.status, submittedAt: row.submitted_at,
          createdAt: row.created_at, updatedAt: row.updated_at,
        });
      } catch { return json({ error: "FINANCE_LOAN_APPLICATION_WITHDRAW_FAILED" }, 503); }
    }

    if (url.pathname === "/api/bank/personal-finance/accounts" && request.method === "GET") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      try {
        const result = await withCustomerRead(env, claims.sub, (client) => client.query(
          `SELECT id, account_type, name, currency, current_value_minor::text,
                  target_amount_minor::text, opened_on, status, notes, created_at, updated_at
             FROM public.bank_financial_accounts WHERE user_id = $1
            ORDER BY status, updated_at DESC LIMIT 100`,
          [claims.sub],
        ));
        return json(result.rows.map((row) => ({
          id: row.id, type: row.account_type, name: row.name, currency: row.currency,
          currentValueMinor: row.current_value_minor, targetAmountMinor: row.target_amount_minor,
          openedOn: row.opened_on, status: row.status, notes: row.notes,
          createdAt: row.created_at, updatedAt: row.updated_at,
        })));
      } catch { return json({ error: "FINANCIAL_ACCOUNTS_UNAVAILABLE" }, 503); }
    }

    if (url.pathname === "/api/bank/personal-finance/accounts" && request.method === "POST") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "INVALID_JSON" }, 400); }
      const currencies = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD"];
      const currentValue = typeof body.currentValueMinor === "string" ? body.currentValueMinor : "";
      const target = body.targetAmountMinor == null ? null : String(body.targetAmountMinor);
      const validDate = (value: unknown) => typeof value === "string" &&
        /^\\d{4}-\\d{2}-\\d{2}$/.test(value) &&
        Number.isFinite(new Date(value + "T00:00:00.000Z").getTime()) &&
        new Date(value + "T00:00:00.000Z").toISOString().slice(0, 10) === value;
      if (Object.keys(body).some((key) => !["type","name","currency","currentValueMinor","targetAmountMinor","openedOn","notes"].includes(key)) ||
          !["savings","investment"].includes(String(body.type)) ||
          typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120 ||
          !currencies.includes(String(body.currency)) || !/^\\d{1,19}$/.test(currentValue) ||
          (target !== null && (!/^\\d{1,19}$/.test(target) || BigInt(target) <= 0n)) ||
          (body.type === "investment" && target !== null) || !validDate(body.openedOn) ||
          (body.notes !== undefined && body.notes !== null && typeof body.notes !== "string")) {
        return json({ error: "INVALID_FINANCIAL_ACCOUNT" }, 400);
      }
      try {
        const result = await withCustomerWrite(env, claims.sub, (client) => client.query(
          `INSERT INTO public.bank_financial_accounts
            (user_id, account_type, name, currency, current_value_minor, target_amount_minor, opened_on, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING id, account_type, name, currency, current_value_minor::text,
             target_amount_minor::text, opened_on, status, notes, created_at, updated_at`,
          [claims.sub, body.type, body.name.trim(), body.currency, currentValue, target,
           body.openedOn, typeof body.notes === "string" ? body.notes.trim().slice(0,2000) || null : null],
        ));
        const row = result.rows[0];
        if (!row) return json({ error: "FINANCIAL_ACCOUNT_SAVE_FAILED" }, 503);
        return json({
          id: row.id, type: row.account_type, name: row.name, currency: row.currency,
          currentValueMinor: row.current_value_minor, targetAmountMinor: row.target_amount_minor,
          openedOn: row.opened_on, status: row.status, notes: row.notes,
          createdAt: row.created_at, updatedAt: row.updated_at,
        }, 201);
      } catch { return json({ error: "FINANCIAL_ACCOUNT_SAVE_FAILED" }, 503); }
    }

    const financialAccountMatch = url.pathname.match(/^\/api\/bank\/personal-finance\/accounts\/([0-9a-f-]{36})$/i);
    if (financialAccountMatch && request.method === "PATCH") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "INVALID_JSON" }, 400); }
      const allowed = ["name","currentValueMinor","targetAmountMinor","status","notes"];
      if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) {
        return json({ error: "INVALID_FINANCIAL_ACCOUNT_UPDATE" }, 400);
      }
      const sets: string[] = [];
      const values: unknown[] = [financialAccountMatch[1], claims.sub];
      for (const [key, value] of Object.entries(body)) {
        if (key === "name") {
          if (typeof value !== "string" || !value.trim() || value.trim().length > 120) return json({ error: "INVALID_ACCOUNT_NAME" }, 400);
          values.push(value.trim()); sets.push(`name = ${values.length}`);
        } else if (key === "currentValueMinor" || key === "targetAmountMinor") {
          if (value === null && key === "targetAmountMinor") values.push(null);
          else {
            const amount = String(value);
            if (!/^\\d{1,19}$/.test(amount) || (key === "targetAmountMinor" && BigInt(amount) <= 0n)) return json({ error: "INVALID_ACCOUNT_AMOUNT" }, 400);
            values.push(amount);
          }
          sets.push(`${key === "currentValueMinor" ? "current_value_minor" : "target_amount_minor"} = ${values.length}`);
        } else if (key === "status") {
          if (!["active","closed"].includes(String(value))) return json({ error: "INVALID_ACCOUNT_STATUS" }, 400);
          values.push(value); sets.push(`status = ${values.length}`);
        } else if (key === "notes") {
          if (value !== null && typeof value !== "string") return json({ error: "INVALID_ACCOUNT_NOTES" }, 400);
          values.push(value === null ? null : value.trim().slice(0,2000) || null); sets.push(`notes = ${values.length}`);
        }
      }
      sets.push("updated_at = now()");
      try {
        const result = await withCustomerWrite(env, claims.sub, (client) => client.query(
          `UPDATE public.bank_financial_accounts SET ${sets.join(", ")}
            WHERE id = $1 AND user_id = $2
            RETURNING id, account_type, name, currency, current_value_minor::text,
              target_amount_minor::text, opened_on, status, notes, created_at, updated_at`,
          values,
        ));
        const row = result.rows[0];
        if (!row) return json({ error: "FINANCIAL_ACCOUNT_NOT_FOUND" }, 404);
        return json({
          id: row.id, type: row.account_type, name: row.name, currency: row.currency,
          currentValueMinor: row.current_value_minor, targetAmountMinor: row.target_amount_minor,
          openedOn: row.opened_on, status: row.status, notes: row.notes,
          createdAt: row.created_at, updatedAt: row.updated_at,
        });
      } catch { return json({ error: "FINANCIAL_ACCOUNT_UPDATE_FAILED" }, 503); }
    }

    if (url.pathname === "/api/bank/personal-finance/records" && request.method === "GET") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);

      const rawPage = Number(url.searchParams.get("page") ?? 1);
      const rawPageSize = Number(url.searchParams.get("pageSize") ?? 20);
      const page = Number.isInteger(rawPage) ? Math.max(1, Math.min(rawPage, 10_000)) : 1;
      const pageSize = Number.isInteger(rawPageSize) ? Math.max(1, Math.min(rawPageSize, 100)) : 20;
      const kind = url.searchParams.get("kind");
      const currency = url.searchParams.get("currency");
      const allowedKinds = ["expense", "savings", "investment", "loan", "bill"];
      const allowedCurrencies = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD"];
      if (kind && !allowedKinds.includes(kind)) return json({ error: "INVALID_KIND" }, 400);
      if (currency && !allowedCurrencies.includes(currency)) return json({ error: "INVALID_CURRENCY" }, 400);

      try {
        const result = await withCustomerRead(env, claims.sub, async (client) => {
          const filters = ["user_id = $1"];
          const values: unknown[] = [claims.sub];
          if (kind) { values.push(kind); filters.push(`kind = ${values.length}`); }
          if (currency) { values.push(currency); filters.push(`currency = ${values.length}`); }
          const countResult = await client.query(
            `SELECT count(*)::int AS total FROM public.bank_personal_finance_records WHERE ${filters.join(" AND ")}`,
            values,
          );
          values.push(pageSize);
          const limitIndex = values.length;
          values.push((page - 1) * pageSize);
          const records = await client.query(
            `SELECT id, kind, title, category, currency, amount_minor::text,
                    target_amount_minor::text, record_date, due_date, frequency,
                    status, notes, created_at, updated_at
               FROM public.bank_personal_finance_records
              WHERE ${filters.join(" AND ")}
              ORDER BY record_date DESC, created_at DESC
              LIMIT ${limitIndex} OFFSET ${values.length}`,
            values,
          );
          return { records: records.rows, total: countResult.rows[0]?.total ?? 0 };
        });
        return json({
          records: result.records.map((row) => ({
            id: row.id, kind: row.kind, title: row.title, category: row.category,
            currency: row.currency, amountMinor: String(row.amount_minor),
            targetAmountMinor: row.target_amount_minor === null ? null : String(row.target_amount_minor),
            recordDate: row.record_date, dueDate: row.due_date, frequency: row.frequency,
            status: row.status, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
          })),
          total: result.total, page, pageSize,
        });
      } catch {
        return json({ error: "PERSONAL_FINANCE_UNAVAILABLE" }, 503);
      }
    }

    if (url.pathname === "/api/bank/personal-finance/records" && request.method === "POST") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "INVALID_JSON" }, 400); }
      const kinds = ["expense", "savings", "investment", "loan", "bill"];
      const currencies = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD"];
      const frequencies = ["once", "weekly", "monthly", "quarterly", "yearly"];
      const amount = typeof body.amountMinor === "string" ? body.amountMinor : String(body.amountMinor ?? "");
      const target = body.targetAmountMinor == null ? null : String(body.targetAmountMinor);
      if (!kinds.includes(String(body.kind)) || !currencies.includes(String(body.currency)) ||
          typeof body.title !== "string" || !body.title.trim() || body.title.length > 160 ||
          !/^\d+$/.test(amount) || BigInt(amount) < 0n ||
          (body.kind === "expense" && BigInt(amount) === 0n) ||
          typeof body.recordDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.recordDate) ||
          (body.dueDate != null && (typeof body.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate))) ||
          (body.frequency != null && !frequencies.includes(String(body.frequency))) ||
          (body.kind === "savings" && (!target || !/^\d+$/.test(target) || BigInt(target) <= 0n)) ||
          (body.kind !== "savings" && target !== null)) {
        return json({ error: "INVALID_PERSONAL_FINANCE_RECORD" }, 400);
      }
      try {
        const result = await withCustomerWrite(env, claims.sub, async (client) => client.query(
          `INSERT INTO public.bank_personal_finance_records
            (user_id, kind, title, category, currency, amount_minor, target_amount_minor,
             record_date, due_date, frequency, status, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11)
           RETURNING id, kind, title, category, currency, amount_minor::text,
             target_amount_minor::text, record_date, due_date, frequency, status, notes, created_at, updated_at`,
          [claims.sub, body.kind, body.title.trim(), typeof body.category === "string" ? body.category.slice(0,100) : null,
           body.currency, amount, target, body.recordDate, body.dueDate ?? null, body.frequency ?? null,
           typeof body.notes === "string" ? body.notes.slice(0,2000) : null],
        ));
        const row = result.rows[0];
        if (!row) return json({ error: "PERSONAL_FINANCE_SAVE_FAILED" }, 503);
        return json({ record: {
          id: row.id, kind: row.kind, title: row.title, category: row.category, currency: row.currency,
          amountMinor: row.amount_minor, targetAmountMinor: row.target_amount_minor,
          recordDate: row.record_date, dueDate: row.due_date, frequency: row.frequency,
          status: row.status, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
        } }, 201);
      } catch { return json({ error: "PERSONAL_FINANCE_SAVE_FAILED" }, 503); }
    }

    const personalFinanceRecordMatch = url.pathname.match(/^\/api\/bank\/personal-finance\/records\/([0-9a-f-]{36})$/i);
    if (personalFinanceRecordMatch && request.method === "DELETE") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      try {
        const result = await withCustomerWrite(env, claims.sub, (client) => client.query(
          "DELETE FROM public.bank_personal_finance_records WHERE id = $1 AND user_id = $2 RETURNING id",
          [personalFinanceRecordMatch[1], claims.sub],
        ));
        return result.rowCount ? json({ deleted: true }) : json({ error: "RECORD_NOT_FOUND" }, 404);
      } catch { return json({ error: "PERSONAL_FINANCE_DELETE_FAILED" }, 503); }
    }

    if (personalFinanceRecordMatch && request.method === "PATCH") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "INVALID_JSON" }, 400); }
      const allowed: Record<string, string> = {
        title: "title", category: "category", amountMinor: "amount_minor",
        targetAmountMinor: "target_amount_minor", recordDate: "record_date",
        dueDate: "due_date", frequency: "frequency", status: "status", notes: "notes",
      };
      const entries = Object.entries(body).filter(([key]) => Object.hasOwn(allowed, key));
      if (!entries.length || entries.length !== Object.keys(body).length) return json({ error: "INVALID_UPDATE_FIELDS" }, 400);
      const sets: string[] = [];
      const values: unknown[] = [personalFinanceRecordMatch[1], claims.sub];
      for (const [key, value] of entries) {
        if (key === "amountMinor" || key === "targetAmountMinor") {
          const amount = String(value);
          if (!/^\d+$/.test(amount)) return json({ error: "INVALID_AMOUNT" }, 400);
          values.push(amount);
        } else if (key === "status") {
          if (!["active", "paid", "closed"].includes(String(value))) return json({ error: "INVALID_STATUS" }, 400);
          values.push(value);
        } else if (key === "frequency") {
          if (value !== null && !["once", "weekly", "monthly", "quarterly", "yearly"].includes(String(value))) return json({ error: "INVALID_FREQUENCY" }, 400);
          values.push(value);
        } else if (key === "recordDate" || key === "dueDate") {
          if (value !== null && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))) return json({ error: "INVALID_DATE" }, 400);
          values.push(value);
        } else if (key === "title") {
          if (typeof value !== "string" || !value.trim() || value.length > 160) return json({ error: "INVALID_TITLE" }, 400);
          values.push(value.trim());
        } else if (key === "category" || key === "notes") {
          if (value !== null && typeof value !== "string") return json({ error: "INVALID_TEXT_FIELD" }, 400);
          values.push(value === null ? null : String(value).slice(0, key === "notes" ? 2000 : 100));
        }
        sets.push(`${allowed[key]} = ${values.length}`);
      }
      sets.push("updated_at = now()");
      try {
        const result = await withCustomerWrite(env, claims.sub, (client) => client.query(
          `UPDATE public.bank_personal_finance_records SET ${sets.join(", ")}
            WHERE id = $1 AND user_id = $2
            RETURNING id, kind, title, category, currency, amount_minor::text,
              target_amount_minor::text, record_date, due_date, frequency, status, notes, created_at, updated_at`,
          values,
        ));
        const row = result.rows[0];
        if (!row) return json({ error: "RECORD_NOT_FOUND" }, 404);
        return json({ record: {
          id: row.id, kind: row.kind, title: row.title, category: row.category, currency: row.currency,
          amountMinor: row.amount_minor, targetAmountMinor: row.target_amount_minor,
          recordDate: row.record_date, dueDate: row.due_date, frequency: row.frequency,
          status: row.status, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
        } });
      } catch { return json({ error: "PERSONAL_FINANCE_UPDATE_FAILED" }, 503); }
    }


    // Paystack subscription checkout: the browser never supplies an amount.
    if (url.pathname === "/api/bank/vault/subscription/initialize" && request.method === "POST") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      if (!env.PAYSTACK_SECRET_KEY) return json({ error: "PAYSTACK_NOT_CONFIGURED" }, 503);
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "INVALID_JSON" }, 400); }
      const planCode = typeof body.planCode === "string" ? body.planCode.trim() : "";
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(planCode)) return json({ error: "INVALID_PLAN" }, 400);
      try {
        const result = await withCustomerWrite(env, claims.sub, async (client) => {
          const user = await client.query(
            "SELECT email FROM public.bank_users WHERE id = $1 FOR UPDATE", [claims.sub],
          );
          if (!user.rows[0]?.email) return { missing: true as const };
          const plan = await client.query(
            "SELECT plan_code, amount_minor, provider_plan_code, duration_days FROM public.bank_vault_paystack_plans WHERE plan_code = $1 LIMIT 1",
            [planCode],
          );
          const selected = plan.rows[0];
          if (!selected || !/^\\d{1,12}$/.test(String(selected.amount_minor)) ||
              !Number.isInteger(Number(selected.duration_days)) || Number(selected.duration_days) < 1 ||
              Number(selected.duration_days) > 366) return { planMissing: true as const };
          const reference = "DUTSTAR_VAULT_" + crypto.randomUUID().replace(/-/g, "");
          const response = await fetch("https://api.paystack.co/transaction/initialize", {
            method: "POST",
            headers: { authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, "content-type": "application/json" },
            body: JSON.stringify({
              email: user.rows[0].email,
              amount: String(selected.amount_minor),
              currency: "NGN",
              reference,
              ...(selected.provider_plan_code ? { plan: selected.provider_plan_code } : {}),
              metadata: { clerkUserId: claims.sub, planCode: selected.plan_code, product: "dutstar_vault" },
            }),
          });
          const payload = await response.json() as { status?: boolean; message?: string; data?: { authorization_url?: string; reference?: string } };
          if (!response.ok || !payload.status || !payload.data?.authorization_url || payload.data.reference !== reference) {
            return { providerError: true as const };
          }
          await client.query(
            `UPDATE public.bank_users SET vault_subscription_status = 'pending',
               vault_subscription_requested_at = now(), vault_subscription_plan = $2,
               vault_subscription_amount_minor = $3, vault_subscription_payment_reference = $4,
               vault_subscription_payment_status = 'pending', vault_subscription_payment_initialized_at = now(),
               vault_paystack_plan_code = $2, updated_at = now()
             WHERE id = $1`,
            [claims.sub, selected.plan_code, String(selected.amount_minor), reference],
          );
          return { authorizationUrl: payload.data.authorization_url, reference };
        });
        if ("missing" in result) return json({ error: "BANK_ACCOUNT_NOT_FOUND" }, 404);
        if ("planMissing" in result) return json({ error: "SUBSCRIPTION_PLAN_UNAVAILABLE" }, 404);
        if ("providerError" in result) return json({ error: "PAYSTACK_INITIALIZATION_FAILED" }, 502);
        return json(result, 201);
      } catch { return json({ error: "SUBSCRIPTION_INITIALIZATION_UNAVAILABLE" }, 503); }
    }

    async function verifyAndActivatePaystack(reference: string, userId: string, eventKey: string, eventType: string) {
      if (!env.PAYSTACK_SECRET_KEY) return { configured: false as const };
      const verifiedResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, accept: "application/json" },
      });
      const verified = await verifiedResponse.json() as {
        status?: boolean; data?: { status?: string; reference?: string; amount?: number; currency?: string; customer?: { email?: string }; metadata?: { clerkUserId?: string } };
      };
      if (!verifiedResponse.ok || !verified.status || verified.data?.status !== "success" ||
          verified.data.reference !== reference || verified.data.metadata?.clerkUserId !== userId ||
          verified.data.currency !== "NGN" || !Number.isSafeInteger(verified.data.amount)) {
        return { verified: false as const };
      }
      return withCustomerWrite(env, userId, async (client) => {
        const user = await client.query(
          `SELECT email, vault_subscription_amount_minor, vault_subscription_plan
             FROM public.bank_users WHERE id = $1 AND vault_subscription_payment_reference = $2 FOR UPDATE`,
          [userId, reference],
        );
        const row = user.rows[0];
        if (!row || String(row.vault_subscription_amount_minor) !== String(verified.data!.amount) ||
            (verified.data!.customer?.email && verified.data!.customer.email.toLowerCase() !== String(row.email).toLowerCase())) {
          return { verified: false as const };
        }
        const plan = await client.query(
          "SELECT duration_days FROM public.bank_vault_paystack_plans WHERE plan_code = $1 LIMIT 1",
          [row.vault_subscription_plan],
        );
        const days = Number(plan.rows[0]?.duration_days);
        if (!Number.isInteger(days) || days < 1 || days > 366) return { planInvalid: true as const };
        const event = await client.query(
          `INSERT INTO public.bank_vault_paystack_events (event_key, event_type, payment_reference, user_id)
           VALUES ($1,$2,$3,$4) ON CONFLICT (event_key) DO NOTHING RETURNING id`,
          [eventKey, eventType, reference, userId],
        );
        if (event.rowCount) {
          await client.query(
            `UPDATE public.bank_users SET vault_subscription_status = 'active',
               vault_subscription_expires_at = GREATEST(COALESCE(vault_subscription_expires_at, now()), now()) + ($2::text || ' days')::interval,
               vault_subscription_payment_status = 'success', vault_subscription_payment_verified_at = now(),
               updated_at = now() WHERE id = $1`,
            [userId, days],
          );
        }
        return { verified: true as const, alreadyProcessed: !event.rowCount };
      });
    }

    if (url.pathname === "/api/bank/vault/subscription/verify" && request.method === "POST") {
      const claims = await verifyClerkSession(request, env);
      if (!claims?.sub) return json({ error: "UNAUTHENTICATED" }, 401);
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "INVALID_JSON" }, 400); }
      const reference = typeof body.reference === "string" ? body.reference.trim() : "";
      if (!/^[A-Za-z0-9_-]{8,100}$/.test(reference)) return json({ error: "INVALID_REFERENCE" }, 400);
      try {
        const result = await verifyAndActivatePaystack(reference, claims.sub, `payment:${reference}`, "transaction.verify");
        if ("configured" in result) return json({ error: "PAYSTACK_NOT_CONFIGURED" }, 503);
        if ("planInvalid" in result) return json({ error: "SUBSCRIPTION_PLAN_INVALID" }, 409);
        if (!result.verified) return json({ error: "PAYMENT_NOT_VERIFIED" }, 402);
        return json({ active: true, alreadyProcessed: result.alreadyProcessed });
      } catch { return json({ error: "PAYMENT_VERIFICATION_UNAVAILABLE" }, 503); }
    }

    if (url.pathname === "/api/bank/vault/paystack/webhook" && request.method === "POST") {
      const secret = env.PAYSTACK_WEBHOOK_SECRET || env.PAYSTACK_SECRET_KEY;
      if (!secret) return json({ error: "PAYSTACK_WEBHOOK_NOT_CONFIGURED" }, 503);
      const signature = request.headers.get("x-paystack-signature") || "";
      const raw = await request.text();
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
      const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
      const expected = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      if (!/^[a-f0-9]{128}$/i.test(signature) || expected.toLowerCase() !== signature.toLowerCase()) {
        return json({ error: "INVALID_WEBHOOK_SIGNATURE" }, 401);
      }
      let event: { event?: string; data?: { reference?: string; id?: number; metadata?: { clerkUserId?: string } } };
      try { event = JSON.parse(raw) as typeof event; }
      catch { return json({ error: "INVALID_WEBHOOK_JSON" }, 400); }
      if (event.event !== "charge.success" || !event.data?.reference || !event.data.metadata?.clerkUserId) {
        return json({ received: true, ignored: true });
      }
      const userId = event.data.metadata.clerkUserId;
      if (typeof userId !== "string" || userId.length > 255) return json({ error: "INVALID_EVENT_METADATA" }, 400);
      try {
        const eventKey = `payment:${event.data.reference}`;
        const result = await verifyAndActivatePaystack(event.data.reference, userId, eventKey, event.event);
        if ("configured" in result) return json({ error: "PAYSTACK_NOT_CONFIGURED" }, 503);
        if (!result.verified) return json({ error: "PAYMENT_NOT_VERIFIED" }, 422);
        return json({ received: true, alreadyProcessed: result.alreadyProcessed });
      } catch { return json({ error: "WEBHOOK_PROCESSING_FAILED" }, 503); }
    }

    if (url.pathname.startsWith("/api/")) {
      return json({
        error: "BANKING_API_NOT_READY",
        message: "This banking operation is not enabled on the Cloudflare API yet.",
      }, 503);
    }

    if (env.ASSETS) {
      const response = await env.ASSETS.fetch(request);
      if (response.status !== 404) return response;
    }
    return json({ error: "NOT_FOUND" }, 404);
  },
} satisfies ExportedHandler<Env>;
