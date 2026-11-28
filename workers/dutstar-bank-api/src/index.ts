import { Client } from "pg";

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
        bankingApi: false,
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

    if (url.pathname === "/api/bank/signup-profile" && request.method === "PUT") {
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
