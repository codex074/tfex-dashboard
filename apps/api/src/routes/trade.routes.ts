import type { FastifyInstance } from "fastify";
import {
  assignTransactionToTradeSchema,
  closePositionSchema,
  createTradeSchema,
  openPositionSchema,
  tradeListQuerySchema,
} from "@tfex/shared";
import type { Db } from "../db/client.js";
import {
  assignTransaction,
  closePosition,
  createTrade,
  listTrades,
  getTradeById,
  toTradeDetailDto,
  toTradeDto,
  unrealizedPnlForTrade,
  openPosition,
} from "../services/trade.service.js";

export function registerTradeRoutes(app: FastifyInstance, db: Db) {
  app.get("/api/trades", async (request) => {
    const query = tradeListQuerySchema.parse(request.query ?? {});
    const rows = listTrades(db, {
      status: query.status,
      direction: query.direction,
      instrument: query.instrument,
      strategyId: query.strategyId,
      limit: query.limit,
      offset: query.offset,
    });
    return { data: rows.map((trade) => toTradeDto(trade, unrealizedPnlForTrade(db, trade))) };
  });

  app.post("/api/trades", async (request) => {
    const parsed = createTradeSchema.parse(request.body);
    return { data: toTradeDto(createTrade(db, parsed)) };
  });

  app.post("/api/trades/open-position", async (request) => {
    const parsed = openPositionSchema.parse(request.body);
    return { data: toTradeDto(openPosition(db, parsed)) };
  });

  app.post("/api/trades/:id/close-position", async (request) => {
    const { id } = request.params as { id: string };
    const parsed = closePositionSchema.parse(request.body);
    return { data: toTradeDto(closePosition(db, { tradeId: Number(id), ...parsed })) };
  });

  app.get("/api/trades/:id", async (request) => {
    const { id } = request.params as { id: string };
    const { trade, transactions } = getTradeById(db, Number(id));
    return { data: toTradeDetailDto(trade, transactions) };
  });

  app.post("/api/trades/:id/transactions", async (request) => {
    const { id } = request.params as { id: string };
    const parsed = assignTransactionToTradeSchema.parse(request.body);
    const { trade, transactions } = assignTransaction(db, {
      tradeId: Number(id),
      transactionId: parsed.transactionId,
    });
    return { data: toTradeDetailDto(trade, transactions) };
  });
}
