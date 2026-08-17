import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, ApiClientError, type Broker, type BrokerTransaction, type InstrumentContractSpec, type UserPreferences } from "../services/api";
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
    instrumentFamily: "",
    series: "",
    brokerId: "",
    side: "LONG",
    quantity: "1",
    price: "",
    brokerReference: "",
  });
  const [editingTransaction, setEditingTransaction] = useState<BrokerTransaction | null>(null);
  const [editForm, setEditForm] = useState({
    tradeDate: "",
    quantity: "",
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
        instrument: `${form.instrumentFamily}${form.series}`.trim(),
        instrumentFamily: form.instrumentFamily,
        brokerId: Number(form.brokerId),
        side: form.side,
        quantity: Number(form.quantity),
        price: form.price,
        brokerReference: form.brokerReference.trim() || null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions", accountId] });
      setForm((current) => ({
        ...current,
        series: "",
        quantity: "1",
        price: "",
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

  const contractSpecs = useQuery({
    queryKey: ["contract-specs"],
    queryFn: () => api.get<InstrumentContractSpec[]>("/instrument-contract-specs"),
  });
  const brokers = useQuery({
    queryKey: ["brokers"],
    queryFn: () => api.get<Broker[]>("/brokers"),
  });
  const preferences = useQuery({
    queryKey: ["my-preferences"],
    queryFn: () => api.get<UserPreferences>("/me/preferences"),
  });
  const preferredBrokerIds = new Set(preferences.data?.brokers.map((item) => item.id) ?? []);
  const preferredInstrumentCodes = new Set(preferences.data?.instruments.map((item) => item.code) ?? []);
  const brokerOptions = preferredBrokerIds.size > 0 ? (brokers.data ?? []).filter((item) => preferredBrokerIds.has(item.id)) : (brokers.data ?? []);
  const instrumentOptions = preferredInstrumentCodes.size > 0 ? (contractSpecs.data ?? []).filter((item) => preferredInstrumentCodes.has(item.instrumentFamily)) : (contractSpecs.data ?? []);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      brokerId: current.brokerId || (brokerOptions[0] ? String(brokerOptions[0].id) : ""),
      instrumentFamily: current.instrumentFamily || instrumentOptions[0]?.instrumentFamily || "",
    }));
  }, [preferences.data, brokers.data, contractSpecs.data]);

  const updateTransaction = useMutation({
    mutationFn: () => {
      if (!editingTransaction) return Promise.reject(new Error("No transaction selected"));
      return api.patch<BrokerTransaction>(`/transactions/${editingTransaction.id}`, {
        tradeDate: editForm.tradeDate,
        quantity: Number(editForm.quantity),
        price: editForm.price,
        totalFee: editForm.totalFee || null,
        brokerReference: editForm.brokerReference.trim() || null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions", accountId] });
      void queryClient.invalidateQueries({ queryKey: ["trades", accountId] });
      void queryClient.invalidateQueries({ queryKey: ["open-trades", accountId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary", accountId] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      setEditingTransaction(null);
    },
  });

  function startEditing(tx: BrokerTransaction) {
    setEditingTransaction(tx);
    setEditForm({
      tradeDate: tx.tradeDate,
      quantity: String(tx.quantity),
      price: tx.price ?? "",
      totalFee: tx.totalFee ?? "",
      brokerReference: tx.brokerReference ?? "",
    });
  }

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

      {editingTransaction ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink-deep/30 p-4">
          <form
            className="w-full max-w-md rounded-xxxl bg-canvas p-6 shadow-xl"
            onSubmit={(event) => { event.preventDefault(); updateTransaction.mutate(); }}
          >
            <h2 className="text-xl font-medium text-ink-deep">{t("transactionEdit.title")}</h2>
            <p className="mt-1 text-sm text-slate">{editingTransaction.instrument} · {editingTransaction.action}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label={t("transactionForm.fields.tradeDate")} required>
                <input className={inputClassName} type="date" value={editForm.tradeDate} onChange={(event) => setEditForm((current) => ({ ...current, tradeDate: event.target.value }))} required />
              </Field>
              <Field label={t("common.quantity")} required>
                <input className={inputClassName} type="number" min="1" step="1" value={editForm.quantity} onChange={(event) => setEditForm((current) => ({ ...current, quantity: event.target.value }))} required />
              </Field>
              <Field label={t("common.price")} required>
                <input className={inputClassName} type="number" min="0.01" step="0.01" inputMode="decimal" value={editForm.price} onChange={(event) => setEditForm((current) => ({ ...current, price: event.target.value }))} required />
              </Field>
              <Field label={t("common.fees")}>
                <input className={inputClassName} type="number" min="0" step="0.01" inputMode="decimal" value={editForm.totalFee} onChange={(event) => setEditForm((current) => ({ ...current, totalFee: event.target.value }))} />
              </Field>
              <Field label={t("transactionForm.fields.brokerReference")} className="sm:col-span-2">
                <input className={inputClassName} value={editForm.brokerReference} onChange={(event) => setEditForm((current) => ({ ...current, brokerReference: event.target.value }))} />
              </Field>
            </div>
            {updateTransaction.isError ? <p className="mt-4 text-sm text-critical">{t("transactionEdit.error")}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="rounded-full px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-surface-soft" onClick={() => setEditingTransaction(null)}>{t("common.cancel")}</button>
              <button className="rounded-full bg-ink-deep px-4 py-2 text-sm font-bold text-canvas transition-colors hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-60" disabled={updateTransaction.isPending}>
                {updateTransaction.isPending ? t("transactionEdit.saving") : t("common.save")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

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
          <Field label={t("transactionForm.fields.instrumentFamily")} required>
            <select className={inputClassName} value={form.instrumentFamily} onChange={(event) => updateForm("instrumentFamily", event.target.value)} required>
              <option value="">{t("transactionForm.placeholders.instrument")}</option>
              {instrumentOptions.map((s) => (
                <option key={s.id} value={s.instrumentFamily}>{s.instrumentFamily}</option>
              ))}
            </select>
          </Field>
          <Field label={t("transactionForm.fields.broker")} required>
            <select className={inputClassName} value={form.brokerId} onChange={(event) => updateForm("brokerId", event.target.value)} required>
              <option value="">{t("transactionForm.placeholders.broker")}</option>
              {brokerOptions.map((broker) => (
                <option key={broker.id} value={broker.id}>{broker.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t("transactionForm.fields.series")} required>
            <input className={inputClassName} value={form.series} onChange={(event) => updateForm("series", event.target.value.toUpperCase())} placeholder="Z26" required />
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
                <th className="px-8 py-3"><span className="sr-only">{t("common.edit")}</span></th>
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
                  <td className="px-8 py-4 text-right">
                    <button className="text-sm font-bold text-primary-deep transition-colors hover:underline" onClick={() => startEditing(tx)}>{t("common.edit")}</button>
                  </td>
                </tr>
              ))}
              {(transactions.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-8 py-12 text-center text-stone">
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
