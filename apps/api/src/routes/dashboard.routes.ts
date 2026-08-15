import type { FastifyInstance } from "fastify";
import type { Db } from "../db/client.js";
import { dashboardSummary } from "../services/dashboard.service.js";
import { equityCurve } from "../services/analytics.service.js";

export function registerDashboardRoutes(app: FastifyInstance, db: Db) {
  app.get("/api/dashboard/summary", async (request) => {
    const query = request.query as { accountId: string };
    const accountId = Number(query.accountId);
    return { data: dashboardSummary(db, accountId) };
  });

  app.get("/api/dashboard/equity", async (request) => {
    const query = request.query as { accountId: string };
    return { data: equityCurve(db, Number(query.accountId)) };
  });
}