import "dotenv/config";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { getDb } from "./db/client.js";
import { migrate } from "./db/migrate.js";
import { ApiError } from "./lib/errors.js";
import { ZodError } from "zod";
import { registerCatalogRoutes } from "./routes/catalog.routes.js";
import { registerAccountRoutes } from "./routes/account.routes.js";
import { registerTransactionRoutes } from "./routes/transaction.routes.js";
import { registerTradeRoutes } from "./routes/trade.routes.js";
import { registerAnalyticsRoutes } from "./routes/analytics.routes.js";
import { registerJournalRoutes } from "./routes/journal.routes.js";
import { registerPositionRoutes } from "./routes/position.routes.js";
import { registerDashboardRoutes } from "./routes/dashboard.routes.js";

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "0.0.0.0";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });
  migrate();
  const db = getDb();

  void app.register(cors, {
    origin: true,
  });

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof ApiError) {
      return reply.status(err.statusCode).send(err.toPayload());
    }
    if (err instanceof ZodError) {
      const message = err.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message } });
    }
    request.log.error(err);
    return reply
      .status(500)
      .send({
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
  });

  app.get("/api/health", async () => ({ ok: true }));

  registerCatalogRoutes(app, db);
  registerAccountRoutes(app, db);
  registerTransactionRoutes(app, db);
  registerTradeRoutes(app, db);
  registerAnalyticsRoutes(app, db);
  registerJournalRoutes(app, db);
  registerPositionRoutes(app, db);
  registerDashboardRoutes(app, db);

  return app;
}

async function main() {
  const app = buildApp();
  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();