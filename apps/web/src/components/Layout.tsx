import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

const navItems = [
  { key: "dashboard", path: "/", i18nKey: "nav.dashboard" },
  { key: "portfolio", path: "/portfolio", i18nKey: "nav.portfolio" },
  { key: "transactions", path: "/transactions", i18nKey: "nav.transactions" },
  { key: "cashflow", path: "/cash-flow", i18nKey: "nav.cashFlow" },
  { key: "analytics", path: "/analytics", i18nKey: "nav.analytics" },
  { key: "settings", path: "/settings", i18nKey: "nav.settings" },
] as const;

export function Layout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b border-hairline-soft bg-canvas">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-6">
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-deep text-sm font-bold text-canvas">
              T
            </span>
            <span className="text-base font-bold tracking-tight text-ink-deep">
              {t("appName")}
            </span>
          </div>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                    isActive
                      ? "bg-ink-deep text-canvas"
                      : "text-ink hover:bg-surface-soft"
                  }`
                }
              >
                {t(item.i18nKey)}
              </NavLink>
            ))}
          </nav>

          <div className="shrink-0">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-6 py-10">
        <Outlet />
      </main>

      <footer className="border-t border-hairline-soft bg-canvas">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-stone">
          <span>{t("appName")}</span>
          <span>TFEX Trading Intelligence</span>
        </div>
      </footer>
    </div>
  );
}
