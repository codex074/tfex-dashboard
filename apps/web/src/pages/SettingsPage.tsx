import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { api, type Account, type Broker, type BrokerContractTerm, type Instrument, type InstrumentContractSpec, type UserPreferences } from "../services/api";
import { PageTitle, SearchableCheckboxGroup } from "../components/ui";
import { useAccounts } from "../hooks/useAccounts";

const input = "mt-1 w-full rounded-xl border border-hairline-soft px-3 py-2 text-sm";
const today = () => new Date().toISOString().slice(0, 10);
const tones = { account: "bg-gradient-to-br from-ink-deep to-primary-deep text-canvas", brokers: "bg-violet-soft text-ink-deep", specs: "bg-sky-soft text-ink-deep", terms: "bg-amber-soft text-ink-deep" } as const;

function formatRemaining(deletedAt: string, now: number): string {
  const ms = Date.parse(deletedAt) + 24 * 60 * 60 * 1000 - now;
  if (ms <= 0) return "—";
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === "ADMIN";
  const [selectedBrokers, setSelectedBrokers] = useState<number[]>([]);
  const [selectedInstruments, setSelectedInstruments] = useState<number[]>([]);
  const [account, setAccount] = useState({ name: "", accountNumber: "", initialCapital: "0" });
  const [broker, setBroker] = useState({ name: "", shortName: "" });
  const [instrument, setInstrument] = useState({ code: "", name: "" });
  const [spec, setSpec] = useState({ instrumentFamily: "S50", multiplier: "200", tickSize: "0.1", initialMarginRate: "", maintenanceMarginRate: "", effectiveDate: today() });
  const [term, setTerm] = useState({ brokerId: "", instrumentFamily: "S50", initialMargin: "", maintenanceMargin: "", commission: "0", tradingFee: "0", clearingFee: "0", regulatoryFee: "0", vat: "0", otherFee: "0", effectiveDate: today() });
  const [now, setNow] = useState(Date.now());

  const brokers = useQuery({ queryKey: ["brokers"], queryFn: () => api.get<Broker[]>("/brokers") });
  const instruments = useQuery({ queryKey: ["instruments"], queryFn: () => api.get<Instrument[]>("/instruments") });
  const preferences = useQuery({ queryKey: ["my-preferences"], queryFn: () => api.get<UserPreferences>("/me/preferences") });
  const specs = useQuery({ queryKey: ["contract-specs"], queryFn: () => api.get<InstrumentContractSpec[]>("/instrument-contract-specs") });
  const terms = useQuery({ queryKey: ["broker-terms"], queryFn: () => api.get<BrokerContractTerm[]>("/broker-contract-terms") });

  useEffect(() => { if (preferences.data) { setSelectedBrokers(preferences.data.brokers.map((x) => x.id)); setSelectedInstruments(preferences.data.instruments.map((x) => x.id)); } }, [preferences.data]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const savePreferences = useMutation({ mutationFn: () => api.put<UserPreferences>("/me/preferences", { brokerIds: selectedBrokers, instrumentIds: selectedInstruments }), onSuccess: () => void qc.invalidateQueries({ queryKey: ["my-preferences"] }) });
  const accounts = useAccounts();
  const deletedAccounts = useQuery({ queryKey: ["deleted-accounts"], queryFn: () => api.get<Account[]>("/accounts/deleted") });
  const createAccount = useMutation({ mutationFn: () => api.post("/accounts", { name: account.name.trim(), accountNumber: account.accountNumber.trim() || null, initialCapital: account.initialCapital }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["accounts"] }); void qc.invalidateQueries({ queryKey: ["deleted-accounts"] }); setAccount({ name: "", accountNumber: "", initialCapital: "0" }); } });
  const deleteAccount = useMutation({ mutationFn: (id: number) => api.delete(`/accounts/${id}`), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["accounts"] }); void qc.invalidateQueries({ queryKey: ["deleted-accounts"] }); } });
  const restoreAccount = useMutation({ mutationFn: (id: number) => api.post(`/accounts/${id}/restore`), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["accounts"] }); void qc.invalidateQueries({ queryKey: ["deleted-accounts"] }); } });
  const createBroker = useMutation({ mutationFn: () => api.post("/brokers", broker), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["brokers"] }); setBroker({ name: "", shortName: "" }); } });
  const createInstrument = useMutation({ mutationFn: () => api.post("/instruments", instrument), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["instruments"] }); setInstrument({ code: "", name: "" }); } });
  const saveSpec = useMutation({ mutationFn: () => api.post("/instrument-contract-specs", { ...spec, initialMarginRate: spec.initialMarginRate || null, maintenanceMarginRate: spec.maintenanceMarginRate || null }), onSuccess: () => void qc.invalidateQueries({ queryKey: ["contract-specs"] }) });
  const saveTerm = useMutation({ mutationFn: () => api.post("/broker-contract-terms", { ...term, brokerId: Number(term.brokerId) }), onSuccess: () => void qc.invalidateQueries({ queryKey: ["broker-terms"] }) });

  return <div className="space-y-10">
    <PageTitle title={t("settings.title")} />
    <div className="grid gap-6 lg:grid-cols-2">
      <Card tone="account" emoji="⭐" title={t("settings.myDefaults")} subtitle={t("settings.myDefaultsHelp")}>
        <SearchableCheckboxGroup label={t("brokers.title")} items={(brokers.data ?? []).map((x) => ({ id: x.id, label: `${x.name} (${x.shortName})` }))} selected={selectedBrokers} onChange={setSelectedBrokers} />
        <SearchableCheckboxGroup label={t("settings.instruments")} items={(instruments.data ?? []).filter((x) => x.isActive).map((x) => ({ id: x.id, label: `${x.code} · ${x.name}` }))} selected={selectedInstruments} onChange={setSelectedInstruments} />
        <button className="mt-5 rounded-full bg-ink-deep px-4 py-2 text-sm font-bold text-canvas disabled:opacity-60" onClick={() => savePreferences.mutate()} disabled={savePreferences.isPending}>{savePreferences.isSuccess ? t("settings.saved") : t("settings.saveDefaults")}</button>
      </Card>

      <Card tone="account" emoji="💼" title={t("account.title")} subtitle={t("account.help")}>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); createAccount.mutate(); }}>
          <Label text={t("account.name")}><input className={input} value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} required /></Label>
          <Label text={t("account.accountNumber")}><input className={input} value={account.accountNumber} onChange={(e) => setAccount({ ...account, accountNumber: e.target.value })} /></Label>
          <Label text={t("account.initialCapital")}><input className={input} type="number" min="0" step="0.01" value={account.initialCapital} onChange={(e) => setAccount({ ...account, initialCapital: e.target.value })} required /></Label>
          <Submit mutation={createAccount} className="md:col-span-3" label={t("account.create")} loading={t("account.creating")} />
        </form>

        <div className="mt-6 space-y-2">
          {(accounts.data ?? []).length === 0 ? (
            <p className="text-sm text-slate">{t("account.noAccounts")}</p>
          ) : (
            (accounts.data ?? []).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-hairline-soft px-3 py-2">
                <span className="text-sm text-ink">
                  {a.name}
                  {a.accountNumber ? <span className="text-stone"> · {a.accountNumber}</span> : null}
                </span>
                <button type="button" className="rounded-full bg-critical-soft px-3 py-1 text-xs font-bold text-critical" disabled={deleteAccount.isPending} onClick={() => { if (window.confirm(t("account.deleteConfirm", { name: a.name }))) deleteAccount.mutate(a.id); }}>
                  {t("account.delete")}
                </button>
              </div>
            ))
          )}
        </div>

        {(deletedAccounts.data ?? []).length > 0 ? (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-bold text-ink">{t("account.deletedAccounts")}</h3>
            <div className="space-y-2">
              {(deletedAccounts.data ?? []).map((a) => (
                <DeletedAccountRow
                  key={a.id}
                  account={a}
                  now={now}
                  busy={restoreAccount.isPending}
                  onRestore={() => restoreAccount.mutate(a.id)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </Card>
    </div>

    {isAdmin ? <><h2 className="text-2xl font-bold text-ink-deep">{t("settings.adminArea")}</h2><div className="grid gap-6 lg:grid-cols-2">
      <Card tone="brokers" emoji="🏦" title={t("brokers.title")} subtitle={t("brokers.help")}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); createBroker.mutate(); }}><Label text={t("brokers.name")}><input className={input} value={broker.name} onChange={(e) => setBroker({ ...broker, name: e.target.value })} required /></Label><Label text={t("brokers.shortName")}><input className={input} value={broker.shortName} onChange={(e) => setBroker({ ...broker, shortName: e.target.value })} required /></Label><Submit mutation={createBroker} className="md:col-span-2" label={t("brokers.add")} /></form><Chips items={(brokers.data ?? []).map((x) => `${x.name} (${x.shortName})`)} />
      </Card>
      <Card tone="specs" emoji="📋" title={t("settings.instruments")} subtitle={t("settings.instrumentsHelp")}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); createInstrument.mutate(); }}><Label text={t("settings.instrumentCode")}><input className={input} value={instrument.code} onChange={(e) => setInstrument({ ...instrument, code: e.target.value.toUpperCase() })} placeholder="S50" required /></Label><Label text={t("settings.instrumentName")}><input className={input} value={instrument.name} onChange={(e) => setInstrument({ ...instrument, name: e.target.value })} required /></Label><Submit mutation={createInstrument} className="md:col-span-2" label={t("settings.addInstrument")} /></form><Chips items={(instruments.data ?? []).map((x) => `${x.code} · ${x.name}`)} />
      </Card>
      <Card tone="specs" emoji="📐" title={t("settings.contractSpecs")} subtitle={t("settings.contractHelp")}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); saveSpec.mutate(); }}><Label text={t("settings.instrumentFamily")}><input className={input} value={spec.instrumentFamily} onChange={(e) => setSpec({ ...spec, instrumentFamily: e.target.value.toUpperCase() })} required /></Label><Label text={t("settings.multiplier")}><input className={input} type="number" min="0.01" step="0.01" value={spec.multiplier} onChange={(e) => setSpec({ ...spec, multiplier: e.target.value })} required /></Label><Label text={t("settings.tickSize")}><input className={input} type="number" min="0.01" step="0.01" value={spec.tickSize} onChange={(e) => setSpec({ ...spec, tickSize: e.target.value })} required /></Label><Label text={t("settings.initialMarginRate")}><input className={input} type="number" min="0" step="0.01" placeholder="%" value={spec.initialMarginRate} onChange={(e) => setSpec({ ...spec, initialMarginRate: e.target.value })} /></Label><Label text={t("settings.maintenanceMarginRate")}><input className={input} type="number" min="0" step="0.01" placeholder="%" value={spec.maintenanceMarginRate} onChange={(e) => setSpec({ ...spec, maintenanceMarginRate: e.target.value })} /></Label><Label text={t("settings.effectiveDate")}><input className={input} type="date" value={spec.effectiveDate} onChange={(e) => setSpec({ ...spec, effectiveDate: e.target.value })} required /></Label><Submit mutation={saveSpec} className="md:col-span-2" label={t("common.save")} /></form><Chips items={(specs.data ?? []).map((x) => `${x.instrumentFamily} · ${x.multiplier} THB/point${x.initialMarginRate ? ` · ${x.initialMarginRate}% IM` : ""}`)} />
      </Card>
      <Card tone="terms" emoji="🧾" title={t("settings.brokerTerms")} subtitle={t("settings.brokerHelp")}>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); saveTerm.mutate(); }}>
          <Label text={t("settings.broker")}><select className={input} value={term.brokerId} onChange={(e) => setTerm({ ...term, brokerId: e.target.value })} required><option value="">{t("settings.selectBroker")}</option>{(brokers.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Label>
          <Label text={t("settings.instrumentFamily")}><select className={input} value={term.instrumentFamily} onChange={(e) => setTerm({ ...term, instrumentFamily: e.target.value })} required>{(instruments.data ?? []).map((x) => <option key={x.id} value={x.code}>{x.code}</option>)}</select></Label>
          <Label text={t("settings.initialMargin")}><input className={input} type="number" min="0" step="0.01" value={term.initialMargin} onChange={(e) => setTerm({ ...term, initialMargin: e.target.value })} required /></Label>
          <Label text={t("settings.maintenanceMargin")}><input className={input} type="number" min="0" step="0.01" value={term.maintenanceMargin} onChange={(e) => setTerm({ ...term, maintenanceMargin: e.target.value })} required /></Label>
          <Label text={t("settings.commission")}><input className={input} type="number" min="0" step="0.01" value={term.commission} onChange={(e) => setTerm({ ...term, commission: e.target.value })} /></Label>
          <Label text={t("settings.effectiveDate")}><input className={input} type="date" value={term.effectiveDate} onChange={(e) => setTerm({ ...term, effectiveDate: e.target.value })} required /></Label>
          <Submit mutation={saveTerm} className="md:col-span-2" label={t("common.save")} />
        </form><Chips items={(terms.data ?? []).map((x) => `${x.instrumentFamily} · ${x.initialMargin} THB · ${x.commission} commission`)} />
      </Card>
    </div></> : null}
  </div>;
}

