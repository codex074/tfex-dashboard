import {
  bahtStringToSatang,
  priceStringToPoints,
} from "@tfex/shared";

/** Convert a decimal Baht string from the wire into integer satang. */
export function parseMoney(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return Number(bahtStringToSatang(value));
}

export function parseMoneyOrZero(
  value: string | null | undefined,
): number {
  const parsed = parseMoney(value);
  return parsed ?? 0;
}

/** Convert a decimal price string into integer points (scale 100). */
export function parsePrice(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return Number(priceStringToPoints(value));
}

export function parsePriceOrZero(
  value: string | null | undefined,
): number {
  const parsed = parsePrice(value);
  return parsed ?? 0;
}