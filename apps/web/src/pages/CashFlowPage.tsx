import { type FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, type CashTransaction, type CashFlowSummary } from "../services/api";
import { useActiveAccountId } from "../hooks/useAccounts";
import {
  Badge,
  ErrorState,
  Loading,
  PageTitle,
  StatCard,
} from "../components/ui";
import { formatMoney, formatDate } from "../utils/format";

const typeTone: Record<string, "success" | "critical" | "attention" | "neutral"> = {
  DEPOSIT: "success",
  WITHDRAWAL: "critical",
  INTEREST: "attention",
  ADJUSTMENT: "neutral",
};

export function CashFlowPage() {
  const { t, i18n } = useTranslation();
  const accountId = useActiveAccountId();
  const queryClient = useQueryClient();
  const lang = i18n.language.startsWith("th") ? "th" : "en";
  const [type, setType] = useState<"DEPOSIT" | "WITHDRAWAL" | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));

  const saveCashFlow = useMutation({
    mutationFn: () => {
      if (accountId === undefined || type === null) return Promise.reject(new Error("Missing cash flow details"));
      const body = { type, transactionDate, amount, reference: reference.trim() || null, note: note.trim() || null };
      return editingId === null ? api.post<CashTransaction>("/cash-transactions", { accountId, ...body }) : api.patch<CashTransaction>(`/cash-transactions/${editingId}`, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cash-flow-summary", accountId] });
      void queryClient.invalidateQueries({ queryKey: ["cash-transactions", accountId] });
      setType(null); setAmount(""); setReference(""); setNote(""); setEditingId(null);
    },
  });

  function submitCashFlow(event: FormEvent<HTMLFormElement>) { event.preventDefault(); saveCashFlow.mutate(); }
  function editCashFlow(tx: CashTransaction) { if (tx.type !== "DEPOSIT" && tx.type !== "WITHDRAWAL") return; setEditingId(tx.id); setType(tx.type); setTransactionDate(tx.transactionDate); setAmount(tx.amount); setReference(tx.reference ?? ""); setNote(tx.note ?? ""); }
  const deleteCashFlow = useMutation({ mutationFn: (id: number) => api.delete(`/cash-transactions/${id}`), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["cash-flow-summary", accountId] }); void queryClient.invalidateQueries({ queryKey: ["cash-transactions", accountId] }); } });

  const summary = useQuery({
    queryKey: ["cash-flow-summary", accountId],
    queryFn: () => api.get<CashFlowSummary>(`/accounts/${accountId}/cash-flows`),
    enabled: accountId !== undefined,
  });

  const transactions = useQuery({
    queryKey: ["cash-transactions", accountId],
    queryFn: () =>
      api.get<CashTransaction[]>("/cash-transactions", { accountId, limit: 500 }),
    enabled: accountId !== undefined,
  });

  if (summary.isLoading) {
    return <Loading label={t("common.loading")} />;
  }
  if (summary.isError || !summary.data) {
    return <ErrorState message={t("common.error")} />;
  }

  const s = summary.data;

  return (
    <div className="space-y-10">
      <PageTitle title={t("cashflow.title")} actions={<><button className="rounded-full border border-hairline-soft px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-surface-soft" onClick={() => { setEditingId(null); setType("WITHDRAWAL"); }}>{t("cashflow.withdraw")}</button><button className="rounded-full bg-ink-deep px-4 py-2 text-sm font-bold text-canvas transition-colors hover:bg-charcoal" onClick={() => { setEditingId(null); setType("DEPOSIT"); }}>{t("cashflow.deposit")}</button></>} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard
          label={t("cashflow.summary.totalDeposits")}
          value={formatMoney(s.totalDeposits, lang)}
        />
        <StatCard
          label={t("cashflow.summary.totalWithdrawals")}
          value={formatMoney(s.totalWithdrawals, lang)}
        />
        <StatCard
          label={t("cashflow.summary.netCapitalFlow")}
          value={formatMoney(s.netCapitalFlow, lang)}
          accent
        />
      </div>

      {type ? <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink-deep/30 p-4"><form className="w-full max-w-md rounded-xxxl bg-canvas p-6 shadow-xl" onSubmit={submitCashFlow}><h2 className="text-xl font-medium text-ink-deep">{editingId === null ? (type === "DEPOSIT" ? t("cashflow.deposit") : t("cashflow.withdraw")) : t("cashflow.edit")}</h2><label className="mt-5 block text-sm font-medium text-ink">{t("cashflow.columns.date")}<input className="mt-1.5 w-full rounded-xl border border-hairline-soft px-3 py-2.5" type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} required /></label><label className="mt-4 block text-sm font-medium text-ink">{t("cashflow.columns.amount")}<input className="mt-1.5 w-full rounded-xl border border-hairline-soft px-3 py-2.5" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label className="mt-4 block text-sm font-medium text-ink">{t("cashflow.columns.reference")}<input className="mt-1.5 w-full rounded-xl border border-hairline-soft px-3 py-2.5" value={reference} onChange={(event) => setReference(event.target.value)} /></label><label className="mt-4 block text-sm font-medium text-ink">{t("cashflow.columns.note")}<textarea className="mt-1.5 w-full rounded-xl border border-hairline-soft px-3 py-2.5" value={note} onChange={(event) => setNote(event.target.value)} rows={3} /></label>{saveCashFlow.isError ? <p className="mt-3 text-sm text-critical">{t("cashflow.saveError")}</p> : null}<div className="mt-6 flex justify-end gap-3"><button type="button" className="rounded-full px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-surface-soft" onClick={() => setType(null)}>{t("common.cancel")}</button><button className="rounded-full bg-ink-deep px-4 py-2 text-sm font-bold text-canvas transition-colors hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-60" disabled={saveCashFlow.isPending}>{saveCashFlow.isPending ? t("cashflow.saving") : t("common.save")}</button></div></form></div> : null}

      <div className="rounded-xxxl border border-hairline-soft bg-canvas">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline-soft text-left text-xs font-medium uppercase tracking-wide text-steel">
                <th className="px-8 py-3">{t("cashflow.columns.date")}</th>
                <th className="px-8 py-3">{t("cashflow.columns.type")}</th>
                <th className="px-8 py-3 text-right">{t("cashflow.columns.amount")}</th>
                <th className="px-8 py-3">{t("cashflow.columns.reference")}</th>
                <th className="px-8 py-3">{t("cashflow.columns.note")}</th>
                <th className="px-8 py-3"><span className="sr-only">{t("cashflow.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {(transactions.data ?? []).map((tx) => (
                <tr key={tx.id} className="border-b border-hairline-soft last:border-0">
                  <td className="px-8 py-4 text-slate">
                    {formatDate(tx.transactionDate, lang)}
                  </td>
                  <td className="px-8 py-4">
                    <Badge tone={typeTone[tx.type] ?? "neutral"}>
                      {t(`cashflow.types.${tx.type}`)}
                    </Badge>
                  </td>
                  <td
                    className={`px-8 py-4 text-right font-medium ${
                      tx.type === "WITHDRAWAL" ? "text-critical" : "text-success"
                    }`}
                  >
                    {formatMoney(tx.amount, lang)}
                  </td>
                  <td className="px-8 py-4 text-slate">{tx.reference ?? "—"}</td>
                  <td className="px-8 py-4 text-slate">{tx.note ?? "—"}</td>
                  <td className="px-8 py-4 text-right whitespace-nowrap"><button className="mr-3 text-sm font-bold text-primary-deep transition-colors hover:underline" onClick={() => editCashFlow(tx)}>{t("common.edit")}</button><button className="text-sm font-bold text-critical transition-colors hover:underline" onClick={() => { if (window.confirm(t("cashflow.confirmDelete"))) deleteCashFlow.mutate(tx.id); }}>{t("common.delete")}</button></td>
                </tr>
              ))}
              {(transactions.data ?? []).length === 0 ? (
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
