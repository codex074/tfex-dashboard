import { and, asc, eq, gte, lte } from "drizzle-orm";
import { CASH_TRANSACTION_TYPE, TRADE_STATUS } from "@tfex/shared";
import type { Db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { accountSummary } from "./account.service.js";
import {
  computeDrawdown,
  computeSummary,
  groupByDayOfWeek,
  groupByDirection,
  groupByInstrument,
  groupByMonth,
  groupByStrategy,
  type TradeResultInput,
} from "../domain/analytics.js";
import { money } from "../lib/serialize.js";
import { parseMoneyOrZero } from "../lib/parse.js";

export interface AnalyticsFilters {
  accountId?: number;
  start?: string;
  end?: string;
}

function loadClosedTrades(
  db: Db,
  filters: AnalyticsFilters,
): Array<{ trade: schema.Trade; strategyName: string | null }> {
  const conditions = [eq(schema.trades.status, TRADE_STATUS.CLOSED)];
  if (filters.accountId) {
    conditions.push(eq(schema.trades.accountId, filters.accountId));
  }
  if (filters.start) {
    conditions.push(gte(schema.trades.closedAt, filters.start));
  }
  if (filters.end) {
    conditions.push(lte(schema.trades.closedAt, filters.end));
  }

  const rows = db
    .select({
      trade: schema.trades,
      strategyName: schema.strategies.name,
    })
    .from(schema.trades)
    .leftJoin(schema.strategies, eq(schema.trades.strategyId, schema.strategies.id))
    .where(and(...conditions))
    .orderBy(schema.trades.closedAt)
    .all();

  return rows.map((r) => ({ trade: r.trade, strategyName: r.strategyName }));
}

function toTradeResultInput(
  row: { trade: schema.Trade; strategyName: string | null },
): TradeResultInput {
  return {
    netPnl: row.trade.netPnl,
    grossPnl: row.trade.grossPnl,
    fees: row.trade.totalFees,
    contracts: row.trade.totalEntryQuantity,
    direction: row.trade.direction as TradeResultInput["direction"],
    instrument: row.trade.instrument,
    strategyId: row.trade.strategyId,
    strategyName: row.strategyName ?? "UNASSIGNED",
    closedAt: row.trade.closedAt,
  };
}

export function analyticsSummary(db: Db, filters: AnalyticsFilters) {
  const rows = loadClosedTrades(db, filters);
  const trades = rows.map(toTradeResultInput);
  const summary = computeSummary(trades);

  return {
    totalTrades: summary.totalTrades,
    winningTrades: summary.winningTrades,
    losingTrades: summary.losingTrades,
    breakEvenTrades: summary.breakEvenTrades,
    winRate: summary.winRate,
    grossProfit: money(summary.grossProfit) ?? "0",
    grossLoss: money(summary.grossLoss) ?? "0",
    netProfit: money(summary.netProfit) ?? "0",
    averageWin: money(summary.averageWin ?? 0) ?? "0",
    averageLoss: money(summary.averageLoss ?? 0) ?? "0",
    largestWin: money(summary.largestWin ?? 0) ?? "0",
    largestLoss: money(summary.largestLoss ?? 0) ?? "0",
    profitFactor: summary.profitFactor,
    expectancy: money(Math.round(summary.expectancy)) ?? "0",
    totalFees: money(summary.totalFees) ?? "0",
    totalContracts: summary.totalContracts,
  };
}

export function analyticsInstruments(db: Db, filters: AnalyticsFilters) {
  const rows = loadClosedTrades(db, filters);
  return groupByInstrument(rows.map(toTradeResultInput)).map(toGroupedDto);
}

export function analyticsDirections(db: Db, filters: AnalyticsFilters) {
  const rows = loadClosedTrades(db, filters);
  return groupByDirection(rows.map(toTradeResultInput)).map(toGroupedDto);
}

export function analyticsStrategies(db: Db, filters: AnalyticsFilters) {
  const rows = loadClosedTrades(db, filters);
  return groupByStrategy(rows.map(toTradeResultInput)).map(toGroupedDto);
}

export function analyticsDayOfWeek(db: Db, filters: AnalyticsFilters) {
  const rows = loadClosedTrades(db, filters);
  return groupByDayOfWeek(rows.map(toTradeResultInput)).map(toGroupedDto);
}

export function analyticsMonthly(db: Db, filters: AnalyticsFilters) {
  const rows = loadClosedTrades(db, filters);
  return groupByMonth(rows.map(toTradeResultInput)).map(toGroupedDto);
}

function toGroupedDto(g: {
  key: string;
  trades: number;
  contracts: number;
  winRate: number;
  grossPnl: number;
  fees: number;
  netPnl: number;
  profitFactor: number | null;
  expectancy: number;
  averageWin: number | null;
  averageLoss: number | null;
}) {
  return {
    key: g.key,
    trades: g.trades,
    contracts: g.contracts,
    winRate: g.winRate,
    grossPnl: money(g.grossPnl) ?? "0",
    fees: money(g.fees) ?? "0",
    netPnl: money(g.netPnl) ?? "0",
    profitFactor: g.profitFactor,
    expectancy: money(Math.round(g.expectancy)) ?? "0",
    averageWin: money(g.averageWin ?? 0) ?? "0",
    averageLoss: money(g.averageLoss ?? 0) ?? "0",
  };
}

export function equityCurve(db: Db, accountId: number) {
  const snapshots = db
    .select()
    .from(schema.dailyAccountSnapshots)
    .where(eq(schema.dailyAccountSnapshots.accountId, accountId))
    .orderBy(schema.dailyAccountSnapshots.snapshotDate)
    .all();

  const snapshotPoints = snapshots.map((s) => ({
    date: s.snapshotDate,
    equity: s.equityBalance,
  }));

  // Broker snapshots remain the authoritative source. When history has not
  // been imported yet, expose the first verified capital contribution as the
  // starting point instead of rendering a misleading empty chart.
  const firstDeposit = db
    .select({
      date: schema.cashTransactions.transactionDate,
      amount: schema.cashTransactions.amount,
    })
    .from(schema.cashTransactions)
    .where(
      and(
        eq(schema.cashTransactions.accountId, accountId),
        eq(schema.cashTransactions.type, CASH_TRANSACTION_TYPE.DEPOSIT),
      ),
    )
    .orderBy(
      asc(schema.cashTransactions.transactionDate),
      asc(schema.cashTransactions.id),
    )
    .limit(1)
    .get();

  const hasAuthoritativeStartingPoint = firstDeposit !== undefined &&
    snapshotPoints.some((point) => point.date <= firstDeposit.date);
  let equity: Array<{ date: string; equity: number }>;
  if (snapshotPoints.length > 0) {
    equity = firstDeposit && !hasAuthoritativeStartingPoint
      ? [{ date: firstDeposit.date, equity: firstDeposit.amount }, ...snapshotPoints]
      : snapshotPoints;
  } else if (firstDeposit) {
    // With no broker snapshots, reconstruct daily equity from the ledger.
    // Cash movements stay distinct in storage, but they must affect account
    // equity on their effective date. Closed trades add their already
    // fee-inclusive net P/L on the closing date.
    const changesByDate = new Map<string, number>();
    const addChange = (date: string, amount: number) => {
      changesByDate.set(date, (changesByDate.get(date) ?? 0) + amount);
    };

    const cashMovements = db
      .select({
        date: schema.cashTransactions.transactionDate,
        type: schema.cashTransactions.type,
        amount: schema.cashTransactions.amount,
      })
      .from(schema.cashTransactions)
      .where(eq(schema.cashTransactions.accountId, accountId))
      .all();
    for (const movement of cashMovements) {
      if (movement.date < firstDeposit.date) continue;
      const signedAmount = movement.type === CASH_TRANSACTION_TYPE.WITHDRAWAL
        ? -movement.amount
        : movement.amount;
      addChange(movement.date, signedAmount);
    }

    const closedTrades = db
      .select({ date: schema.trades.closedAt, netPnl: schema.trades.netPnl })
      .from(schema.trades)
      .where(
        and(
          eq(schema.trades.accountId, accountId),
          eq(schema.trades.status, TRADE_STATUS.CLOSED),
        ),
      )
      .all();
    for (const trade of closedTrades) {
      if (trade.date && trade.date >= firstDeposit.date) {
        addChange(trade.date, trade.netPnl);
      }
    }

    let runningEquity = 0;
    equity = Array.from(changesByDate.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, change]) => {
        runningEquity += change;
        return { date, equity: runningEquity };
      });
  } else {
    equity = [];
  }

  // Show the live Portfolio Equity as the final point when the latest
  // broker-provided snapshot is from an earlier day. This makes the chart
  // useful between statement imports without replacing historical snapshots.
  const currentDate = bangkokToday();
  const lastPoint = equity.at(-1);
  if (lastPoint && lastPoint.date < currentDate) {
    equity.push({
      date: currentDate,
      equity: parseMoneyOrZero(accountSummary(db, accountId).equityBalance),
    });
  }

  const drawdown = computeDrawdown(equity);

  return {
    points: equity.map((p, i) => ({
      ...p,
      equity: money(p.equity) ?? "0",
      drawdown: drawdown.points[i]?.drawdown ?? 0,
    })),
    currentDrawdown: drawdown.currentDrawdown,
    maxDrawdown: drawdown.maxDrawdown,
    peakEquity: money(drawdown.peakEquity ?? 0) ?? "0",
    troughEquity: money(drawdown.troughEquity ?? 0) ?? "0",
  };
}

function bangkokToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
