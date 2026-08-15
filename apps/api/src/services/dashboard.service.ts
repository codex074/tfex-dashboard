import type { Db } from "../db/client.js";
import { accountSummary } from "./account.service.js";
import { analyticsSummary, equityCurve } from "./analytics.service.js";
import { cashFlowSummary } from "./transaction.service.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import { parseMoneyOrZero } from "../lib/parse.js";
import { money } from "../lib/serialize.js";

export function dashboardSummary(db: Db, accountId: number) {
  const account = accountSummary(db, accountId);
  const analytics = analyticsSummary(db, { accountId });
  const cashFlow = cashFlowSummary(db, accountId);
  const openTrades = db.select().from(schema.trades).where(eq(schema.trades.accountId, accountId)).all().filter((trade) => trade.status !== "CLOSED");
  const risk = openTrades.reduce((total, trade) => {
    const openQuantity = Math.max(0, trade.totalEntryQuantity - trade.totalExitQuantity);
    const multiplier = trade.multiplierSatangPerPoint ?? 20_000;
    const notional = Math.trunc(((trade.averageEntryPrice ?? 0) * multiplier * openQuantity) / 100);
    return { notional: total.notional + notional, margin: total.margin + (trade.initialMarginPerContract ?? 0) * openQuantity };
  }, { notional: 0, margin: 0 });
  const equity = parseMoneyOrZero(account.equityBalance);

  return {
    portfolioEquity: account.equityBalance,
    cashBalance: account.cashBalance,
    netTradingPnl: account.netTradingProfit,
    realizedPnl: account.realizedPnl,
    unrealizedPnl: account.unrealizedPnl,
    totalDeposits: cashFlow.totalDeposits,
    totalWithdrawals: cashFlow.totalWithdrawals,
    netCapitalFlow: cashFlow.netCapitalFlow,
    totalFees: analytics.totalFees,
    winRate: analytics.winRate,
    profitFactor: analytics.profitFactor,
    expectancy: analytics.expectancy,
    totalTrades: analytics.totalTrades,
    maxDrawdown: equityCurve(db, accountId).maxDrawdown,
    notionalExposure: money(risk.notional) ?? "0",
    effectiveLeverage: equity > 0 ? risk.notional / equity : null,
    marginUsed: money(risk.margin) ?? "0",
    marginUtilization: equity > 0 ? risk.margin / equity : null,
  };
}
