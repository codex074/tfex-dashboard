import { describe, expect, it } from "vitest";
import {
  grossPnlSatang,
  netPnlSatang,
  totalFeeSatang,
  weightedAveragePrice,
} from "../pnl.js";

describe("grossPnlSatang", () => {
  it("computes LONG profit when exit > entry", () => {
    // 1 contract @1070 -> @1075, 5 points * 1000 THB = 5000.00 THB
    const gross = grossPnlSatang({
      direction: "LONG",
      entryPrice: 107000,
      exitPrice: 107500,
      quantity: 1,
    });
    expect(gross).toBe(500000); // 5000.00 THB in satang
  });

  it("computes LONG loss when exit < entry", () => {
    const gross = grossPnlSatang({
      direction: "LONG",
      entryPrice: 107000, // 1070.00
      exitPrice: 106000, // 1060.00 -> -10 points
      quantity: 1,
    });
    expect(gross).toBe(-1000000); // -10,000.00 THB
  });

  it("computes SHORT profit when exit < entry", () => {
    const gross = grossPnlSatang({
      direction: "SHORT",
      entryPrice: 107000, // 1070.00
      exitPrice: 106000, // 1060.00 -> +10 points
      quantity: 1,
    });
    expect(gross).toBe(1000000); // 10,000.00 THB
  });

  it("handles fractional point difference (scale 100)", () => {
    const gross = grossPnlSatang({
      direction: "LONG",
      entryPrice: 107000,
      exitPrice: 107050, // 1070.50, 0.5 point
      quantity: 1,
    });
    expect(gross).toBe(50000); // 500.00 THB
  });
});

describe("totalFeeSatang", () => {
  it("sums all fee components", () => {
    const fees = totalFeeSatang({
      commission: 100,
      tradingFee: 50,
      clearingFee: 25,
      regulatoryFee: 10,
      vat: 7,
      otherFee: 3,
    });
    expect(fees).toBe(195);
  });

  it("treats missing fees as zero", () => {
    expect(totalFeeSatang({ commission: 100 })).toBe(100);
    expect(totalFeeSatang({})).toBe(0);
  });
});

describe("netPnlSatang", () => {
  it("subtracts fees from gross", () => {
    expect(netPnlSatang(500000, 19500)).toBe(480500);
  });
});

describe("weightedAveragePrice", () => {
  it("computes quantity-weighted average", () => {
    const avg = weightedAveragePrice([
      { quantity: 1, price: 100000 },
      { quantity: 1, price: 200000 },
    ]);
    expect(avg).toBe(150000);
  });

  it("handles scale-in weights", () => {
    const avg = weightedAveragePrice([
      { quantity: 10, price: 100000 },
      { quantity: 5, price: 120000 },
    ]);
    // (10*100000 + 5*120000)/15 = 1,600,000/15 = 106666.67 -> 106666
    expect(avg).toBe(106666);
  });

  it("returns zero for empty lots", () => {
    expect(weightedAveragePrice([])).toBe(0);
  });
});