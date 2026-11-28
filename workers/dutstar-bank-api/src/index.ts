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
