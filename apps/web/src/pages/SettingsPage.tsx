import { type FormEvent, type ReactNode, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, type Broker, type BrokerContractTerm, type InstrumentContractSpec } from "../services/api";
import { PageTitle } from "../components/ui";

const input = "mt-1 w-full rounded-xl border border-hairline-soft px-3 py-2 text-sm";
const today = () => new Date().toISOString().slice(0, 10);

export function SettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [accountForm, setAccountForm] = useState({
    name: "",
    accountNumber: "",
    initialCapital: "0",
  });
  const [spec, setSpec] = useState({ instrumentFamily: "S50", multiplier: "200", tickSize: "0.1", effectiveDate: today() });
  const [term, setTerm] = useState({ brokerId: "", instrumentFamily: "S50", initialMargin: "", maintenanceMargin: "", commission: "0", tradingFee: "0", clearingFee: "0", regulatoryFee: "0", vat: "0", otherFee: "0", effectiveDate: today() });

  const brokers = useQuery({ queryKey: ["brokers"], queryFn: () => api.get<Broker[]>("/brokers") });
  const specs = useQuery({ queryKey: ["contract-specs"], queryFn: () => api.get<InstrumentContractSpec[]>("/instrument-contract-specs") });
  const terms = useQuery({ queryKey: ["broker-terms"], queryFn: () => api.get<BrokerContractTerm[]>("/broker-contract-terms") });

  const createAccount = useMutation({
    mutationFn: () =>
      api.post("/accounts", {
        name: accountForm.name.trim(),
        accountNumber: accountForm.accountNumber.trim() || null,
        initialCapital: accountForm.initialCapital,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["accounts"] });
      setAccountForm({ name: "", accountNumber: "", initialCapital: "0" });
    },
  });

  const saveSpec = useMutation({ mutationFn: () => api.post("/instrument-contract-specs", spec), onSuccess: () => void qc.invalidateQueries({ queryKey: ["contract-specs"] }) });
  const saveTerm = useMutation({ mutationFn: () => api.post("/broker-contract-terms", { ...term, brokerId: Number(term.brokerId) }), onSuccess: () => void qc.invalidateQueries({ queryKey: ["broker-terms"] }) });

  return (
    <div className="space-y-10">
      <PageTitle title={t("settings.title")} />

      <section className="rounded-xxxl border border-hairline-soft bg-canvas p-6">
        <h2 className="text-xl font-medium text-ink-deep">{t("account.title")}</h2>
        <p className="mt-1 text-sm text-slate">{t("account.help")}</p>
        <form
          className="mt-5 grid gap-4 md:grid-cols-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            createAccount.mutate();
          }}
        >
          <Label text={t("account.name")}>
            <input
              className={input}
              value={accountForm.name}
              onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
              required
            />
          </Label>
          <Label text={t("account.accountNumber")}>
            <input
              className={input}
              value={accountForm.accountNumber}
              onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
            />
          </Label>
          <Label text={t("account.initialCapital")}>
            <input
              className={input}
              type="number"
              min="0"
              step="0.01"
              value={accountForm.initialCapital}
              onChange={(e) => setAccountForm({ ...accountForm, initialCapital: e.target.value })}
              required
            />
          </Label>
          {createAccount.isError ? (
            <p className="text-sm text-critical md:col-span-3">{t("common.error")}</p>
          ) : null}
          <button
            className="rounded-full bg-ink-deep px-4 py-2 text-sm font-bold text-canvas transition-colors hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-60 md:col-span-3"
            disabled={createAccount.isPending}
          >
            {createAccount.isPending ? t("account.creating") : t("account.create")}
          </button>
        </form>
      </section>

      <section className="rounded-xxxl border border-hairline-soft bg-canvas p-6">
        <h2 className="text-xl font-medium text-ink-deep">{t("settings.contractSpecs")}</h2>
        <p className="mt-1 text-sm text-slate">{t("settings.contractHelp")}</p>
        <form className="mt-5 grid gap-4 md:grid-cols-4" onSubmit={(e: FormEvent) => { e.preventDefault(); saveSpec.mutate(); }}>
          <Label text={t("settings.instrumentFamily")}>
            <input className={input} value={spec.instrumentFamily} onChange={(e) => setSpec({ ...spec, instrumentFamily: e.target.value.toUpperCase() })} required />
          </Label>
          <Label text={t("settings.multiplier")}>
            <input className={input} type="number" min="0.01" step="0.01" value={spec.multiplier} onChange={(e) => setSpec({ ...spec, multiplier: e.target.value })} required />
          </Label>
          <Label text={t("settings.tickSize")}>
            <input className={input} type="number" min="0.01" step="0.01" value={spec.tickSize} onChange={(e) => setSpec({ ...spec, tickSize: e.target.value })} required />
          </Label>
          <Label text={t("settings.effectiveDate")}>
            <input className={input} type="date" value={spec.effectiveDate} onChange={(e) => setSpec({ ...spec, effectiveDate: e.target.value })} required />
          </Label>
          <button className="rounded-full bg-ink-deep px-4 py-2 text-sm font-bold text-canvas md:col-span-4" disabled={saveSpec.isPending}>
            {t("common.save")}
          </button>
        </form>
        <ConfigList items={specs.data ?? []} render={(x: InstrumentContractSpec) => `${x.instrumentFamily} · ${x.multiplier} THB/point · ${x.effectiveDate}`} />
      </section>

      <section className="rounded-xxxl border border-hairline-soft bg-canvas p-6">
        <h2 className="text-xl font-medium text-ink-deep">{t("settings.brokerTerms")}</h2>
        <p className="mt-1 text-sm text-slate">{t("settings.brokerHelp")}</p>
        <form className="mt-5 grid gap-4 md:grid-cols-3" onSubmit={(e: FormEvent) => { e.preventDefault(); saveTerm.mutate(); }}>
          <Label text={t("settings.broker")}>
            <select className={input} value={term.brokerId} onChange={(e) => setTerm({ ...term, brokerId: e.target.value })} required>
              <option value="">{t("settings.selectBroker")}</option>
              {(brokers.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Label>
          <Label text={t("settings.instrumentFamily")}>
            <input className={input} value={term.instrumentFamily} onChange={(e) => setTerm({ ...term, instrumentFamily: e.target.value.toUpperCase() })} required />
          </Label>
          <Label text={t("settings.initialMargin")}>
            <input className={input} type="number" min="0" step="0.01" value={term.initialMargin} onChange={(e) => setTerm({ ...term, initialMargin: e.target.value })} required />
          </Label>
          <Label text={t("settings.maintenanceMargin")}>
            <input className={input} type="number" min="0" step="0.01" value={term.maintenanceMargin} onChange={(e) => setTerm({ ...term, maintenanceMargin: e.target.value })} required />
          </Label>
          <Label text={t("settings.commission")}>
            <input className={input} type="number" min="0" step="0.01" value={term.commission} onChange={(e) => setTerm({ ...term, commission: e.target.value })} />
          </Label>
          <Label text={t("settings.effectiveDate")}>
            <input className={input} type="date" value={term.effectiveDate} onChange={(e) => setTerm({ ...term, effectiveDate: e.target.value })} required />
          </Label>
          <button className="rounded-full bg-ink-deep px-4 py-2 text-sm font-bold text-canvas md:col-span-3" disabled={saveTerm.isPending}>
            {t("common.save")}
          </button>
        </form>
        <ConfigList items={terms.data ?? []} render={(x: BrokerContractTerm) => `${x.instrumentFamily} · ${x.initialMargin} THB margin · ${x.commission} THB commission · ${x.effectiveDate}`} />
      </section>
    </div>
  );
}

function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="text-sm font-medium text-ink">
      {text}
      {children}
    </label>
  );
}

function ConfigList<T>({ items, render }: { items: T[]; render: (item: T) => string }) {
  return (
    <ul className="mt-5 divide-y divide-hairline-soft text-sm text-slate">
      {items.map((item, i) => (
        <li key={i} className="py-3">{render(item)}</li>
      ))}
    </ul>
  );
}