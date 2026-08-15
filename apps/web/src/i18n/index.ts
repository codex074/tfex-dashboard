import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import thCommon from "./locales/th/common.json";
import thDashboard from "./locales/th/dashboard.json";
import thTrades from "./locales/th/trades.json";
import thJournal from "./locales/th/journal.json";
import thAnalytics from "./locales/th/analytics.json";
import thPortfolio from "./locales/th/portfolio.json";
import thCashflow from "./locales/th/cashflow.json";

import enCommon from "./locales/en/common.json";
import enDashboard from "./locales/en/dashboard.json";
import enTrades from "./locales/en/trades.json";
import enJournal from "./locales/en/journal.json";
import enAnalytics from "./locales/en/analytics.json";
import enPortfolio from "./locales/en/portfolio.json";
import enCashflow from "./locales/en/cashflow.json";

export const STORAGE_KEY = "tfex.language";
export type SupportedLanguage = "th" | "en";

/**
 * Language persistence strategy (AGENTS.md §4-6):
 *   Saved preference → Thai default.
 */
export function getInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") {
    return "th";
  }
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "th" || saved === "en") {
    return saved;
  }
  return "th";
}

export const resources = {
  th: {
    common: {
      ...thCommon,
      dashboard: thDashboard,
      trades: thTrades,
      journal: thJournal,
      analytics: thAnalytics,
      portfolio: thPortfolio,
      cashflow: thCashflow,
    },
  },
  en: {
    common: {
      ...enCommon,
      dashboard: enDashboard,
      trades: enTrades,
      journal: enJournal,
      analytics: enAnalytics,
      portfolio: enPortfolio,
      cashflow: enCashflow,
    },
  },
} as const;

export function initI18n() {
  const lng = getInitialLanguage();
  void i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: "th",
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
    },
  });
  return i18n;
}

export function persistLanguage(language: SupportedLanguage) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, language);
  }
}

export default i18n;
