import type { FastifyInstance } from "fastify";
import {
  createAccountSchema,
  createCashTransactionSchema,
  updateCashTransactionSchema,
} from "@tfex/shared";
import type { Db } from "../db/client.js";
import {
  accountSummary,
  createAccount,
  listAccounts,
  toAccountDto,
} from "../services/account.service.js";
import {
  cashFlowSummary,
  createCashTransaction,
  deleteCashTransaction,
  listCashTransactions,
  toCashTransactionDto,
  updateCashTransaction,
} from "../services/transaction.service.js";
import { requireUser } from "./auth.routes.js";

export function registerAccountRoutes(app: FastifyInstance, db: Db) {
  app.get("/api/accounts", async (request) => {
    const user = requireUser(request);
    return { data: listAccounts(db, user.role === "ADMIN" ? undefined : user.id).map(toAccountDto) };
  });

  app.post("/api/accounts", async (request) => {
    const parsed = createAccountSchema.parse(request.body);
    const user = requireUser(request);
    return { data: toAccountDto(createAccount(db, { ...parsed, userId: user.id === 0 ? undefined : user.id })) };
  });

  app.get("/api/accounts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const accountId = Number(id);
    return { data: accountSummary(db, accountId) };
  });

  app.get("/api/accounts/:id/cash-flows", async (request) => {
    const { id } = request.params as { id: string };
    return { data: cashFlowSummary(db, Number(id)) };
  });

  app.post("/api/cash-transactions", async (request) => {
    const parsed = createCashTransactionSchema.parse(request.body);
    return { data: toCashTransactionDto(createCashTransaction(db, parsed)) };
  });

  app.get("/api/cash-transactions", async (request) => {
    const query = request.query as { accountId?: string; limit?: string; offset?: string };
    const accountId = query.accountId ? Number(query.accountId) : undefined;
    const limit = query.limit ? Number(query.limit) : 100;
    const offset = query.offset ? Number(query.offset) : 0;
    return {
      data: listCashTransactions(db, accountId, limit, offset).map(
        toCashTransactionDto,
      ),
    };
  });

  app.patch("/api/cash-transactions/:id", async (request) => {
    const { id } = request.params as { id: string };
    const parsed = updateCashTransactionSchema.parse(request.body);
    return { data: toCashTransactionDto(updateCashTransaction(db, Number(id), parsed)) };
  });

  app.delete("/api/cash-transactions/:id", async (request) => {
    const { id } = request.params as { id: string };
    deleteCashTransaction(db, Number(id));
    return { data: { id: Number(id) } };
  });
}
