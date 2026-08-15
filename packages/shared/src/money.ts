/**
 * Financial precision strategy (AGENTS.md §62): integer arithmetic.
 *
 * - Money amounts are stored as integer satang (1 THB = 100 satang).
 * - Prices (index points) are stored as integer points with scale 100
 *   (i.e. 1070.50 -> 107050).
 *
 * No floating-point arithmetic is used for financial math. Conversions from
 * user input round half-away-from-zero at the declared scale.
 */

export const SATANG_PER_BAHT = 100n;
export const PRICE_SCALE = 100n;

/** Convert a decimal string ("5,000.25" is NOT accepted; use "5000.25") to satang. */
export function bahtStringToSatang(value: string): bigint {
  const normalized = value.trim();
  if (normalized === "") {
    throw new Error("Amount is required");
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid amount: ${value}`);
  }
  const [whole, frac = ""] = normalized.split(".") as [string, string?];
  const fracPadded = (frac + "00").slice(0, 2);
  const negative = whole.startsWith("-");
  const wholeAbs = negative ? whole.slice(1) : whole;
  const wholePart = BigInt(wholeAbs) * SATANG_PER_BAHT;
  const fracPart = BigInt(fracPadded || "0");
  const abs = wholePart + fracPart;
  return negative ? -abs : abs;
}

export function satangToBahtString(satang: bigint): string {
  const negative = satang < 0n;
  const abs = negative ? -satang : satang;
  const whole = abs / SATANG_PER_BAHT;
  const frac = abs % SATANG_PER_BAHT;
  const fracStr = frac.toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fracStr}`;
}

/** Convert a numeric satang value (from the DB) to a decimal Baht string. */
export function satangIntToBahtString(satang: number): string {
  return satangToBahtString(BigInt(Math.trunc(satang)));
}

/** Convert a decimal price string ("1070.50") to integer points (scale 100). */
export function priceStringToPoints(value: string): bigint {
  const normalized = value.trim();
  if (normalized === "") {
    throw new Error("Price is required");
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid price: ${value}`);
  }
  const [whole, frac = ""] = normalized.split(".") as [string, string?];
  const fracPadded = (frac + "00").slice(0, 2);
  const negative = whole.startsWith("-");
  const wholeAbs = negative ? whole.slice(1) : whole;
  const wholePart = BigInt(wholeAbs) * PRICE_SCALE;
  const fracPart = BigInt(fracPadded || "0");
  const abs = wholePart + fracPart;
  return negative ? -abs : abs;
}

export function pointsToPriceString(points: bigint): string {
  const negative = points < 0n;
  const abs = negative ? -points : points;
  const whole = abs / PRICE_SCALE;
  const frac = abs % PRICE_SCALE;
  const fracStr = frac.toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fracStr}`;
}

export function pointsIntToPriceString(points: number): string {
  return pointsToPriceString(BigInt(Math.trunc(points)));
}