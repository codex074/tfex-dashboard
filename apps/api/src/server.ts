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
import { registerAuthRoutes } from "./routes/auth.routes.js";
import { getUserByToken } from "./services/auth.service.js";
import { errors } from "./lib/errors.js";
import { eq } from "drizzle-orm";
import * as schema from "./db/schema.js";

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "0.0.0.0";

export function buildApp(options: { disableAuth?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: true });
  migrate();
  const db = getDb();

  void app.register(cors, {
    origin: true,
  });

  app.addHook("onRequest", async (request) => {
    if (options.disableAuth) {
      request.authUser = { id: 0, email: "test@example.com", displayName: "Test Admin", role: "ADMIN", isActive: true };
      return;
    }
    if (request.method === "OPTIONS" || request.url === "/api/health" || request.url === "/api/auth/status" || request.url === "/api/auth/login" || request.url === "/api/auth/bootstrap" || request.url === "/api/auth/register") return;
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    if (!token) throw errors.unauthorized();
    const user = getUserByToken(db, token);
    if (!user) throw errors.unauthorized("Session is invalid or expired");
    request.authUser = user;
    request.authToken = token;
  });

  app.addHook("preHandler", async (request) => {
    const user = request.authUser;
    if (!user || user.role === "ADMIN") return;
    const query = request.query as { accountId?: string } | undefined;
    const body = request.body as { accountId?: number } | undefined;
    let accountId = query?.accountId ? Number(query.accountId) : body?.accountId;
    const path = request.url.split("?")[0] ?? request.url;
    const accountMatch = path.match(/^\/api\/accounts\/(\d+)/);
    if (accountMatch?.[1]) accountId = Number(accountMatch[1]);

    if (accountId === undefined) {
      const resourceMatch = path.match(/^\/api\/(trades|transactions|cash-transactions)\/(\d+)/);
      if (resourceMatch?.[1] && resourceMatch[2]) {
        const id = Number(resourceMatch[2]);
        if (resourceMatch[1] === "trades") accountId = db.select({ accountId: schema.trades.accountId }).from(schema.trades).where(eq(schema.trades.id, id)).get()?.accountId;
        if (resourceMatch[1] === "transactions") accountId = db.select({ accountId: schema.brokerTransactions.accountId }).from(schema.brokerTransactions).where(eq(schema.brokerTransactions.id, id)).get()?.accountId;
        if (resourceMatch[1] === "cash-transactions") accountId = db.select({ accountId: schema.cashTransactions.accountId }).from(schema.cashTransactions).where(eq(schema.cashTransactions.id, id)).get()?.accountId;
      }
    }
    if (accountId === undefined) return;
    const account = db.select({ userId: schema.accounts.userId }).from(schema.accounts).where(eq(schema.accounts.id, accountId)).get();
    if (!account || account.userId !== user.id) throw errors.forbidden("Account belongs to another user");
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

  registerAuthRoutes(app, db);
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

if (process.env.NODE_ENV !== "test") {
  void main();
}