function DeletedAccountRow({ account, now, busy, onRestore }: { account: Account; now: number; busy: boolean; onRestore: () => void }) {
  const { t } = useTranslation();
  const remaining = account.deletedAt ? formatRemaining(account.deletedAt, now) : "—";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-attention bg-attention-soft px-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">
          {account.name}
          {account.accountNumber ? <span className="text-stone"> · {account.accountNumber}</span> : null}
        </div>
        <div className="mt-0.5 text-xs font-medium text-attention">
          ⏳ {t("account.restoreIn", { time: remaining })}
        </div>
      </div>
      <button
        type="button"
        className="rounded-full bg-success px-4 py-1.5 text-xs font-bold text-canvas disabled:opacity-60"
        disabled={busy}
        onClick={onRestore}
      >
        {busy ? t("account.restoring") : `↩ ${t("account.restore")}`}
      </button>
    </div>
  );
}

function Card({ tone, emoji, title, subtitle, children }: { tone: keyof typeof tones; emoji: string; title: string; subtitle: string; children: ReactNode }) { return <section className="overflow-hidden rounded-xxxl border border-hairline-soft bg-canvas"><div className={`flex items-center gap-3 border-b border-hairline-soft px-6 py-5 ${tones[tone]}`}><span className="text-xl">{emoji}</span><div><h2 className="text-xl font-medium">{title}</h2><p className="text-sm opacity-70">{subtitle}</p></div></div><div className="p-6">{children}</div></section>; }
function Label({ text, children }: { text: string; children: ReactNode }) { return <label className="text-sm font-medium text-ink">{text}{children}</label>; }
function Submit({ mutation, label, loading, className = "" }: { mutation: { isPending: boolean; isError: boolean }; label: string; loading?: string; className?: string }) { const { t } = useTranslation(); return <div className={className}>{mutation.isError ? <p className="mb-2 text-sm text-critical">{t("common.error")}</p> : null}<button className="w-full rounded-full bg-ink-deep px-4 py-2 text-sm font-bold text-canvas disabled:opacity-60" disabled={mutation.isPending}>{mutation.isPending ? loading ?? t("auth.saving") : label}</button></div>; }
function Chips({ items }: { items: string[] }) { return items.length ? <div className="mt-5 flex flex-wrap gap-2">{items.map((x) => <span key={x} className="rounded-full bg-surface-soft px-3 py-1 text-xs font-medium text-slate">{x}</span>)}</div> : null; }
