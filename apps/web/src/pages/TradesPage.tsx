import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
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

  const list = trades.data ?? [];

  return (
    <div className="space-y-10">
      <PageTitle
        title={t("trades.sessionTitle")}
        actions={
          <span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-bold text-steel">
            {formatNumber(list.length, lang)}
          </span>
        }
      />

      {list.length === 0 ? (
        <p className="py-12 text-center text-stone">{t("common.empty")}</p>
      ) : (
        <div className="space-y-4">
          {list.map((trade) => {
            const net = Number(trade.netPnl);
            const direction = trade.direction;
            const accent = net > 0 ? "border-success/20" : net < 0 ? "border-critical/20" : "border-hairline-soft";
            return (
              <article
                key={trade.id}
                className={`overflow-hidden rounded-xxxl border bg-canvas ${accent}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-soft px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
                      {trade.instrument}
                    </span>
                    <DirectionBadge direction={direction} />
                  </div>
                  <Badge tone={statusTone[trade.status] ?? "neutral"}>
                    {t(`trades.status.${trade.status}`)}
                  </Badge>
                </div>

                <div className="grid gap-6 p-6 lg:grid-cols-12 lg:items-center">
                  <div className="lg:col-span-4">
                    <p className="text-xs font-medium text-steel">
                      {t("trades.columns.netPnl")}
                    </p>
                    <p
                      className={`mt-2 text-3xl font-medium tracking-tight ${
                        net > 0 ? "text-success" : net < 0 ? "text-critical" : "text-ink-deep"
                      }`}
                    >
                      {formatMoney(trade.netPnl, lang)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4 lg:col-span-8">
                    <SessionValue
                      label={t("trades.columns.openDate")}
                      value={formatDate(trade.openedAt, lang)}
                    />
                    <SessionValue
                      label={t("trades.columns.closeDate")}
                      value={formatDate(trade.closedAt, lang)}
                    />
                    <SessionValue
                      label={t("trades.columns.holdingDays")}
                      value={trade.holdingDays === null ? "—" : formatNumber(trade.holdingDays, lang)}
                    />
                    <SessionValue
                      label={t("trades.columns.quantity")}
                      value={formatNumber(trade.totalEntryQuantity, lang)}
                    />
                    <SessionValue
                      label={t("trades.columns.averageEntry")}
                      value={formatPrice(trade.averageEntryPrice, lang)}
                    />
                    <SessionValue
                      label={t("trades.columns.averageExit")}
                      value={formatPrice(trade.averageExitPrice, lang)}
                    />
                    <SessionValue
                      label={t("trades.columns.grossPnl")}
                      value={<PnlText value={trade.grossPnl} lang={lang} />}
                    />
                    <SessionValue
                      label={t("trades.columns.fees")}
                      value={formatMoney(trade.totalFees, lang)}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SessionValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-steel">{label}</dt>
      <dd className="mt-1 font-medium text-ink-deep">{value}</dd>
    </div>
  );
}