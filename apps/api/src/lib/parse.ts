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

/**
 * Convert a percentage string ("8.5") to integer basis points (850).
 * Margin rates are published as percent-of-contract-value.
 */
export function parseBps(
  value: string | null | undefined,
): number | null {
  if (value === null || value === undefined || value.trim() === "") {
    return null;
  }
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Margin rate must be a non-negative percentage");
  }
  const [whole, frac = ""] = normalized.split(".") as [string, string?];
  const fracPadded = (frac + "0000").slice(0, 4);
  return Number(whole) * 10_000 + Number(fracPadded);
}
