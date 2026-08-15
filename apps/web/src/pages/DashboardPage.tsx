import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type DashboardSummary, type EquityCurve, type Trade } from "../services/api";
import { useActiveAccountId } from "../hooks/useAccounts";
import { DirectionBadge, ErrorState, Loading, StatCard, PageTitle } from "../components/ui";
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

  if (summary.isLoading || equity.isLoading) {
    return <Loading label={t("common.loading")} />;
  }
  if (summary.isError || !summary.data) {
    return <ErrorState message={t("common.error")} />;
  }

  const s = summary.data;
  const chartData =
    equity.data?.points.map((p) => ({
      date: p.date,
      equity: Number(p.equity),
    })) ?? [];

  return (
    <div className="space-y-10">
      <PageTitle title={t("dashboard.title")} />

      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label={t("dashboard.cards.portfolioEquity")}
          value={formatMoney(s.portfolioEquity, lang)}
          accent
        />
        <StatCard
          label={t("dashboard.cards.netTradingPnl")}
          value={formatMoney(s.netTradingPnl, lang)}
        />
        <StatCard
          label={t("dashboard.cards.totalDeposits")}
          value={formatMoney(s.totalDeposits, lang)}
        />
        <StatCard
          label={t("dashboard.cards.totalWithdrawals")}
          value={formatMoney(s.totalWithdrawals, lang)}
        />
        <StatCard
          label={t("dashboard.cards.winRate")}
          value={formatPercent(s.winRate, lang)}
        />
        <StatCard
          label={t("dashboard.cards.profitFactor")}
          value={formatProfitFactor(s.profitFactor, lang)}
        />
        <StatCard
          label={t("dashboard.cards.totalFees")}
          value={formatMoney(s.totalFees, lang)}
        />
        <StatCard
          label={t("dashboard.cards.maxDrawdown")}
          value={formatPercent(s.maxDrawdown, lang)}
        />
        <StatCard label={t("dashboard.cards.notionalExposure")} value={formatMoney(s.notionalExposure, lang)} />
        <StatCard label={t("dashboard.cards.effectiveLeverage")} value={s.effectiveLeverage === null ? "—" : `${s.effectiveLeverage.toLocaleString(undefined, { maximumFractionDigits: 2 })}x`} />
        <StatCard label={t("dashboard.cards.marginUsed")} value={formatMoney(s.marginUsed, lang)} />
        <StatCard label={t("dashboard.cards.marginUtilization")} value={formatPercent(s.marginUtilization, lang)} />
      </div>

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
                  <td className="px-8 py-4 text-right">
                    <button className="rounded-full bg-ink-deep px-4 py-2 text-xs font-bold text-canvas transition-colors hover:bg-charcoal" onClick={() => { setClosingTrade(trade); setCloseDate(new Date().toISOString().slice(0, 10)); setClosePrice(""); setCloseFee(""); }}>
                      {t("dashboard.closePosition")}
                    </button>
                  </td>
                </tr>
              ))}
              {(openTrades.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-10 text-center text-stone">
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
        <div className="border-b border-hairline-soft px-8 py-6">
          <h2 className="text-[24px] font-medium leading-tight text-ink-deep">
            {t("dashboard.equityCurve")}
          </h2>
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
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
