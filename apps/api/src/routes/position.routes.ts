import type { FastifyInstance } from "fastify";
import { createPositionSchema, upsertSnapshotSchema } from "@tfex/shared";
import type { Db } from "../db/client.js";
import {
  listPositions,
  listSnapshots,
  toPositionDto,
  toSnapshotDto,
  upsertPosition,
  upsertSnapshot,
} from "../services/position.service.js";

export function registerPositionRoutes(app: FastifyInstance, db: Db) {
  app.get("/api/positions", async (request) => {
    const query = request.query as { accountId?: string };
    const accountId = query.accountId ? Number(query.accountId) : undefined;
    return { data: listPositions(db, accountId).map(toPositionDto) };
  });

  app.post("/api/positions", async (request) => {
    const parsed = createPositionSchema.parse(request.body);
    return { data: toPositionDto(upsertPosition(db, parsed)) };
  });

  app.get("/api/snapshots", async (request) => {
    const query = request.query as { accountId?: string };
    const accountId = query.accountId ? Number(query.accountId) : undefined;
    return { data: listSnapshots(db, accountId).map(toSnapshotDto) };
  });

  app.post("/api/snapshots", async (request) => {
    const parsed = upsertSnapshotSchema.parse(request.body);
    return { data: toSnapshotDto(upsertSnapshot(db, parsed)) };
  });
}