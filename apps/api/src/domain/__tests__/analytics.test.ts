import { describe, expect, it } from "vitest";
import {
  classifyTrade,
  computeDrawdown,
  computeSummary,
  groupByDirection,
  type TradeResultInput,
} from "../analytics.js";
import { computeCapitalFlow } from "../portfolio.js";

const trade = (overrides: Partial<TradeResultInput>): TradeResultInput => ({
  netPnl: 0,
  grossPnl: 0,
  fees: 0,
  contracts: 1,
  ...overrides,
});

describe("classifyTrade", () => {
  it("classifies win, loss and break-even", () => {
    expect(classifyTrade(100)).toBe("win");
    expect(classifyTrade(-100)).toBe("loss");
    expect(classifyTrade(0)).toBe("break-even");
  });
});

describe("computeSummary", () => {
  it("computes win rate, profit factor, expectancy", () => {
    const trades = [
      trade({ netPnl: 1000, contracts: 1, fees: 100 }),
      trade({ netPnl: 500, contracts: 1, fees: 100 }),
      trade({ netPnl: -500, contracts: 1, fees: 100 }),
      trade({ netPnl: -500, contracts: 1, fees: 100 }),
    ];
    const s = computeSummary(trades);
    expect(s.totalTrades).toBe(4);
    expect(s.winningTrades).toBe(2);
    expect(s.losingTrades).toBe(2);
    expect(s.winRate).toBe(0.5);

    expect(s.grossProfit).toBe(1500);
    expect(s.grossLoss).toBe(1000);
    expect(s.profitFactor).toBe(1.5);

    expect(s.averageWin).toBe(750);
    expect(s.averageLoss).toBe(500);
    // expectancy = 0.5*750 - 0.5*500 = 125
    expect(s.expectancy).toBeCloseTo(125);
    expect(s.totalContracts).toBe(4);
    expect(s.totalFees).toBe(400);
  });

  it("returns null profitFactor when no losing trades", () => {
    const trades = [trade({ netPnl: 1000 })];
    const s = computeSummary(trades);
    expect(s.profitFactor).toBe(Number.POSITIVE_INFINITY);
    expect(s.winRate).toBe(1);
  });

  it("handles empty trade list", () => {
    const s = computeSummary([]);
    expect(s.totalTrades).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.profitFactor).toBeNull();
    expect(s.expectancy).toBe(0);
  });

  it("counts break-even trades separately from wins and losses", () => {
    const trades = [
      trade({ netPnl: 0 }),
      trade({ netPnl: 100 }),
      trade({ netPnl: -100 }),
    ];
    const s = computeSummary(trades);
    expect(s.winningTrades).toBe(1);
    expect(s.losingTrades).toBe(1);
    expect(s.breakEvenTrades).toBe(1);
    expect(s.winRate).toBeCloseTo(1 / 3);
  });
});

describe("computeDrawdown", () => {
  it("computes max drawdown over equity curve", () => {
    const curve = [
      { date: "2026-01-01", equity: 10000 },
      { date: "2026-01-02", equity: 12000 },
      { date: "2026-01-03", equity: 9000 }, // -25% from peak
      { date: "2026-01-04", equity: 11000 },
    ];
    const d = computeDrawdown(curve);
    expect(d.maxDrawdown).toBeCloseTo(-0.25);
    expect(d.peakEquity).toBe(12000);
    expect(d.troughEquity).toBe(9000);
    expect(d.currentDrawdown).toBeCloseTo((11000 - 12000) / 12000);
  });

  it("returns null stats for empty curve", () => {
    const d = computeDrawdown([]);
    expect(d.maxDrawdown).toBeNull();
    expect(d.currentDrawdown).toBeNull();
  });
});

describe("groupByDirection", () => {
  it("groups LONG and SHORT performance", () => {
    const trades = [
      trade({ netPnl: 1000, fees: 100, direction: "LONG" }),
      trade({ netPnl: -200, fees: 100, direction: "LONG" }),
      trade({ netPnl: 500, fees: 100, direction: "SHORT" }),
    ];
    const groups = groupByDirection(trades);
    const long = groups.find((g) => g.key === "LONG");
    const short = groups.find((g) => g.key === "SHORT");
    expect(long?.netPnl).toBe(800);
    expect(long?.winRate).toBe(0.5);
    expect(short?.netPnl).toBe(500);
    expect(short?.winRate).toBe(1);
  });
});

describe("computeCapitalFlow", () => {
  it("separates deposits and withdrawals (Deposit ≠ Profit)", () => {
    const summary = computeCapitalFlow([
      { type: "DEPOSIT", amount: 100000 },
      { type: "DEPOSIT", amount: 50000 },
      { type: "WITHDRAWAL", amount: 20000 },
      { type: "INTEREST", amount: 100 },
    ]);
    expect(summary.totalDeposits).toBe(150000);
    expect(summary.totalWithdrawals).toBe(20000);
    expect(summary.netCapitalFlow).toBe(130100);
  });
});