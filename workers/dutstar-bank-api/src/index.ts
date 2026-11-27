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

/**
 * Performs a read-only connectivity check. A fresh pg Client is created for
 * each Worker invocation; Hyperdrive owns the reusable origin connection pool.
 * No customer tables or records are read or changed.
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
    // Never return connection details, credentials, or raw driver errors.
    return false;
  } finally {
    // Release the per-invocation client; Hyperdrive manages origin pooling.
    try {
      await client.end();
    } catch {
      // A failed connection may already have closed the client.
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      const [databaseConnected] = await Promise.all([checkDatabase(env)]);
      const checks = {
        staticAssets: Boolean(env.ASSETS),
        hyperdriveBinding: Boolean(env.DB),
        databaseConnection: databaseConnected,
        clerkJwks: Boolean(env.CLERK_JWKS_URL),
        bankingApi: false,
      };
      const ready = checks.staticAssets
        && checks.hyperdriveBinding
        && checks.databaseConnection
        && checks.clerkJwks;

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

    if (url.pathname.startsWith("/api/")) {
      return json({
        error: "BANKING_API_NOT_READY",
        message: "Banking operations remain disabled until Clerk session verification, database access controls, and financial transaction safeguards pass verification.",
      }, 503);
    }

    if (env.ASSETS) {
      const response = await env.ASSETS.fetch(request);
      if (response.status !== 404) return response;
    }

    return json({ error: "NOT_FOUND" }, 404);
  },
} satisfies ExportedHandler<Env>;
