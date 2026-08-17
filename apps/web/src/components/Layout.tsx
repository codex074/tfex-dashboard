import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { persistLanguage } from "../i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAuth } from "../auth/AuthContext";

const navItems = [
  { key: "dashboard", path: "/", i18nKey: "nav.dashboard", icon: "📊" },
  { key: "portfolio", path: "/portfolio", i18nKey: "nav.portfolio", icon: "💼" },
  { key: "transactions", path: "/transactions", i18nKey: "nav.transactions", icon: "🧾" },
  { key: "sessions", path: "/sessions", i18nKey: "nav.sessions", icon: "📈" },
  { key: "cashflow", path: "/cash-flow", i18nKey: "nav.cashFlow", icon: "💸" },
  { key: "analytics", path: "/analytics", i18nKey: "nav.analytics", icon: "🔍" },
  { key: "settings", path: "/settings", i18nKey: "nav.settings", icon: "⚙️" },
] as const;

export function Layout() {
  const { t, i18n } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const currentLang = i18n.language.startsWith("th") ? "th" : "en";

  function toggleLanguage() {
    const next = currentLang === "th" ? "en" : "th";
    persistLanguage(next);
    void i18n.changeLanguage(next);
  }

  return (
    <div className="min-h-screen bg-canvas">
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-ink-deep/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`group fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-hairline-soft bg-canvas transition-all duration-200 lg:w-[76px] lg:hover:w-64 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex h-16 items-center gap-3 overflow-hidden px-4">
          <img
            src="/favicon.png"
            alt={t("appName")}
            className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-sm"
          />
          <span className="whitespace-nowrap text-base font-bold tracking-tight text-ink-deep transition-all duration-200 lg:max-w-0 lg:opacity-0 lg:group-hover:max-w-xs lg:group-hover:opacity-100">
            {t("appName")}
          </span>
        </div>

        <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.path === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-bold transition-colors ${
                  isActive
                    ? "bg-gradient-to-r from-ink-deep to-primary-deep text-canvas shadow-sm"
                    : "text-ink hover:bg-surface-soft"
                }`
              }
            >
              <span className="shrink-0 text-base leading-none">{item.icon}</span>
              <span className="overflow-hidden whitespace-nowrap transition-all duration-200 lg:max-w-0 lg:opacity-0 lg:group-hover:max-w-xs lg:group-hover:opacity-100">
                {t(item.i18nKey)}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-hairline-soft p-3">
          <div className="mb-2 overflow-hidden rounded-xl bg-surface-soft px-3 py-2 lg:hidden lg:group-hover:block">
            <p className="truncate text-xs font-bold text-ink">{user?.displayName}</p>
            <p className="truncate text-[11px] text-stone">{user?.role}</p>
            <button type="button" className="mt-1 text-xs font-bold text-critical" onClick={() => void logout()}>{t("auth.logout")}</button>
          </div>
          <div className="lg:hidden">
            <LanguageSwitcher />
          </div>
          <div className="hidden lg:block">
            <div className="flex justify-center lg:group-hover:hidden">
              <button
                type="button"
                onClick={toggleLanguage}
                aria-label={t("language.thai")}
                title={t("language.thai")}
                className="flex h-9 w-9 items-center justify-center rounded-full text-base transition-colors hover:bg-surface-soft"
              >
                🌐
              </button>
            </div>
            <div className="hidden lg:group-hover:block">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-hairline-soft bg-canvas px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Menu"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl transition-colors hover:bg-surface-soft"
        >
          ☰
        </button>
        <img
          src="/favicon.png"
          alt={t("appName")}
          className="h-7 w-7 rounded-lg object-cover"
        />
        <span className="text-sm font-bold text-ink-deep">{t("appName")}</span>
      </header>

      <div className="lg:pl-[76px]">
        <main className="mx-auto max-w-[1440px] px-6 py-10">
          <Outlet />
        </main>

        <footer className="border-t border-hairline-soft bg-canvas">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-stone">
            <span>{t("appName")}</span>
            <span>TFEX Trading Intelligence</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
