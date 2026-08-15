import type { FastifyInstance } from "fastify";
import { createJournalSchema } from "@tfex/shared";
import type { Db } from "../db/client.js";
import { getJournal, upsertJournal } from "../services/journal.service.js";

export function registerJournalRoutes(app: FastifyInstance, db: Db) {
  app.get("/api/trades/:id/journal", async (request) => {
    const { id } = request.params as { id: string };
    const journal = getJournal(db, Number(id));
    return { data: journal };
  });

  app.put("/api/trades/:id/journal", async (request) => {
    const { id } = request.params as { id: string };
    const parsed = createJournalSchema.parse(request.body);
    const journal = upsertJournal(db, { ...parsed, tradeId: Number(id) });
    return { data: journal };
  });
}