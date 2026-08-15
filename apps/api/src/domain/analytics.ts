import type { Direction } from "@tfex/shared";

/**
 * Analytics engine (AGENTS.md §35-44).
 *
 * Pure functions over closed trades. Trade P/L values are integer satang.
 * No divide-by-zero: profit factor and ratios guard against zero divisors.
 */

export interface TradeResultInput {
  netPnl: number; // integer satang
  grossPnl: number; // integer satang
  fees: number; // integer satang
  contracts: number; // total entry quantity closed
  direction?: Direction;
  instrument?: string;
  strategyId?: number | null;
  strategyName?: string | null;
  closedAt?: string | null;
}

export type TradeClassification = "win" | "loss" | "break-even";

export function classifyTrade(netPnl: number): TradeClassification {
  if (netPnl > 0) {
    return "win";
  }
  if (netPnl < 0) {
    return "loss";
  }
  return "break-even";
}

export interface SummaryMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number; // wins / closed, 0..1
  grossProfit: number;
  grossLoss: number; // positive number (absolute)
  netProfit: number;
  averageWin: number | null;
  averageLoss: number | null; // positive number (absolute)
  largestWin: number | null;
  largestLoss: number | null; // negative number
  profitFactor: number | null; // Infinity when no losses but profitable
  expectancy: number;
  totalFees: number;
  totalContracts: number;
}

export function computeSummary(
  trades: ReadonlyArray<TradeResultInput>,
): SummaryMetrics {
  let winningTrades = 0;
  let losingTrades = 0;
  let breakEvenTrades = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let netProfit = 0;
  let totalFees = 0;
  let sumWins = 0;
  let sumLosses = 0;
  let largestWin: number | null = null;
  let largestLoss: number | null = null;
  let totalContracts = 0;

  for (const trade of trades) {
    netProfit += trade.netPnl;
    totalFees += trade.fees;
    totalContracts += trade.contracts;

    if (trade.netPnl > 0) {
      winningTrades += 1;
      grossProfit += trade.netPnl;
      sumWins += trade.netPnl;
      largestWin =
        largestWin === null ? trade.netPnl : Math.max(largestWin, trade.netPnl);
    } else if (trade.netPnl < 0) {
      losingTrades += 1;
      const abs = Math.abs(trade.netPnl);
      grossLoss += abs;
      sumLosses += abs;
      largestLoss =
        largestLoss === null
          ? trade.netPnl
          : Math.min(largestLoss, trade.netPnl);
    } else {
      breakEvenTrades += 1;
    }
  }

  const closed = trades.length;
  const winRate = closed > 0 ? winningTrades / closed : 0;

  const averageWin = winningTrades > 0 ? sumWins / winningTrades : null;
  const averageLoss = losingTrades > 0 ? sumLosses / losingTrades : null;

  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Number.POSITIVE_INFINITY
        : null;

  const lossRate = 1 - winRate;
  const expectancy =
    winRate * (averageWin ?? 0) - lossRate * (averageLoss ?? 0);

  return {
    totalTrades: closed,
    winningTrades,
    losingTrades,
    breakEvenTrades,
    winRate,
    grossProfit,
    grossLoss,
    netProfit,
    averageWin,
    averageLoss,
    largestWin,
    largestLoss,
    profitFactor,
    expectancy,
    totalFees,
    totalContracts,
  };
}

export interface EquityPoint {
  date: string;
  equity: number; // satang
}

export interface DrawdownPoint extends EquityPoint {
  peakEquity: number;
  drawdown: number; // fraction (negative)
}

/**
 * Compute running drawdown over an equity curve. Returns drawdown points and
 * the summary statistics: current drawdown, max drawdown, peak and trough.
 */
export function computeDrawdown(
  equityCurve: ReadonlyArray<EquityPoint>,
): {
  points: DrawdownPoint[];
  currentDrawdown: number | null;
  maxDrawdown: number | null;
  peakEquity: number | null;
  troughEquity: number | null;
} {
  let peak = Number.NEGATIVE_INFINITY;
  let maxDrawdown: number | null = null;
  let maxDrawdownTrough = 0;
  let maxDrawdownPeak = 0;

  const points: DrawdownPoint[] = equityCurve.map((point) => {
    if (point.equity > peak) {
      peak = point.equity;
    }
    const drawdown = peak === 0 ? 0 : (point.equity - peak) / peak;
    if (drawdown < (maxDrawdown ?? 0)) {
      maxDrawdown = drawdown;
      maxDrawdownTrough = point.equity;
      maxDrawdownPeak = peak;
    }
    return { ...point, peakEquity: peak, drawdown };
  });

  const last = points.at(-1);

  return {
    points,
    currentDrawdown: last?.drawdown ?? null,
    maxDrawdown,
    peakEquity: maxDrawdown !== null ? maxDrawdownPeak : null,
    troughEquity: maxDrawdown !== null ? maxDrawdownTrough : null,
  };
}

export interface GroupedMetric {
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
}

export function groupAnalytics(
  trades: ReadonlyArray<TradeResultInput>,
  keyFn: (trade: TradeResultInput) => string,
): GroupedMetric[] {
  const groups = new Map<string, TradeResultInput[]>();
  for (const trade of trades) {
    const key = keyFn(trade);
    const bucket = groups.get(key) ?? [];
    bucket.push(trade);
    groups.set(key, bucket);
  }

  const result: GroupedMetric[] = [];
  for (const [key, bucket] of groups) {
    const summary = computeSummary(bucket);
    result.push({
      key,
      trades: summary.totalTrades,
      contracts: summary.totalContracts,
      winRate: summary.winRate,
      grossPnl: summary.netProfit + summary.totalFees,
      fees: summary.totalFees,
      netPnl: summary.netProfit,
      profitFactor: summary.profitFactor,
      expectancy: summary.expectancy,
      averageWin: summary.averageWin,
      averageLoss: summary.averageLoss,
    });
  }

  return result.sort((a, b) => b.netPnl - a.netPnl);
}

export function groupByInstrument(trades: ReadonlyArray<TradeResultInput>) {
  return groupAnalytics(trades, (t) => t.instrument ?? "UNKNOWN");
}

export function groupByDirection(trades: ReadonlyArray<TradeResultInput>) {
  return groupAnalytics(trades, (t) => t.direction ?? "UNKNOWN");
}

export function groupByStrategy(trades: ReadonlyArray<TradeResultInput>) {
  return groupAnalytics(trades, (t) => t.strategyName ?? "UNASSIGNED");
}

export function groupByDayOfWeek(trades: ReadonlyArray<TradeResultInput>) {
  return groupAnalytics(trades, (t) => {
    if (!t.closedAt) {
      return "UNKNOWN";
    }
    const d = new Date(t.closedAt);
    return d.getUTCDay().toString();
  });
}

export function groupByMonth(trades: ReadonlyArray<TradeResultInput>) {
  return groupAnalytics(trades, (t) => {
    if (!t.closedAt) {
      return "UNKNOWN";
    }
    return t.closedAt.slice(0, 7);
  });
}