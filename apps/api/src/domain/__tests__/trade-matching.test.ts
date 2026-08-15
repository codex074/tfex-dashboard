import { describe, expect, it } from "vitest";
import { computeTrade, type TransactionInput } from "../trade-matching.js";

describe("computeTrade", () => {
  it("handles single OPEN + single CLOSE (AGENTS.md §65)", () => {
    const txs: TransactionInput[] = [
      { action: "OPEN", quantity: 1, price: 107000 }, // 1070.00
      { action: "CLOSE", quantity: 1, price: 107500 }, // 1075.00
    ];
    const trade = computeTrade("LONG", txs);
    expect(trade.totalEntryQuantity).toBe(1);
    expect(trade.totalExitQuantity).toBe(1);
    expect(trade.averageEntryPrice).toBe(107000);
    expect(trade.averageExitPrice).toBe(107500);
    expect(trade.grossPnl).toBe(500000); // 5 points × 1000 THB = 5000.00
    expect(trade.totalFees).toBe(0);
    expect(trade.netPnl).toBe(500000);
    expect(trade.status).toBe("CLOSED");
  });

  it("supports scale-in and scale-out FIFO", () => {
    const txs: TransactionInput[] = [
      { action: "OPEN", quantity: 1, price: 107000 }, // 1070.00
      { action: "OPEN", quantity: 1, price: 108000 }, // 1080.00
      { action: "CLOSE", quantity: 1, price: 109000 }, // 1090.00
      { action: "CLOSE", quantity: 1, price: 109000 }, // 1090.00
    ];
    const trade = computeTrade("LONG", txs);
    // FIFO: 1070->1090 = +20 points (20,000 THB); 1080->1090 = +10 (10,000)
    expect(trade.grossPnl).toBe(3000000);
    expect(trade.totalEntryQuantity).toBe(2);
    expect(trade.totalExitQuantity).toBe(2);
    expect(trade.averageEntryPrice).toBe(107500);
    expect(trade.status).toBe("CLOSED");
  });

  it("supports partial close (PARTIAL status)", () => {
    const txs: TransactionInput[] = [
      { action: "OPEN", quantity: 2, price: 107000 },
      { action: "CLOSE", quantity: 1, price: 108000 },
    ];
    const trade = computeTrade("LONG", txs);
    expect(trade.status).toBe("PARTIAL");
    expect(trade.totalEntryQuantity).toBe(2);
    expect(trade.totalExitQuantity).toBe(1);
    expect(trade.grossPnl).toBe(1000000); // +10 points × 1000 THB
  });

  it("computes SHORT profit correctly", () => {
    const txs: TransactionInput[] = [
      { action: "OPEN", quantity: 1, price: 108000 },
      { action: "CLOSE", quantity: 1, price: 107000 },
    ];
    const trade = computeTrade("SHORT", txs);
    expect(trade.grossPnl).toBe(1000000); // +10 points × 1000 THB
    expect(trade.status).toBe("CLOSED");
  });

  it("sums fees from all transactions", () => {
    const txs: TransactionInput[] = [
      { action: "OPEN", quantity: 1, price: 107000, fees: { commission: 500 } },
      {
        action: "CLOSE",
        quantity: 1,
        price: 108000,
        fees: { commission: 500, vat: 35 },
      },
    ];
    const trade = computeTrade("LONG", txs);
    expect(trade.grossPnl).toBe(1000000); // +10 points
    expect(trade.totalFees).toBe(1035);
    expect(trade.netPnl).toBe(998965);
  });

  it("status OPEN when no close", () => {
    const trade = computeTrade("LONG", [
      { action: "OPEN", quantity: 1, price: 107000 },
    ]);
    expect(trade.status).toBe("OPEN");
    expect(trade.grossPnl).toBe(0);
    expect(trade.averageExitPrice).toBeNull();
  });
});