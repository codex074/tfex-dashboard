import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type TradeDetail } from "../services/api";
import {
  Badge,
  Card,
  DirectionBadge,
  ErrorState,
  Loading,
  PnlText,
} from "../components/ui";
import { formatMoney, formatPrice, formatDate, formatNumber } from "../utils/format";

export function TradeDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const lang = i18n.language.startsWith("th") ? "th" : "en";

  const trade = useQuery({
    queryKey: ["trade", id],
    queryFn: () => api.get<TradeDetail>(`/trades/${id}`),
    enabled: id !== undefined,
  });

  if (trade.isLoading) {
    return <Loading label={t("common.loading")} />;
  }
  if (trade.isError || !trade.data) {
    return <ErrorState message={t("common.error")} />;
  }

  const tr = trade.data;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to="/trades"
          className="rounded-full border border-hairline-soft px-4 py-2 text-sm font-bold text-ink-deep hover:bg-surface-soft"
        >
          ← {t("trades.title")}
        </Link>
        <h1 className="text-[36px] font-medium leading-tight text-ink-deep">
          {tr.instrument}
        </h1>
        <DirectionBadge direction={tr.direction} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={t("trades.detail.summary")}>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <dt className="text-slate">{t("trades.columns.averageEntry")}</dt>
            <dd className="text-right font-medium text-ink-deep">
              {formatPrice(tr.averageEntryPrice, lang)}
            </dd>
            <dt className="text-slate">{t("trades.columns.averageExit")}</dt>
            <dd className="text-right font-medium text-ink-deep">
              {formatPrice(tr.averageExitPrice, lang)}
            </dd>
            <dt className="text-slate">{t("trades.columns.quantity")}</dt>
            <dd className="text-right font-medium text-ink-deep">
              {formatNumber(tr.totalEntryQuantity, lang)}
            </dd>
            <dt className="text-slate">{t("trades.columns.grossPnl")}</dt>
            <dd className="text-right">
              <PnlText value={tr.grossPnl} lang={lang} />
            </dd>
            <dt className="text-slate">{t("trades.columns.fees")}</dt>
            <dd className="text-right font-medium text-ink-deep">
              {formatMoney(tr.totalFees, lang)}
            </dd>
            <dt className="text-slate">{t("trades.columns.netPnl")}</dt>
            <dd className="text-right">
              <PnlText value={tr.netPnl} lang={lang} />
            </dd>
            <dt className="text-slate">{t("trades.columns.status")}</dt>
            <dd className="text-right">
              <Badge tone={tr.status === "CLOSED" ? "success" : "attention"}>
                {t(`trades.status.${tr.status}`)}
              </Badge>
            </dd>
          </dl>
        </Card>

        <Card title={t("trades.detail.transactions")}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline-soft text-left text-xs font-medium uppercase tracking-wide text-steel">
                  <th className="py-2 pr-4">{t("common.date")}</th>
                  <th className="py-2 pr-4">{t("common.action")}</th>
                  <th className="py-2 pr-4 text-right">{t("common.quantity")}</th>
                  <th className="py-2 pr-4 text-right">{t("common.price")}</th>
                  <th className="py-2 text-right">{t("common.fees")}</th>
                </tr>
              </thead>
              <tbody>
                {tr.transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-hairline-soft last:border-0">
                    <td className="py-3 pr-4 text-slate">{formatDate(tx.tradeDate, lang)}</td>
                    <td className="py-3 pr-4 text-ink">{tx.action}</td>
                    <td className="py-3 pr-4 text-right text-ink">{tx.quantity}</td>
                    <td className="py-3 pr-4 text-right text-ink">
                      {formatPrice(tx.price, lang)}
                    </td>
                    <td className="py-3 text-right text-ink">
                      {formatMoney(tx.totalFee ?? "0", lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}