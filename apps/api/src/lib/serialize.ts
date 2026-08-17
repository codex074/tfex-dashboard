import {
  pointsIntToPriceString,
  satangIntToBahtString,
} from "@tfex/shared";

/**
 * Convert DB integer values to API wire representations (decimal strings)
 * for money (satang -> Baht) and prices (points -> decimal points).
 */

export function money(value: number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return satangIntToBahtString(value);
}

export function moneyOrZero(value: number | null | undefined): string {
  return satangIntToBahtString(value ?? 0);
}

export function price(value: number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return pointsIntToPriceString(value);
}

export function priceOrZero(value: number | null | undefined): string {
  return pointsIntToPriceString(value ?? 0);
}

/** Convert integer basis points to a decimal percentage string ("8.5"). */
export function bpsToPercentString(
  value: number | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const whole = Math.trunc(value / 10_000);
  const frac = Math.abs(value % 10_000);
  const fracStr = frac.toString().padStart(4, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}
