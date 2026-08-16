import { asc, desc, eq } from "drizzle-orm";
import { TRADE_STATUS } from "@tfex/shared";
import type { Db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { parseMoney, parseMoneyOrZero, parsePrice } from "../lib/parse.js";
import { money, price } from "../lib/serialize.js";
import { grossPnlSatang } from "../domain/pnl.js";
import { errors } from "../lib/errors.js";

export interface UpsertPositionInput {
  accountId: number;
  instrument: string;
  direction: string;
  quantity: number;
  averagePrice: string;
  marketPrice?: string | null;
  unrealizedPnl?: string | null;
}

export interface PositionView {
  id: number;
  accountId: number;
  instrument: string;
  direction: string;
  quantity: number;
  averagePrice: number;
  marketPrice: number | null;
  unrealizedPnl: number;
  marginUsed: number;
  updatedAt: string;
}

/**
 * Positions are derived from open trades. The positions table only persists
 * the latest manually-entered mark price, so updating a mark never changes
 * broker transaction history or trade results.
 */
export function currentPositions(db: Db, accountId?: number): PositionView[] {
  const persisted = listPositions(db, accountId);
  const marksByKey = new Map(
    persisted.map((position) => [
      `${position.accountId}:${position.instrument}:${position.direction}`,
      position,
    ]),
  );
  const openTrades = db
    .select()
    .from(schema.trades)
    .all()
    .filter(
      (trade) =>
        (!accountId || trade.accountId === accountId) &&
        trade.status !== TRADE_STATUS.CLOSED,
    );

  const groups = new Map<string, typeof openTrades>();
  for (const trade of openTrades) {
    const key = `${trade.accountId}:${trade.instrument}:${trade.direction}`;
    groups.set(key, [...(groups.get(key) ?? []), trade]);
  }

  const views: PositionView[] = [];
  for (const [key, trades] of groups) {
    const first = trades[0];
    if (!first) continue;
    const mark = marksByKey.get(key);
    const quantity = trades.reduce(
      (total, trade) => total + Math.max(0, trade.totalEntryQuantity - trade.totalExitQuantity),
      0,
    );
    const weightedEntry = trades.reduce(
      (total, trade) =>
        total + Math.max(0, trade.totalEntryQuantity - trade.totalExitQuantity) * (trade.averageEntryPrice ?? 0),
      0,
    );
    const averagePrice = quantity > 0 ? Math.trunc(weightedEntry / quantity) : 0;
    const marketPrice = mark?.marketPrice ?? null;
    const unrealizedPnl = marketPrice === null
      ? 0
      : trades.reduce((total, trade) => {
          const openQuantity = Math.max(0, trade.totalEntryQuantity - trade.totalExitQuantity);
          return total + grossPnlSatang({
            direction: trade.direction as "LONG" | "SHORT",
            entryPrice: trade.averageEntryPrice ?? 0,
            exitPrice: marketPrice,
            quantity: openQuantity,
            pointValueSatang: trade.multiplierSatangPerPoint ?? 20_000,
          });
        }, 0);
    const marginUsed = trades.reduce(
      (total, trade) => total + Math.max(0, trade.totalEntryQuantity - trade.totalExitQuantity) * (trade.initialMarginPerContract ?? 0),
      0,
    );
    views.push({
      id: mark?.id ?? -first.id,
      accountId: first.accountId,
      instrument: first.instrument,
      direction: first.direction,
      quantity,
      averagePrice,
      marketPrice,
      unrealizedPnl,
      marginUsed,
      updatedAt: mark?.updatedAt ?? first.updatedAt,
    });
  }

  // Preserve any manually-created legacy positions which do not yet have a
  // corresponding Trade record.
  for (const position of persisted) {
    const key = `${position.accountId}:${position.instrument}:${position.direction}`;
    if (groups.has(key)) continue;
    views.push({ ...position, marginUsed: 0 });
  }

  return views.sort((a, b) => a.instrument.localeCompare(b.instrument));
}

export function positionTotals(db: Db, accountId: number) {
  return currentPositions(db, accountId).reduce(
    (totals, position) => ({
      unrealizedPnl: totals.unrealizedPnl + position.unrealizedPnl,
      marginUsed: totals.marginUsed + position.marginUsed,
    }),
    { unrealizedPnl: 0, marginUsed: 0 },
  );
}

export function markPositionPrice(
  db: Db,
  input: { accountId: number; instrument: string; direction: string; marketPrice: string },
) {
  const position = currentPositions(db, input.accountId).find(
    (candidate) => candidate.instrument === input.instrument && candidate.direction === input.direction,
  );
  if (!position) {
    throw errors.notFound("Open position");
  }

  const marketPrice = parsePrice(input.marketPrice);
  if (marketPrice === null) {
    throw errors.validation("Invalid market price");
  }
  // Recalculate with the incoming mark rather than the previous saved mark.
  const openTrades = db.select().from(schema.trades).all().filter(
    (trade) => trade.accountId === input.accountId && trade.instrument === input.instrument && trade.direction === input.direction && trade.status !== TRADE_STATUS.CLOSED,
  );
  const calculatedPnl = openTrades.reduce((total, trade) => total + grossPnlSatang({
    direction: trade.direction as "LONG" | "SHORT",
    entryPrice: trade.averageEntryPrice ?? 0,
    exitPrice: marketPrice,
    quantity: Math.max(0, trade.totalEntryQuantity - trade.totalExitQuantity),
    pointValueSatang: trade.multiplierSatangPerPoint ?? 20_000,
  }), 0);
  const saved = upsertPosition(db, {
    accountId: input.accountId,
    instrument: input.instrument,
    direction: input.direction,
    quantity: position.quantity,
    averagePrice: price(position.averagePrice) ?? "0",
    marketPrice: input.marketPrice,
    unrealizedPnl: money(calculatedPnl) ?? "0",
  });
  return currentPositions(db, input.accountId).find(
    (candidate) => candidate.instrument === saved.instrument && candidate.direction === saved.direction,
  )!;
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

export function toPositionDto(p: PositionView | schema.Position) {
  return {
    id: p.id,
    accountId: p.accountId,
    instrument: p.instrument,
    direction: p.direction,
    quantity: p.quantity,
    averagePrice: price(p.averagePrice) ?? "0",
    marketPrice: price(p.marketPrice),
    unrealizedPnl: money(p.unrealizedPnl) ?? "0",
    marginUsed: money("marginUsed" in p ? p.marginUsed : 0) ?? "0",
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
