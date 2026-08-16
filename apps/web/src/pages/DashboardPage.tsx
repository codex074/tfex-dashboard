import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type DashboardSummary, type EquityCurve, type Trade } from "../services/api";
import { useAccounts, useActiveAccountId } from "../hooks/useAccounts";
import { DirectionBadge, ErrorState, Loading, NoAccountState, PageTitle } from "../components/ui";
import {
  formatMoney,
  formatPercent,
  formatProfitFactor,
  formatDate,
  formatNumber,
  formatPrice,
} from "../utils/format";

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const accounts = useAccounts();
  const accountId = useActiveAccountId();
  const queryClient = useQueryClient();
  const lang = i18n.language.startsWith("th") ? "th" : "en";
  const [closingTrade, setClosingTrade] = useState<Trade | null>(null);
  const [closePrice, setClosePrice] = useState("");
  const [closeDate, setCloseDate] = useState(new Date().toISOString().slice(0, 10));
  const [closeFee, setCloseFee] = useState("");

  const summary = useQuery({
    queryKey: ["dashboard-summary", accountId],
    queryFn: () =>
      api.get<DashboardSummary>("/dashboard/summary", { accountId }),
    enabled: accountId !== undefined,
  });

  const equity = useQuery({
    queryKey: ["dashboard-equity", accountId],
    queryFn: () => api.get<EquityCurve>("/dashboard/equity", { accountId }),
    enabled: accountId !== undefined,
  });
  const openTrades = useQuery({
    queryKey: ["open-trades", accountId],
    queryFn: () => api.get<Trade[]>("/trades", { accountId, status: "OPEN", limit: 100 }),
    enabled: accountId !== undefined,
  });
  const closePosition = useMutation({
    mutationFn: () => {
      if (!closingTrade) return Promise.reject(new Error("No position selected"));
      return api.post(`/trades/${closingTrade.id}/close-position`, { tradeDate: closeDate, price: closePrice, totalFee: closeFee || null });
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["open-trades", accountId] }); void queryClient.invalidateQueries({ queryKey: ["dashboard-summary", accountId] }); setClosingTrade(null); setClosePrice(""); setCloseFee(""); },
  });

  if (accountId === undefined && accounts.isLoading) {
    return <Loading label={t("common.loading")} />;
  }
  if (accountId === undefined) {
    return <NoAccountState />;
  }
  if (summary.isLoading || equity.isLoading) {
    return <Loading label={t("common.loading")} />;
  }
  if (summary.isError || !summary.data) {
    return <ErrorState message={t("common.error")} />;
  }

  const s = summary.data;
  const totalDepositsNum = Number(s.totalDeposits);
  const depositPct =
    totalDepositsNum > 0 ? Number(s.netTradingPnl) / totalDepositsNum : null;
  const chartData =
    equity.data?.points.map((p) => ({
      date: p.date,
      equity: Number(p.equity),
    })) ?? [];

  return (
    <div className="space-y-10">
      <PageTitle title={t("dashboard.title")} />

      <section className="space-y-4">
        <SectionHeading title={t("dashboard.overview.title")} subtitle={t("dashboard.overview.subtitle")} />
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="rounded-feature bg-gradient-to-br from-ink-deep via-[#102c45] to-primary-deep p-7 text-canvas lg:col-span-6 lg:p-8">
            <p className="text-sm font-medium text-canvas/65">{t("dashboard.cards.portfolioEquity")}</p>
            <p className="mt-3 text-3xl font-medium tracking-tight sm:text-[42px]">{formatMoney(s.portfolioEquity, lang)}</p>
          </div>
          <div className="rounded-xxxl border border-success/20 bg-mint-soft p-7 lg:col-span-3">
            <p className="text-sm font-medium text-steel">{t("dashboard.cards.netTradingPnl")}</p>
            <p className={`mt-3 text-2xl font-medium tracking-tight ${Number(s.netTradingPnl) >= 0 ? "text-success" : "text-critical"}`}>{formatMoney(s.netTradingPnl, lang)}</p>
            {depositPct !== null ? <p className={`mt-2 text-sm font-medium ${depositPct >= 0 ? "text-success" : "text-critical"}`}>{formatPercent(depositPct, lang)}</p> : null}
          </div>
          <div className="rounded-xxxl border border-primary/15 bg-sky-soft p-7 lg:col-span-3">
            <p className="text-sm font-medium text-steel">{t("dashboard.cards.netCapitalFlow")}</p>
            <p className="mt-3 text-2xl font-medium tracking-tight text-ink-deep">{formatMoney(totalDepositsNum - Number(s.totalWithdrawals), lang)}</p>
            <div className="mt-3 flex gap-3 text-xs text-slate">
              <span>{t("dashboard.cards.totalDeposits")}: {formatMoney(s.totalDeposits, lang)}</span>
              <span>{t("dashboard.cards.totalWithdrawals")}: {formatMoney(s.totalWithdrawals, lang)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading title={t("dashboard.performance.title")} subtitle={t("dashboard.performance.subtitle")} />
        <div className="grid overflow-hidden rounded-xxxl border border-hairline-soft sm:grid-cols-2 xl:grid-cols-4">
          <MetricCell label={t("dashboard.cards.winRate")} value={formatPercent(s.winRate, lang)} tone="mint" />
          <MetricCell label={t("dashboard.cards.profitFactor")} value={formatProfitFactor(s.profitFactor, lang)} tone="violet" />
          <MetricCell label={t("dashboard.cards.totalFees")} value={formatMoney(s.totalFees, lang)} tone="amber" />
          <MetricCell label={t("dashboard.cards.maxDrawdown")} value={formatPercent(s.maxDrawdown, lang)} negative tone="rose" />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading title={t("dashboard.risk.title")} subtitle={t("dashboard.risk.subtitle")} />
        <div className="grid overflow-hidden rounded-xxxl border border-hairline-soft bg-surface-soft sm:grid-cols-2 xl:grid-cols-4">
          <MetricCell label={t("dashboard.cards.notionalExposure")} value={formatMoney(s.notionalExposure, lang)} soft />
          <MetricCell label={t("dashboard.cards.effectiveLeverage")} value={s.effectiveLeverage === null ? "—" : `${s.effectiveLeverage.toLocaleString(undefined, { maximumFractionDigits: 2 })}x`} soft />
          <MetricCell label={t("dashboard.cards.marginUsed")} value={formatMoney(s.marginUsed, lang)} soft />
          <MetricCell label={t("dashboard.cards.marginUtilization")} value={formatPercent(s.marginUtilization, lang)} soft />
        </div>
      </section>

      <div className="rounded-xxxl border border-hairline-soft bg-canvas">
        <div className="border-b border-hairline-soft px-8 py-6">
          <h2 className="text-[24px] font-medium text-ink-deep">
            {t("dashboard.openPositions")}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline-soft text-left text-xs font-medium uppercase tracking-wide text-steel">
                <th className="px-8 py-3">{t("common.instrument")}</th>
                <th className="px-8 py-3">{t("common.direction")}</th>
                <th className="px-8 py-3 text-right">{t("common.quantity")}</th>
                <th className="px-8 py-3 text-right">{t("dashboard.entryPrice")}</th>
                <th className="px-8 py-3 text-right">{t("dashboard.cards.unrealizedPnl")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(openTrades.data ?? []).map((trade) => (
                <tr key={trade.id} className="border-b border-hairline-soft last:border-0">
                  <td className="px-8 py-4 font-medium text-ink-deep">{trade.instrument}</td>
                  <td className="px-8 py-4">
                    <DirectionBadge direction={trade.direction} />
                  </td>
                  <td className="px-8 py-4 text-right">
                    {formatNumber(trade.totalEntryQuantity - trade.totalExitQuantity, lang)}
                  </td>
                  <td className="px-8 py-4 text-right">
                    {formatPrice(trade.averageEntryPrice ?? "0", lang)}
                  </td>
                  <td className={`px-8 py-4 text-right font-medium ${trade.unrealizedPnl === null ? "text-stone" : Number(trade.unrealizedPnl) >= 0 ? "text-success" : "text-critical"}`}>
                    {trade.unrealizedPnl === null ? "—" : formatMoney(trade.unrealizedPnl, lang)}
                  </td>
                  <td className="px-8 py-4 text-right">
                    <button className="rounded-full bg-ink-deep px-4 py-2 text-xs font-bold text-canvas transition-colors hover:bg-charcoal" onClick={() => { setClosingTrade(trade); setCloseDate(new Date().toISOString().slice(0, 10)); setClosePrice(""); setCloseFee(""); }}>
                      {t("dashboard.closePosition")}
                    </button>
                  </td>
                </tr>
              ))}
              {(openTrades.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-10 text-center text-stone">
                    {t("dashboard.noOpenPositions")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {closingTrade ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink-deep/30 p-4">
          <form className="w-full max-w-md rounded-xxxl bg-canvas p-6 shadow-xl" onSubmit={(event) => { event.preventDefault(); closePosition.mutate(); }}>
            <h2 className="text-xl font-medium text-ink-deep">
              {t("dashboard.closePosition")}: {closingTrade.instrument}
            </h2>
            <label className="mt-5 block text-sm font-medium text-ink">
              {t("dashboard.closeDate")}
              <input className="mt-1.5 w-full rounded-xl border border-hairline-soft px-3 py-2.5" type="date" value={closeDate} onChange={(event) => setCloseDate(event.target.value)} required />
            </label>
            <label className="mt-4 block text-sm font-medium text-ink">
              {t("dashboard.closePrice")}
              <input className="mt-1.5 w-full rounded-xl border border-hairline-soft px-3 py-2.5" type="number" min="0.01" step="0.01" value={closePrice} onChange={(event) => setClosePrice(event.target.value)} required />
            </label>
            <label className="mt-4 block text-sm font-medium text-ink">
              {t("common.fees")}
              <input className="mt-1.5 w-full rounded-xl border border-hairline-soft px-3 py-2.5" type="number" min="0" step="0.01" value={closeFee} onChange={(event) => setCloseFee(event.target.value)} placeholder="0.00" />
            </label>
            {closePosition.isError ? <p className="mt-3 text-sm text-critical">{t("dashboard.closeError")}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="rounded-full px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-surface-soft" onClick={() => setClosingTrade(null)}>
                {t("common.cancel")}
              </button>
              <button className="rounded-full bg-ink-deep px-4 py-2 text-sm font-bold text-canvas transition-colors hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-60" disabled={closePosition.isPending}>
                {t("dashboard.confirmClose")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="rounded-xxxl border border-hairline-soft bg-canvas">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline-soft px-8 py-6">
          <h2 className="text-[24px] font-medium leading-tight text-ink-deep">
            {t("dashboard.equityCurve")}
          </h2>
          <div className="text-right">
            <p className="text-xs font-medium text-steel">{t("dashboard.cards.portfolioEquity")}</p>
            <p className="mt-1 text-lg font-medium text-primary">{formatMoney(s.portfolioEquity, lang)}</p>
          </div>
        </div>
        <div className="p-8">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
              >
                <defs>
                  <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0866ff" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#0866ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceff2" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#7d8895" }} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#7d8895" }}
                  tickFormatter={(value: number) =>
                    new Intl.NumberFormat(lang === "th" ? "th-TH" : "en-US", {
                      notation: "compact",
                    }).format(value)
                  }
                />
                <Tooltip
                  formatter={(value: number | string) => formatMoney(value, lang)}
                  labelFormatter={(label) => formatDate(String(label), lang)}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid #eceff2",
                    boxShadow: "0 1px 4px rgba(20, 22, 26, 0.12)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke="#0866ff"
                  strokeWidth={2}
                  fill="url(#equityGradient)"
                  dot={{ r: 4, fill: "#0866ff", stroke: "#ffffff", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#0866ff", stroke: "#ffffff", strokeWidth: 2 }}
                >
                  <LabelList
                    dataKey="equity"
                    position="top"
                    formatter={(value: number | string) => formatMoney(value, lang)}
                    fill="#5b6673"
                    fontSize={11}
                  />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2 className="text-xl font-medium text-ink-deep">{title}</h2><p className="mt-1 text-sm text-slate">{subtitle}</p></div>;
}

function MetricCell({ label, value, soft = false, negative = false, tone }: { label: string; value: ReactNode; soft?: boolean; negative?: boolean; tone?: "mint" | "violet" | "amber" | "rose" }) {
  const toneClass = tone === "mint" ? "bg-mint-soft" : tone === "violet" ? "bg-violet-soft" : tone === "amber" ? "bg-amber-soft" : tone === "rose" ? "bg-rose-soft" : soft ? "bg-surface-soft" : "bg-canvas";
  return <div className={`min-w-0 border-b border-hairline-soft p-5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0 ${toneClass}`}><p className="text-xs font-medium text-steel">{label}</p><div className={`mt-2 truncate text-xl font-medium tracking-tight ${negative ? "text-critical" : "text-ink-deep"}`}>{value}</div></div>;
}
