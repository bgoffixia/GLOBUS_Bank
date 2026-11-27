export interface Env {
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      const ready = Boolean(env.ASSETS && env.DB && env.CLERK_JWKS_URL);
      return json({
        service: "DUTSTAR BANK",
        status: ready ? "infrastructure_configured" : "setup_required",
        checks: {
          staticAssets: Boolean(env.ASSETS),
          postgresHyperdrive: Boolean(env.DB),
          clerkJwks: Boolean(env.CLERK_JWKS_URL),
          bankingApi: false,
        },
      }, ready ? 200 : 503);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({
        error: "BANKING_API_NOT_READY",
        message: "Banking operations remain disabled until the authenticated database adapter and financial controls pass verification.",
      }, 503);
    }

    if (env.ASSETS) {
      const response = await env.ASSETS.fetch(request);
      if (response.status !== 404) return response;
    }

    return json({ error: "NOT_FOUND" }, 404);
  },
} satisfies ExportedHandler<Env>;
