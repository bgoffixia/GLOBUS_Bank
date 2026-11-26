import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";

// Bridge Cloudflare Worker secrets/vars into the existing Express/Drizzle
// modules, which currently read configuration from process.env.
for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
  if (typeof value === "string") process.env[key] = value;
}
process.env.NODE_ENV = "production";
process.env.PORT = "8787";

const [
  { default: app },
  { backfillCustomerIds },
  { expireVaultSubscriptions },
  { sendVaultExpiryReminders },
  { logger },
] = await Promise.all([
  import("./app"),
  import("./lib/bank"),
  import("./lib/bank-vault"),
  import("./lib/vault-expiry-reminders"),
  import("./lib/logger"),
]);

// Cloudflare's supported Express adapter bridges app.listen() to the Worker
// fetch lifecycle. The existing Node entrypoint (index.ts) is not used here.
app.listen(8787);
const expressHandler = httpServerHandler({ port: 8787 });

let initialization: Promise<void> | undefined;
function ensureInitialized(): Promise<void> {
  initialization ??= backfillCustomerIds().then(() => {
    logger.info("Dutstar Bank Worker initialization completed");
  }).catch((error: unknown) => {
    initialization = undefined;
    logger.error({ err: error }, "Dutstar Bank Worker initialization failed");
    throw error;
  });
  return initialization;
}

export default {
  async fetch(request: Request, workerEnv: unknown, ctx: WorkerExecutionContext) {
    try {
      await ensureInitialized();
      return await expressHandler.fetch(request, workerEnv, ctx);
    } catch {
      return Response.json(
        { error: "Service initialization is temporarily unavailable." },
        { status: 503 },
      );
    }
  },

  scheduled(controller: WorkerScheduledController, _workerEnv: unknown, ctx: WorkerExecutionContext) {
    ctx.waitUntil((async () => {
      try {
        await ensureInitialized();
        if (controller.cron === "* * * * *") {
          const expiredCount = await expireVaultSubscriptions();
          if (expiredCount > 0) {
            logger.info({ expiredCount }, "Expired Private Vault subscriptions");
          }
        }
        if (controller.cron === "0 */6 * * *") {
          const result = await sendVaultExpiryReminders();
          logger.info(result, "Processed Private Vault expiry reminders");
        }
      } catch (error) {
        logger.error({ err: error, cron: controller.cron }, "Dutstar scheduled task failed");
      }
    })());
  },
};
