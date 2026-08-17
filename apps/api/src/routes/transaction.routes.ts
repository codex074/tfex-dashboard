import type { FastifyInstance } from "fastify";
import { createBrokerTransactionSchema, updateManualBrokerTransactionSchema } from "@tfex/shared";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import {
  createBrokerTransaction,
  listBrokerTransactions,
  toBrokerTransactionDto,
  updateBrokerTransaction,
} from "../services/transaction.service.js";
import { recomputeTrade } from "../services/trade.service.js";
import * as schema from "../db/schema.js";

export function registerTransactionRoutes(app: FastifyInstance, db: Db) {
  app.post("/api/transactions", async (request) => {
    const parsed = createBrokerTransactionSchema.parse(request.body);
    return {
      data: toBrokerTransactionDto(createBrokerTransaction(db, parsed)),
    };
  });

  app.get("/api/transactions", async (request) => {
    const query = request.query as {
      accountId?: string;
      limit?: string;
      offset?: string;
    };
    const accountId = query.accountId ? Number(query.accountId) : undefined;
    const limit = query.limit ? Number(query.limit) : 100;
    const offset = query.offset ? Number(query.offset) : 0;
    return {
      data: listBrokerTransactions(db, accountId, limit, offset).map(
        toBrokerTransactionDto,
      ),
    };
  });

  app.patch("/api/transactions/:id", async (request) => {
    const { id } = request.params as { id: string };
    const transactionId = Number(id);
    const parsed = updateManualBrokerTransactionSchema.parse(request.body);
    const mapping = db
      .select({ tradeId: schema.tradeTransactions.tradeId })
      .from(schema.tradeTransactions)
      .where(eq(schema.tradeTransactions.brokerTransactionId, transactionId))
      .get();
    const transaction = updateBrokerTransaction(db, transactionId, parsed);
    if (mapping) {
      recomputeTrade(db, mapping.tradeId);
    }
    return { data: toBrokerTransactionDto(transaction) };
  });
}
