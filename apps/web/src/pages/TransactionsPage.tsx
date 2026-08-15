import { type FormEvent, type ReactNode, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, ApiClientError, type BrokerTransaction } from "../services/api";
import { useAccounts, useActiveAccountId } from "../hooks/useAccounts";
import {
  DirectionBadge,
  ErrorState,
  Loading,
  NoAccountState,
  PageTitle,
  PnlText,
} from "../components/ui";
import { formatMoney, formatPrice, formatDate, formatNumber } from "../utils/format";

export function TransactionsPage() {
  const { t, i18n } = useTranslation();
  const accounts = useAccounts();
  const accountId = useActiveAccountId();
  const queryClient = useQueryClient();
  const lang = i18n.language.startsWith("th") ? "th" : "en";
  const [form, setForm] = useState({
    tradeDate: new Date().toISOString().slice(0, 10),
    instrument: "",
    side: "LONG",
    quantity: "1",
    price: "",
    totalFee: "",
    brokerReference: "",
  });

  const createTransaction = useMutation({
    mutationFn: () => {
      if (accountId === undefined) {
        throw new Error("Account is unavailable");
      }
      return api.post<BrokerTransaction>("/trades/open-position", {
        accountId,
        tradeDate: form.tradeDate,
        instrument: form.instrument.trim(),
        side: form.side,
        quantity: Number(form.quantity),
        price: form.price,
        totalFee: form.totalFee || null,
        brokerReference: form.brokerReference.trim() || null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions", accountId] });
      setForm((current) => ({
        ...current,
        instrument: "",
        quantity: "1",
        price: "",
        totalFee: "",
        brokerReference: "",
      }));
    },
  });

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createTransaction.mutate();
  }

  const submitError = createTransaction.error;
  const errorMessage =
    submitError instanceof ApiClientError && submitError.code === "DUPLICATE_TRANSACTION"
      ? t("transactionForm.errors.duplicate")
      : submitError
        ? t("transactionForm.errors.submit")
        : null;

  const transactions = useQuery({
    queryKey: ["transactions", accountId],
    queryFn: () =>
      api.get<BrokerTransaction[]>("/transactions", { accountId, limit: 500 }),
    enabled: accountId !== undefined,
  });

  if (accountId === undefined && accounts.isLoading) {
    return <Loading label={t("common.loading")} />;
  }
  if (accountId === undefined) {
    return <NoAccountState />;
  }
  if (transactions.isLoading) {
    return <Loading label={t("common.loading")} />;
  }
  if (transactions.isError) {
    return <ErrorState message={t("common.error")} />;
  }

  return (
    <div className="space-y-10">
      <PageTitle title={t("nav.transactions")} />

      <form
        className="rounded-xxxl border border-hairline-soft bg-canvas p-6 sm:p-8"
        onSubmit={handleSubmit}
      >
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-xl font-medium text-ink-deep">{t("transactionForm.title")}</h2>
            <p className="mt-1 text-sm text-slate">{t("transactionForm.description")}</p>
          </div>
          <span className="text-xs text-stone">{t("transactionForm.required")}</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label={t("transactionForm.fields.tradeDate")} required>
            <input className={inputClassName} type="date" value={form.tradeDate} onChange={(event) => updateForm("tradeDate", event.target.value)} required />
          </Field>
          <Field label={t("common.instrument")} required>
            <input className={inputClassName} value={form.instrument} onChange={(event) => updateForm("instrument", event.target.value)} placeholder={t("transactionForm.placeholders.instrument")} required />
          </Field>
          <Field label={t("common.direction")} required>
            <select className={inputClassName} value={form.side} onChange={(event) => updateForm("side", event.target.value)}>
              <option value="LONG">{t("common.long")}</option>
              <option value="SHORT">{t("common.short")}</option>
            </select>
          </Field>
          <Field label={t("common.quantity")} required>
            <input className={inputClassName} type="number" min="1" step="1" value={form.quantity} onChange={(event) => updateForm("quantity", event.target.value)} required />
          </Field>
          <Field label={t("common.price")} required>
            <input className={inputClassName} type="number" min="0.01" step="0.01" inputMode="decimal" value={form.price} onChange={(event) => updateForm("price", event.target.value)} required />
          </Field>
          <Field label={t("common.fees")}>
            <input className={inputClassName} type="number" min="0" step="0.01" inputMode="decimal" value={form.totalFee} onChange={(event) => updateForm("totalFee", event.target.value)} placeholder="0.00" />
          </Field>
          <Field label={t("transactionForm.fields.brokerReference")} className="md:col-span-2">
            <input className={inputClassName} value={form.brokerReference} onChange={(event) => updateForm("brokerReference", event.target.value)} />
          </Field>
        </div>

        {errorMessage ? <p className="mt-4 text-sm text-critical">{errorMessage}</p> : null}

        <div className="mt-6 flex justify-end">
          <button className="rounded-full bg-ink-deep px-5 py-2.5 text-sm font-bold text-canvas transition-colors hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={createTransaction.isPending || accountId === undefined}>
            {createTransaction.isPending ? t("transactionForm.saving") : t("transactionForm.submit")}
          </button>
        </div>
      </form>

      <div className="rounded-xxxl border border-hairline-soft bg-canvas">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline-soft text-left text-xs font-medium uppercase tracking-wide text-steel">
                <th className="px-8 py-3">{t("common.date")}</th>
                <th className="px-8 py-3">{t("common.instrument")}</th>
                <th className="px-8 py-3">{t("common.action")}</th>
                <th className="px-8 py-3">{t("common.direction")}</th>
                <th className="px-8 py-3 text-right">{t("common.quantity")}</th>
                <th className="px-8 py-3 text-right">{t("common.price")}</th>
                <th className="px-8 py-3 text-right">{t("common.fees")}</th>
                <th className="px-8 py-3 text-right">{t("common.realizedPnl")}</th>
                <th className="px-8 py-3">{t("common.source")}</th>
              </tr>
            </thead>
            <tbody>
              {(transactions.data ?? []).map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-hairline-soft transition-colors last:border-0 hover:bg-surface-soft"
                >
                  <td className="px-8 py-4 text-slate">{formatDate(tx.tradeDate, lang)}</td>
                  <td className="px-8 py-4 font-medium text-ink-deep">{tx.instrument}</td>
                  <td className="px-8 py-4 text-ink">{tx.action}</td>
                  <td className="px-8 py-4">
                    <DirectionBadge direction={tx.side} />
                  </td>
                  <td className="px-8 py-4 text-right text-ink">
                    {formatNumber(tx.quantity, lang)}
                  </td>
                  <td className="px-8 py-4 text-right text-ink">
                    {formatPrice(tx.price, lang)}
                  </td>
                  <td className="px-8 py-4 text-right text-ink">
                    {formatMoney(tx.totalFee ?? "0", lang)}
                  </td>
                  <td className="px-8 py-4 text-right">
                    <PnlText value={tx.realizedPnl ?? "0"} lang={lang} />
                  </td>
                  <td className="px-8 py-4 text-slate">{tx.source}</td>
                </tr>
              ))}
              {(transactions.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-8 py-12 text-center text-stone">
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

const inputClassName = "w-full rounded-xl border border-hairline-soft bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition focus:border-ink-deep";

function Field({ label, required = false, className = "", children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-sm font-medium text-ink">{label}{required ? <span className="ml-1 text-critical">*</span> : null}</span>{children}</label>;
}
