import type { FastifyInstance } from "fastify";
import { createBrokerTransactionSchema } from "@tfex/shared";
import type { Db } from "../db/client.js";
import {
  createBrokerTransaction,
  listBrokerTransactions,
  toBrokerTransactionDto,
} from "../services/transaction.service.js";

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
}