import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
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

      <section className="space-y-4">
        <SectionHeading title={t("analytics.overview.title")} subtitle={t("analytics.overview.subtitle")} />
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="rounded-feature bg-gradient-to-br from-ink-deep via-[#102c45] to-primary-deep p-7 text-canvas lg:col-span-4 lg:p-8"><p className="text-sm font-medium text-canvas/65">{t("analytics.summary.netProfit")}</p><div className="mt-3 text-3xl font-medium tracking-tight sm:text-[34px]"><PnlText value={s.netProfit} lang={lang} /></div></div>
          <div className="rounded-xxxl border border-primary/15 bg-sky-soft p-7 lg:col-span-4"><p className="text-sm font-medium text-steel">{t("analytics.summary.totalTrades")}</p><p className="mt-3 text-3xl font-medium tracking-tight text-ink-deep">{formatNumber(s.totalTrades, lang)}</p><p className="mt-2 text-sm text-slate">{formatNumber(s.totalContracts, lang)} {t("analytics.contracts")}</p></div>
          <div className="grid overflow-hidden rounded-xxxl border border-hairline-soft sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1"><MetricCell label={t("analytics.summary.winRate")} value={formatPercent(s.winRate, lang)} tone="mint" /><MetricCell label={t("analytics.summary.profitFactor")} value={<ProfitFactorText value={s.profitFactor} lang={lang} />} tone="violet" /></div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading title={t("analytics.outcomes.title")} subtitle={t("analytics.outcomes.subtitle")} />
        <div className="grid overflow-hidden rounded-xxxl border border-hairline-soft sm:grid-cols-2 xl:grid-cols-4">
          <MetricCell label={t("analytics.summary.grossProfit")} value={formatMoney(s.grossProfit, lang)} positive tone="mint" />
          <MetricCell label={t("analytics.summary.grossLoss")} value={formatMoney(s.grossLoss, lang)} negative tone="rose" />
          <MetricCell label={t("analytics.summary.averageWin")} value={formatMoney(s.averageWin, lang)} positive tone="mint" />
          <MetricCell label={t("analytics.summary.averageLoss")} value={formatMoney(s.averageLoss, lang)} negative tone="rose" />
          <MetricCell label={t("analytics.summary.largestWin")} value={formatMoney(s.largestWin, lang)} positive tone="mint" />
          <MetricCell label={t("analytics.summary.largestLoss")} value={formatMoney(s.largestLoss, lang)} negative tone="rose" />
          <MetricCell label={t("analytics.summary.expectancy")} value={formatMoney(s.expectancy, lang)} tone="violet" />
          <MetricCell label={t("analytics.summary.totalFees")} value={formatMoney(s.totalFees, lang)} tone="amber" />
        </div>
      </section>

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

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2 className="text-xl font-medium text-ink-deep">{title}</h2><p className="mt-1 text-sm text-slate">{subtitle}</p></div>;
}

function MetricCell({ label, value, positive = false, negative = false, tone }: { label: string; value: ReactNode; positive?: boolean; negative?: boolean; tone?: "mint" | "violet" | "amber" | "rose" }) {
  const toneClass = tone === "mint" ? "bg-mint-soft" : tone === "violet" ? "bg-violet-soft" : tone === "amber" ? "bg-amber-soft" : tone === "rose" ? "bg-rose-soft" : "bg-canvas";
  return <div className={`min-w-0 border-b border-hairline-soft p-5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0 ${toneClass}`}><p className="text-xs font-medium text-steel">{label}</p><div className={`mt-2 truncate text-xl font-medium tracking-tight ${positive ? "text-success" : negative ? "text-critical" : "text-ink-deep"}`}>{value}</div></div>;
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
