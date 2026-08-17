import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "../components/ui";
import { formatMoney, formatPrice, formatNumber, formatPercent } from "../utils/format";

export function PortfolioPage() {
  const { t, i18n } = useTranslation();
  const accounts = useAccounts();
  const accountId = useActiveAccountId();
  const lang = i18n.language.startsWith("th") ? "th" : "en";
  const queryClient = useQueryClient();
  const [markingPosition, setMarkingPosition] = useState<Position | null>(null);
  const [marketPrice, setMarketPrice] = useState("");

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

  const updateMark = useMutation({
    mutationFn: () => {
      if (!markingPosition) return Promise.reject(new Error("No position selected"));
      return api.post<Position>("/positions/mark-price", {
        accountId,
        instrument: markingPosition.instrument,
        direction: markingPosition.direction,
        marketPrice,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["positions", accountId] });
      void queryClient.invalidateQueries({ queryKey: ["account-summary", accountId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary", accountId] });
      setMarkingPosition(null);
      setMarketPrice("");
    },
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
  const positionList = positions.data ?? [];
  const equity = Number(a.equityBalance);
  const marginUsed = positionList.reduce(
    (total, position) => total + Number(position.marginUsed),
    0,
  );
  const totalUnrealized = positionList.reduce(
    (total, position) => total + Number(position.unrealizedPnl),
    0,
  );
  const totalQuantity = positionList.reduce(
    (total, position) => total + position.quantity,
    0,
  );
  const netCapitalFlow = Number(a.netCapitalFlow);
  const netTradingProfit = Number(a.netTradingProfit);
  const unrealized = Number(a.unrealizedPnl);
  const realized = Number(a.realizedPnl);

  // Equity remaining after reserved margin. It naturally includes unrealized
  // P/L (equity = cash + margin + unrealized).
  const availableEquity = equity - marginUsed;

  const depositPct =
    Number(a.totalDeposits) > 0
      ? netTradingProfit / Number(a.totalDeposits)
      : null;
  const marginUtilization = equity > 0 ? marginUsed / equity : null;
  const marginBarColor =
    (marginUtilization ?? 0) >= 1
      ? "bg-critical"
      : (marginUtilization ?? 0) >= 0.6
        ? "bg-attention"
        : "bg-[#8ee3b4]";

  return (
    <div className="space-y-10">
      <PageTitle title={t("portfolio.title")} subtitle={a.account.name} />

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="relative overflow-hidden rounded-feature bg-gradient-to-br from-ink-deep via-[#102c45] to-primary-deep p-7 text-canvas lg:col-span-6 lg:p-8">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-canvas/65">
              {t("portfolio.cards.currentEquity")}
            </p>
            <span className="inline-flex items-center rounded-full bg-canvas/10 px-3 py-1 text-xs font-medium text-canvas/85">
              {a.account.accountType}
            </span>
          </div>
          <p className="mt-3 text-3xl font-medium tracking-tight sm:text-[42px]">
            {formatMoney(a.equityBalance, lang)}
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-canvas/15 pt-5">
            <div>
              <dt className="text-xs text-canvas/55">
                {t("portfolio.cards.cashBalance")}
              </dt>
              <dd className="mt-1 text-base font-medium">
                {formatMoney(a.cashBalance, lang)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-canvas/55">
                {t("portfolio.cards.marginUsed")}
              </dt>
              <dd className="mt-1 text-base font-medium">
                {formatMoney(marginUsed, lang)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-canvas/55">
                {t("portfolio.cards.availableEquity")}
              </dt>
              <dd
                className={`mt-1 text-lg font-semibold ${
                  availableEquity >= 0 ? "text-[#8ee3b4]" : "text-[#ffb4b4]"
                }`}
              >
                {formatMoney(availableEquity, lang)}
              </dd>
            </div>
          </dl>
          <div className="mt-6 border-t border-canvas/15 pt-5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-canvas/55">
                {t("portfolio.cards.marginUtilization")}
              </span>
              <span className="font-medium text-canvas">
                {marginUtilization === null ? "—" : formatPercent(marginUtilization, lang)}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-canvas/15">
              <div
                className={`h-full rounded-full ${marginBarColor}`}
                style={{
                  width: `${Math.min(100, Math.max(0, (marginUtilization ?? 0) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xxxl border border-hairline-soft bg-canvas p-7 lg:col-span-3">
          <p className="text-sm font-medium text-steel">
            {t("portfolio.cards.tradingPnl")}
          </p>
          <p className="mt-3 text-2xl font-medium tracking-tight">
            <PnlText value={netTradingProfit} lang={lang} />
          </p>
          {depositPct !== null ? (
            <p
              className={`mt-2 text-xs font-medium ${
                depositPct >= 0 ? "text-success" : "text-critical"
              }`}
            >
              {formatPercent(depositPct, lang)} {t("portfolio.cards.vsDeposits")}
            </p>
          ) : null}
          <dl className="mt-5 space-y-3 border-t border-hairline-soft pt-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-steel">{t("common.realizedPnl")}</dt>
              <dd>
                <PnlText value={realized} lang={lang} />
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-steel">{t("portfolio.cards.unrealizedPnl")}</dt>
              <dd>
                <PnlText value={unrealized} lang={lang} />
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xxxl border border-primary/15 bg-sky-soft p-7 lg:col-span-3">
          <p className="text-sm font-medium text-steel">
            {t("portfolio.cards.netCapitalFlow")}
          </p>
          <p
            className={`mt-3 text-2xl font-medium tracking-tight ${
              netCapitalFlow >= 0 ? "text-primary" : "text-critical"
            }`}
          >
            {formatMoney(netCapitalFlow, lang)}
          </p>
          <div className="mt-5 space-y-3 border-t border-primary/10 pt-4 text-xs">
            <div className="flex items-center justify-between text-slate">
              <span>{t("portfolio.cards.deposits")}</span>
              <span className="font-medium text-ink">
                {formatMoney(a.totalDeposits, lang)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate">
              <span>{t("portfolio.cards.withdrawals")}</span>
              <span className="font-medium text-ink">
                {formatMoney(a.totalWithdrawals, lang)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-xxxl border border-hairline-soft bg-canvas">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline-soft px-8 py-6">
          <h2 className="text-[24px] font-medium leading-tight text-ink-deep">
            {t("portfolio.cards.openPositions")}
          </h2>
          <span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-bold text-steel">
            {formatNumber(positionList.length, lang)}
          </span>
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
                <th className="px-8 py-3 text-right">{t("portfolio.positionTable.marginUsed")}</th>
                <th className="px-8 py-3" />
              </tr>
            </thead>
            <tbody>
              {positionList.map((p) => (
                <tr key={p.id} className="border-b border-hairline-soft last:border-0">
                  <td className="px-8 py-4">
                    <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
                      {p.instrument}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <DirectionBadge direction={p.direction} />
                  </td>
                  <td className="px-8 py-4 text-right font-medium text-ink-deep">
                    {formatNumber(p.quantity, lang)}
                  </td>
                  <td className="px-8 py-4 text-right">{formatPrice(p.averagePrice, lang)}</td>
                  <td className="px-8 py-4 text-right">
                    {p.marketPrice === null ? "—" : formatPrice(p.marketPrice, lang)}
                  </td>
                  <td className="px-8 py-4 text-right">
                    <PnlText value={p.unrealizedPnl} lang={lang} />
                  </td>
                  <td className="px-8 py-4 text-right">{formatMoney(p.marginUsed, lang)}</td>
                  <td className="px-8 py-4 text-right">
                    <button
                      className="rounded-full bg-ink-deep px-4 py-2 text-xs font-bold text-canvas transition-colors hover:bg-charcoal"
                      onClick={() => {
                        setMarkingPosition(p);
                        setMarketPrice(p.marketPrice ?? "");
                      }}
                    >
                      {t("portfolio.updateMarketPrice")}
                    </button>
                  </td>
                </tr>
              ))}
              {positionList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-8 py-12 text-center text-stone">
                    {t("common.empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
            {positionList.length > 0 ? (
              <tfoot>
                <tr className="border-t border-hairline-soft bg-surface-soft/60 text-sm font-medium text-ink-deep">
                  <td colSpan={2} className="px-8 py-4">
                    {t("common.total")}
                  </td>
                  <td className="px-8 py-4 text-right">{formatNumber(totalQuantity, lang)}</td>
                  <td className="px-8 py-4" />
                  <td className="px-8 py-4" />
                  <td className="px-8 py-4 text-right">
                    <PnlText value={totalUnrealized} lang={lang} />
                  </td>
                  <td className="px-8 py-4 text-right">{formatMoney(marginUsed, lang)}</td>
                  <td className="px-8 py-4" />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      {markingPosition ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink-deep/30 p-4">
          <form
            className="w-full max-w-md rounded-xxxl bg-canvas p-6 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault();
              updateMark.mutate();
            }}
          >
            <h2 className="text-xl font-medium text-ink-deep">
              {t("portfolio.updateMarketPrice")}: {markingPosition.instrument}
            </h2>
            <p className="mt-2 text-sm text-slate">{t("portfolio.markPriceHint")}</p>
            <label className="mt-5 block text-sm font-medium text-ink">
              {t("portfolio.positionTable.marketPrice")}
              <input
                className="mt-1.5 w-full rounded-xl border border-hairline-soft px-3 py-2.5"
                type="number"
                min="0.01"
                step="0.01"
                value={marketPrice}
                onChange={(event) => setMarketPrice(event.target.value)}
                required
                autoFocus
              />
            </label>
            {updateMark.isError ? (
              <p className="mt-3 text-sm text-critical">{t("portfolio.markPriceError")}</p>
            ) : null}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-full px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-surface-soft"
                onClick={() => setMarkingPosition(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                className="rounded-full bg-ink-deep px-4 py-2 text-sm font-bold text-canvas transition-colors hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-60"
                disabled={updateMark.isPending}
              >
                {t("common.save")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}