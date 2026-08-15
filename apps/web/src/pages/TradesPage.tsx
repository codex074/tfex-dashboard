import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type Trade } from "../services/api";
import { useActiveAccountId } from "../hooks/useAccounts";
import {
  Badge,
  DirectionBadge,
  ErrorState,
  Loading,
  PageTitle,
  PnlText,
} from "../components/ui";
import { formatMoney, formatPrice, formatDate, formatNumber } from "../utils/format";

const statusTone: Record<string, "success" | "neutral" | "attention"> = {
  CLOSED: "success",
  OPEN: "attention",
  PARTIAL: "neutral",
};

export function TradesPage() {
  const { t, i18n } = useTranslation();
  const accountId = useActiveAccountId();
  const lang = i18n.language.startsWith("th") ? "th" : "en";

  const trades = useQuery({
    queryKey: ["trades", accountId],
    queryFn: () => api.get<Trade[]>("/trades", { accountId, limit: 500 }),
    enabled: accountId !== undefined,
  });

  if (trades.isLoading) {
    return <Loading label={t("common.loading")} />;
  }
  if (trades.isError) {
    return <ErrorState message={t("common.error")} />;
  }

  return (
    <div className="space-y-10">
      <PageTitle title={t("trades.title")} />

      <div className="rounded-xxxl border border-hairline-soft bg-canvas">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline-soft text-left text-xs font-medium uppercase tracking-wide text-steel">
                <th className="px-8 py-3">{t("trades.columns.openDate")}</th>
                <th className="px-8 py-3">{t("trades.columns.closeDate")}</th>
                <th className="px-8 py-3">{t("trades.columns.instrument")}</th>
                <th className="px-8 py-3">{t("trades.columns.direction")}</th>
                <th className="px-8 py-3 text-right">{t("trades.columns.quantity")}</th>
                <th className="px-8 py-3 text-right">{t("trades.columns.averageEntry")}</th>
                <th className="px-8 py-3 text-right">{t("trades.columns.averageExit")}</th>
                <th className="px-8 py-3 text-right">{t("trades.columns.grossPnl")}</th>
                <th className="px-8 py-3 text-right">{t("trades.columns.fees")}</th>
                <th className="px-8 py-3 text-right">{t("trades.columns.netPnl")}</th>
                <th className="px-8 py-3">{t("trades.columns.status")}</th>
              </tr>
            </thead>
            <tbody>
              {(trades.data ?? []).map((trade) => (
                <tr
                  key={trade.id}
                  className="border-b border-hairline-soft transition-colors last:border-0 hover:bg-surface-soft"
                >
                  <td className="px-8 py-4 text-slate">{formatDate(trade.openedAt, lang)}</td>
                  <td className="px-8 py-4 text-slate">{formatDate(trade.closedAt, lang)}</td>
                  <td className="px-8 py-4">
                    <Link
                      to={`/trades/${trade.id}`}
                      className="font-medium text-primary-deep transition-colors hover:underline"
                    >
                      {trade.instrument}
                    </Link>
                  </td>
                  <td className="px-8 py-4">
                    <DirectionBadge direction={trade.direction} />
                  </td>
                  <td className="px-8 py-4 text-right">
                    {formatNumber(trade.totalEntryQuantity, lang)}
                  </td>
                  <td className="px-8 py-4 text-right">
                    {formatPrice(trade.averageEntryPrice, lang)}
                  </td>
                  <td className="px-8 py-4 text-right">
                    {formatPrice(trade.averageExitPrice, lang)}
                  </td>
                  <td className="px-8 py-4 text-right">
                    <PnlText value={trade.grossPnl} lang={lang} />
                  </td>
                  <td className="px-8 py-4 text-right">
                    {formatMoney(trade.totalFees, lang)}
                  </td>
                  <td className="px-8 py-4 text-right">
                    <PnlText value={trade.netPnl} lang={lang} />
                  </td>
                  <td className="px-8 py-4">
                    <Badge tone={statusTone[trade.status] ?? "neutral"}>
                      {t(`trades.status.${trade.status}`)}
                    </Badge>
                  </td>
                </tr>
              ))}
              {(trades.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-8 py-12 text-center text-stone">
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