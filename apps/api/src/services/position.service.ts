import { asc, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { parseMoney, parseMoneyOrZero, parsePrice } from "../lib/parse.js";
import { money, price } from "../lib/serialize.js";

export interface UpsertPositionInput {
  accountId: number;
  instrument: string;
  direction: string;
  quantity: number;
  averagePrice: string;
  marketPrice?: string | null;
  unrealizedPnl?: string | null;
}

export function upsertPosition(db: Db, input: UpsertPositionInput) {
  const existing = db
    .select()
    .from(schema.positions)
    .where(
      eq(schema.positions.accountId, input.accountId),
    )
    .all()
    .find(
      (p) =>
        p.instrument === input.instrument && p.direction === input.direction,
    );

  const values = {
    accountId: input.accountId,
    instrument: input.instrument,
    direction: input.direction,
    quantity: input.quantity,
    averagePrice: parsePrice(input.averagePrice) ?? 0,
    marketPrice: parsePrice(input.marketPrice),
    unrealizedPnl: parseMoney(input.unrealizedPnl) ?? 0,
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    return db
      .update(schema.positions)
      .set(values)
      .where(eq(schema.positions.id, existing.id))
      .returning()
      .get();
  }

  return db.insert(schema.positions).values(values).returning().get();
}

export function listPositions(db: Db, accountId?: number) {
  const where = accountId ? eq(schema.positions.accountId, accountId) : undefined;
  return db
    .select()
    .from(schema.positions)
    .where(where)
    .orderBy(asc(schema.positions.instrument))
    .all();
}

export function toPositionDto(p: schema.Position) {
  return {
    id: p.id,
    accountId: p.accountId,
    instrument: p.instrument,
    direction: p.direction,
    quantity: p.quantity,
    averagePrice: price(p.averagePrice) ?? "0",
    marketPrice: price(p.marketPrice),
    unrealizedPnl: money(p.unrealizedPnl) ?? "0",
    updatedAt: p.updatedAt,
  };
}

export interface UpsertSnapshotInput {
  accountId: number;
  snapshotDate: string;
  cashBalance: string;
  equityBalance: string;
  initialMargin?: string | null;
  maintenanceMargin?: string | null;
  excessEquity?: string | null;
  realizedPnl?: string | null;
  unrealizedPnl?: string | null;
  depositTotal?: string | null;
  withdrawalTotal?: string | null;
  source?: string;
  sourceDocumentId?: string | null;
}

export function upsertSnapshot(db: Db, input: UpsertSnapshotInput) {
  const existing = db
    .select()
    .from(schema.dailyAccountSnapshots)
    .where(
      eq(schema.dailyAccountSnapshots.accountId, input.accountId),
    )
    .all()
    .find((s) => s.snapshotDate === input.snapshotDate);

  const values = {
    accountId: input.accountId,
    snapshotDate: input.snapshotDate,
    cashBalance: parseMoneyOrZero(input.cashBalance),
    equityBalance: parseMoneyOrZero(input.equityBalance),
    initialMargin: parseMoney(input.initialMargin),
    maintenanceMargin: parseMoney(input.maintenanceMargin),
    excessEquity: parseMoney(input.excessEquity),
    realizedPnl: parseMoney(input.realizedPnl),
    unrealizedPnl: parseMoney(input.unrealizedPnl),
    depositTotal: parseMoney(input.depositTotal),
    withdrawalTotal: parseMoney(input.withdrawalTotal),
    source: input.source ?? "MANUAL",
    sourceDocumentId: input.sourceDocumentId ?? null,
  };

  if (existing) {
    return db
      .update(schema.dailyAccountSnapshots)
      .set({ ...values, updatedAt: new Date().toISOString() })
      .where(eq(schema.dailyAccountSnapshots.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(schema.dailyAccountSnapshots)
    .values(values)
    .returning()
    .get();
}

export function listSnapshots(db: Db, accountId?: number) {
  const where = accountId
    ? eq(schema.dailyAccountSnapshots.accountId, accountId)
    : undefined;
  return db
    .select()
    .from(schema.dailyAccountSnapshots)
    .where(where)
    .orderBy(desc(schema.dailyAccountSnapshots.snapshotDate))
    .all();
}

export function toSnapshotDto(s: schema.DailyAccountSnapshot) {
  return {
    id: s.id,
    accountId: s.accountId,
    snapshotDate: s.snapshotDate,
    cashBalance: money(s.cashBalance) ?? "0",
    equityBalance: money(s.equityBalance) ?? "0",
    initialMargin: money(s.initialMargin),
    maintenanceMargin: money(s.maintenanceMargin),
    excessEquity: money(s.excessEquity),
    realizedPnl: money(s.realizedPnl),
    unrealizedPnl: money(s.unrealizedPnl),
    depositTotal: money(s.depositTotal),
    withdrawalTotal: money(s.withdrawalTotal),
    source: s.source,
    sourceDocumentId: s.sourceDocumentId,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}