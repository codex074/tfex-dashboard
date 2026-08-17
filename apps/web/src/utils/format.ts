/**
 * Locale-aware number & date formatting (AGENTS.md §11-12).
 *
 * Money is received from the API as decimal strings (e.g. "52996.20").
 * Prices are decimal strings (e.g. "1070.50"). Dates are ISO "YYYY-MM-DD".
 */

const BAHT_LOCALES: Record<string, string> = {
  th: "th-TH",
  en: "en-US",
};

export function formatMoney(
  value: string | number | null | undefined,
  lang: string,
): string {
  const num = typeof value === "string" ? Number(value) : value ?? 0;
  const locale = BAHT_LOCALES[lang] ?? "th-TH";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPrice(
  value: string | number | null | undefined,
  lang: string,
): string {
  const num = typeof value === "string" ? Number(value) : value ?? 0;
  const locale = BAHT_LOCALES[lang] ?? "th-TH";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPercent(
  value: number | null | undefined,
  lang: string,
): string {
  if (value === null || value === undefined) {
    return "—";
  }
  const locale = BAHT_LOCALES[lang] ?? "th-TH";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(
  date: string | null | undefined,
  lang: string,
): string {
  if (!date) {
    return "—";
  }
  const locale = lang === "th" ? "th-TH" : "en-US";
  // Trading dates are date-only values, not local timestamps. Parse at UTC
  // midnight so rendering with timeZone: "UTC" cannot shift Thailand dates
  // back by one day.
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    return date;
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatNumber(
  value: number | null | undefined,
  lang: string,
): string {
  const locale = BAHT_LOCALES[lang] ?? "th-TH";
  return new Intl.NumberFormat(locale).format(value ?? 0);
}

export function formatProfitFactor(
  value: number | null | undefined,
  lang: string,
): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (value === Number.POSITIVE_INFINITY) {
    return "∞";
  }
  return new Intl.NumberFormat(BAHT_LOCALES[lang] ?? "th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
