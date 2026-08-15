import { PRICE_SCALE } from "@tfex/shared";

/**
 * P/L engine (AGENTS.md §13, §62-65).
 *
 * All money is integer satang; all prices are integer points at scale 100.
 * No floating-point arithmetic is used.
 *
 * pointValue is expressed in satang per one full index point. TFEX SET50
 * futures use a contract multiplier of THB 1,000 per index point.
 */

export const DEFAULT_POINT_VALUE_SATANG = 100_000; // THB 1,000 per point

/** Convert an integer price (scale 100) to a decimal point string. */
export function pricePointsToNumber(points: number): number {
  return points / Number(PRICE_SCALE);
}

/**
 * Gross P/L in satang for closing `quantity` contracts.
 *
 * direction LONG: profit when exit > entry.
 * direction SHORT: profit when exit < entry.
 *
 * gross = (exit - entry) * directionSign * quantity * pointValue / SCALE
 */
export function grossPnlSatang(params: {
  direction: "LONG" | "SHORT";
  entryPrice: number; // integer points
  exitPrice: number; // integer points
  quantity: number;
  pointValueSatang?: number;
}): number {
  const pointValue = params.pointValueSatang ?? DEFAULT_POINT_VALUE_SATANG;
  const sign = params.direction === "LONG" ? 1 : -1;
  // (exit - entry) * sign, integer points difference
  const priceDiff = params.exitPrice - params.entryPrice;
  const signedDiff = priceDiff * sign;
  // Avoid floating point: compute in satang using integer math.
  // gross = signedDiff(scale 100) * quantity * pointValue / 100
  const numerator = signedDiff * params.quantity * pointValue;
  return Math.trunc(numerator / Number(PRICE_SCALE));
}

/** Sum of fee components in satang. */
export function totalFeeSatang(fees: {
  commission?: number | null;
  tradingFee?: number | null;
  clearingFee?: number | null;
  regulatoryFee?: number | null;
  vat?: number | null;
  otherFee?: number | null;
}): number {
  return (
    (fees.commission ?? 0) +
    (fees.tradingFee ?? 0) +
    (fees.clearingFee ?? 0) +
    (fees.regulatoryFee ?? 0) +
    (fees.vat ?? 0) +
    (fees.otherFee ?? 0)
  );
}

/** Net P/L = gross P/L - fees. */
export function netPnlSatang(grossPnl: number, fees: number): number {
  return grossPnl - fees;
}

/**
 * Weighted average entry/exit price (integer points).
 *
 * quantity-weighted average of integer prices. Truncation is acceptable at
 * the 0.01-point scale and keeps the value an exact integer.
 */
export function weightedAveragePrice(
  lots: ReadonlyArray<{ quantity: number; price: number }>,
): number {
  let totalQty = 0;
  let weighted = 0;
  for (const lot of lots) {
    totalQty += lot.quantity;
    weighted += lot.quantity * lot.price;
  }
  if (totalQty === 0) {
    return 0;
  }
  return Math.trunc(weighted / totalQty);
}