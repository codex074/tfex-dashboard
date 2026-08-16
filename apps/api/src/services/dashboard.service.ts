import type { Db } from "../db/client.js";
import { accountSummary } from "./account.service.js";
import { analyticsSummary, equityCurve } from "./analytics.service.js";
import { cashFlowSummary } from "./transaction.service.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import { money } from "../lib/serialize.js";
import { currentPositions, positionTotals } from "./position.service.js";

export function dashboardSummary(db: Db, accountId: number) {
  const account = accountSummary(db, accountId);
  const analytics = analyticsSummary(db, { accountId });
  const cashFlow = cashFlowSummary(db, accountId);
  // Dashboard fee total represents the cost already incurred across every
  // order, including entries that remain open. Analytics intentionally uses
  // closed trades only for performance statistics.
  const totalFees = db
    .select({ totalFee: schema.brokerTransactions.totalFee })
    .from(schema.brokerTransactions)
    .where(eq(schema.brokerTransactions.accountId, accountId))
    .all()
    .reduce((sum, transaction) => sum + (transaction.totalFee ?? 0), 0);
  const currentMarks = new Map(
    currentPositions(db, accountId).map((position) => [
      `${position.instrument}:${position.direction}`,
      position.marketPrice,
    ]),
  );
  const openTrades = db.select().from(schema.trades).where(eq(schema.trades.accountId, accountId)).all().filter((trade) => trade.status !== "CLOSED");
  const risk = openTrades.reduce((total, trade) => {
    const openQuantity = Math.max(0, trade.totalEntryQuantity - trade.totalExitQuantity);
    const multiplier = trade.multiplierSatangPerPoint ?? 20_000;
    const mark = currentMarks.get(`${trade.instrument}:${trade.direction}`);
    const priceForExposure = mark ?? trade.averageEntryPrice ?? 0;
    return { notional: total.notional + Math.trunc((priceForExposure * multiplier * openQuantity) / 100) };
  }, { notional: 0 });
  const positionSummary = positionTotals(db, accountId);
  const equity = Number(account.equityBalance) * 100;

  return {
    portfolioEquity: account.equityBalance,
    cashBalance: account.cashBalance,
    netTradingPnl: account.netTradingProfit,
    realizedPnl: account.realizedPnl,
    unrealizedPnl: account.unrealizedPnl,
    totalDeposits: cashFlow.totalDeposits,
    totalWithdrawals: cashFlow.totalWithdrawals,
    netCapitalFlow: cashFlow.netCapitalFlow,
    totalFees: money(totalFees) ?? "0",
    winRate: analytics.winRate,
    profitFactor: analytics.profitFactor,
    expectancy: analytics.expectancy,
    totalTrades: analytics.totalTrades,
    maxDrawdown: equityCurve(db, accountId).maxDrawdown,
    notionalExposure: money(risk.notional) ?? "0",
    effectiveLeverage: equity > 0 ? risk.notional / equity : null,
    marginUsed: money(positionSummary.marginUsed) ?? "0",
    marginUtilization: equity > 0 ? positionSummary.marginUsed / equity : null,
  };
}
