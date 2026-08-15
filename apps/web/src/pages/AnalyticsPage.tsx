import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, type AnalyticsSummary, type GroupedMetric } from "../services/api";
import { useAccounts, useActiveAccountId } from "../hooks/useAccounts";
import {
  ErrorState,
  Loading,
  NoAccountState,
  PageTitle,
  PnlText,
  ProfitFactorText,
  StatCard,
} from "../components/ui";
import { formatMoney, formatPercent, formatNumber } from "../utils/format";

export function AnalyticsPage() {
  const { t, i18n } = useTranslation();
  const accounts = useAccounts();
  const accountId = useActiveAccountId();
  const lang = i18n.language.startsWith("th") ? "th" : "en";

  const summary = useQuery({
    queryKey: ["analytics-summary", accountId],
    queryFn: () =>
      api.get<AnalyticsSummary>("/analytics/summary", { accountId }),
    enabled: accountId !== undefined,
  });

  const directions = useQuery({
    queryKey: ["analytics-directions", accountId],
    queryFn: () =>
      api.get<GroupedMetric[]>("/analytics/directions", { accountId }),
    enabled: accountId !== undefined,
  });

  const instruments = useQuery({
    queryKey: ["analytics-instruments", accountId],
    queryFn: () =>
      api.get<GroupedMetric[]>("/analytics/instruments", { accountId }),
    enabled: accountId !== undefined,
  });

  if (accountId === undefined && accounts.isLoading) {
    return <Loading label={t("common.loading")} />;
  }
  if (accountId === undefined) {
    return <NoAccountState />;
  }
  if (summary.isLoading) {
    return <Loading label={t("common.loading")} />;
  }
  if (summary.isError || !summary.data) {
    return <ErrorState message={t("common.error")} />;
  }

  const s = summary.data;

  return (
    <div className="space-y-10">
      <PageTitle title={t("analytics.title")} />

      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label={t("analytics.summary.totalTrades")}
          value={formatNumber(s.totalTrades, lang)}
          accent
        />
        <StatCard
          label={t("analytics.summary.winRate")}
          value={formatPercent(s.winRate, lang)}
        />
        <StatCard
          label={t("analytics.summary.profitFactor")}
          value={<ProfitFactorText value={s.profitFactor} lang={lang} />}
        />
        <StatCard
          label={t("analytics.summary.totalContracts")}
          value={formatNumber(s.totalContracts, lang)}
        />
        <StatCard
          label={t("analytics.summary.grossProfit")}
          value={formatMoney(s.grossProfit, lang)}
        />
        <StatCard
          label={t("analytics.summary.grossLoss")}
          value={formatMoney(s.grossLoss, lang)}
        />
        <StatCard
          label={t("analytics.summary.netProfit")}
          value={<PnlText value={s.netProfit} lang={lang} />}
        />
        <StatCard
          label={t("analytics.summary.totalFees")}
          value={formatMoney(s.totalFees, lang)}
        />
        <StatCard
          label={t("analytics.summary.averageWin")}
          value={formatMoney(s.averageWin, lang)}
        />
        <StatCard
          label={t("analytics.summary.averageLoss")}
          value={formatMoney(s.averageLoss, lang)}
        />
        <StatCard
          label={t("analytics.summary.largestWin")}
          value={formatMoney(s.largestWin, lang)}
        />
        <StatCard
          label={t("analytics.summary.largestLoss")}
          value={formatMoney(s.largestLoss, lang)}
        />
      </div>

      <GroupedTable
        title={t("analytics.byDirection")}
        data={directions.data ?? []}
        lang={lang}
      />
      <GroupedTable
        title={t("analytics.byInstrument")}
        data={instruments.data ?? []}
        lang={lang}
      />
    </div>
  );
}

function GroupedTable({
  title,
  data,
  lang,
}: {
  title: string;
  data: GroupedMetric[];
  lang: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xxxl border border-hairline-soft bg-canvas">
      <div className="border-b border-hairline-soft px-8 py-6">
        <h2 className="text-[24px] font-medium leading-tight text-ink-deep">
          {title}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline-soft text-left text-xs font-medium uppercase tracking-wide text-steel">
              <th className="px-8 py-3">{t("analytics.byInstrument")}</th>
              <th className="px-8 py-3 text-right">{t("analytics.summary.totalTrades")}</th>
              <th className="px-8 py-3 text-right">{t("analytics.summary.winRate")}</th>
              <th className="px-8 py-3 text-right">{t("analytics.summary.netProfit")}</th>
              <th className="px-8 py-3 text-right">{t("analytics.summary.profitFactor")}</th>
              <th className="px-8 py-3 text-right">{t("analytics.summary.expectancy")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.key} className="border-b border-hairline-soft last:border-0">
                <td className="px-8 py-4 font-medium text-ink-deep">{row.key}</td>
                <td className="px-8 py-4 text-right text-ink">
                  {formatNumber(row.trades, lang)}
                </td>
                <td className="px-8 py-4 text-right text-ink">
                  {formatPercent(row.winRate, lang)}
                </td>
                <td className="px-8 py-4 text-right">
                  <PnlText value={row.netPnl} lang={lang} />
                </td>
                <td className="px-8 py-4 text-right">
                  <ProfitFactorText value={row.profitFactor} lang={lang} />
                </td>
                <td className="px-8 py-4 text-right text-ink">
                  {formatMoney(row.expectancy, lang)}
                </td>
              </tr>
            ))}
            {data.length === 0 ? (
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
  );
}