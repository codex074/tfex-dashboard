import type { FastifyInstance } from "fastify";
import type { Db } from "../db/client.js";
import {
  analyticsDayOfWeek,
  analyticsDirections,
  analyticsInstruments,
  analyticsMonthly,
  analyticsStrategies,
  analyticsSummary,
  equityCurve,
  type AnalyticsFilters,
} from "../services/analytics.service.js";

function parseFilters(query: {
  accountId?: string;
  start?: string;
  end?: string;
}): AnalyticsFilters {
  return {
    accountId: query.accountId ? Number(query.accountId) : undefined,
    start: query.start,
    end: query.end,
  };
}

export function registerAnalyticsRoutes(app: FastifyInstance, db: Db) {
  app.get("/api/analytics/summary", async (request) => {
    const filters = parseFilters(request.query as Record<string, string>);
    return { data: analyticsSummary(db, filters) };
  });

  app.get("/api/analytics/instruments", async (request) => {
    const filters = parseFilters(request.query as Record<string, string>);
    return { data: analyticsInstruments(db, filters) };
  });

  app.get("/api/analytics/directions", async (request) => {
    const filters = parseFilters(request.query as Record<string, string>);
    return { data: analyticsDirections(db, filters) };
  });

  app.get("/api/analytics/strategies", async (request) => {
    const filters = parseFilters(request.query as Record<string, string>);
    return { data: analyticsStrategies(db, filters) };
  });

  app.get("/api/analytics/day-of-week", async (request) => {
    const filters = parseFilters(request.query as Record<string, string>);
    return { data: analyticsDayOfWeek(db, filters) };
  });

  app.get("/api/analytics/monthly", async (request) => {
    const filters = parseFilters(request.query as Record<string, string>);
    return { data: analyticsMonthly(db, filters) };
  });

  app.get("/api/analytics/equity", async (request) => {
    const query = request.query as { accountId: string };
    if (!query.accountId) {
      return { data: { points: [], currentDrawdown: null, maxDrawdown: null } };
    }
    return { data: equityCurve(db, Number(query.accountId)) };
  });
}