import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, type AccountSummary, type Position } from "../services/api";
import { useAccounts, useActiveAccountId } from "../hooks/useAccounts";
import {
  DirectionBadge,
  ErrorState,
  Loading,
  NoAccountState,
  PageTitle,
  PnlText,
  StatCard,
} from "../components/ui";
import { formatMoney, formatPrice, formatNumber } from "../utils/format";

export function PortfolioPage() {
  const { t, i18n } = useTranslation();
  const accounts = useAccounts();
  const accountId = useActiveAccountId();
  const lang = i18n.language.startsWith("th") ? "th" : "en";

  const account = useQuery({
    queryKey: ["account-summary", accountId],
    queryFn: () => api.get<AccountSummary>(`/accounts/${accountId}`),
    enabled: accountId !== undefined,
  });

  const positions = useQuery({
    queryKey: ["positions", accountId],
    queryFn: () => api.get<Position[]>("/positions", { accountId }),
    enabled: accountId !== undefined,
  });

  if (accountId === undefined && accounts.isLoading) {
    return <Loading label={t("common.loading")} />;
  }
  if (accountId === undefined) {
    return <NoAccountState />;
  }
  if (account.isLoading) {
    return <Loading label={t("common.loading")} />;
  }
  if (account.isError || !account.data) {
    return <ErrorState message={t("common.error")} />;
  }

  const a = account.data;

  return (
    <div className="space-y-10">
      <PageTitle title={t("portfolio.title")} />

      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label={t("portfolio.cards.currentEquity")}
          value={formatMoney(a.equityBalance, lang)}
          accent
        />
        <StatCard
          label={t("portfolio.cards.cashBalance")}
          value={formatMoney(a.cashBalance, lang)}
        />
        <StatCard
          label={t("portfolio.cards.unrealizedPnl")}
          value={<PnlText value={a.unrealizedPnl} lang={lang} />}
        />
        <StatCard
          label={t("common.realizedPnl")}
          value={<PnlText value={a.realizedPnl} lang={lang} />}
        />
      </div>

      <div className="rounded-xxxl border border-hairline-soft bg-canvas">
        <div className="border-b border-hairline-soft px-8 py-6">
          <h2 className="text-[24px] font-medium leading-tight text-ink-deep">
            {t("portfolio.cards.openPositions")}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline-soft text-left text-xs font-medium uppercase tracking-wide text-steel">
                <th className="px-8 py-3">{t("portfolio.positionTable.instrument")}</th>
                <th className="px-8 py-3">{t("portfolio.positionTable.direction")}</th>
                <th className="px-8 py-3 text-right">{t("portfolio.positionTable.quantity")}</th>
                <th className="px-8 py-3 text-right">{t("portfolio.positionTable.averagePrice")}</th>
                <th className="px-8 py-3 text-right">{t("portfolio.positionTable.marketPrice")}</th>
                <th className="px-8 py-3 text-right">{t("portfolio.positionTable.unrealizedPnl")}</th>
              </tr>
            </thead>
            <tbody>
              {(positions.data ?? []).map((p) => (
                <tr key={p.id} className="border-b border-hairline-soft last:border-0">
                  <td className="px-8 py-4 font-medium text-ink-deep">{p.instrument}</td>
                  <td className="px-8 py-4">
                    <DirectionBadge direction={p.direction} />
                  </td>
                  <td className="px-8 py-4 text-right">{formatNumber(p.quantity, lang)}</td>
                  <td className="px-8 py-4 text-right">{formatPrice(p.averagePrice, lang)}</td>
                  <td className="px-8 py-4 text-right">{formatPrice(p.marketPrice, lang)}</td>
                  <td className="px-8 py-4 text-right">
                    <PnlText value={p.unrealizedPnl} lang={lang} />
                  </td>
                </tr>
              ))}
              {(positions.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-stone">
                    {t("common.empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}