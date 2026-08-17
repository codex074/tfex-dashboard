import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  api,
  type Broker,
  type Instrument,
  type UserPreferences,
} from "../services/api";

const inputClass =
  "mt-1 w-full rounded-xl border border-hairline-soft px-3 py-2 text-sm";
const moneyPattern = /^\d+(\.\d{1,2})?$/;

export function SetupWizard() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);

  // Step 1 — account
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [initialCapital, setInitialCapital] = useState("0");

  // Step 2 — broker (single choice)
  const [brokerId, setBrokerId] = useState<number | null>(null);
  const [brokerQuery, setBrokerQuery] = useState("");

  // Step 3 — frequently traded instruments (multi choice)
  const [instrumentIds, setInstrumentIds] = useState<number[]>([]);
  const [instrumentQuery, setInstrumentQuery] = useState("");

  const [done, setDone] = useState(false);

  const brokers = useQuery({
    queryKey: ["brokers"],
    queryFn: () => api.get<Broker[]>("/brokers"),
  });
  const instruments = useQuery({
    queryKey: ["instruments"],
    queryFn: () => api.get<Instrument[]>("/instruments"),
  });
  const preferences = useQuery({
    queryKey: ["my-preferences"],
    queryFn: () => api.get<UserPreferences>("/me/preferences"),
  });

  // Prefill the wizard from existing data once initial data is available.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    if (!brokers.data || !instruments.data) return;
    didInit.current = true;
    setInstrumentIds((preferences.data?.instruments ?? []).map((i) => i.id));
    const prefBroker = preferences.data?.brokers[0];
    setBrokerId(prefBroker ? prefBroker.id : (brokers.data[0]?.id ?? null));
  }, [brokers.data, instruments.data, preferences.data]);

  const finish = useMutation({
    mutationFn: async () => {
      await api.post("/accounts", {
        name: accountName.trim(),
        accountNumber: accountNumber.trim() || null,
        initialCapital,
        brokerId: brokerId ?? undefined,
      });
      await api.put("/me/preferences", {
        brokerIds: brokerId ? [brokerId] : [],
        instrumentIds,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["accounts"] });
      void qc.invalidateQueries({ queryKey: ["my-preferences"] });
      setDone(true);
    },
  });

  const filteredBrokers = (brokers.data ?? []).filter((b) =>
    `${b.name} ${b.shortName}`
      .toLowerCase()
      .includes(brokerQuery.trim().toLowerCase()),
  );
  const activeInstruments = (instruments.data ?? []).filter((i) => i.isActive);
  const filteredInstruments = activeInstruments.filter((i) =>
    `${i.code} ${i.name}`
      .toLowerCase()
      .includes(instrumentQuery.trim().toLowerCase()),
  );

  const step0Valid =
    accountName.trim().length > 0 && moneyPattern.test(initialCapital);

  const steps = [
    t("onboarding.step1"),
    t("onboarding.step2"),
    t("onboarding.step3"),
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-medium text-ink-deep">
          {t("onboarding.title")}
        </h2>
        <p className="mt-1 text-sm text-slate">{t("onboarding.subtitle")}</p>
      </div>

      <ol className="flex flex-wrap items-center gap-1 text-xs font-bold">
        {steps.map((label, index) => {
          const active = index === step;
          const complete = index < step;
          return (
            <li key={label} className="flex items-center gap-1">
              <span
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${
                  complete
                    ? "bg-success-soft text-success"
                    : active
                      ? "bg-ink-deep text-canvas"
                      : "bg-surface-soft text-slate"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    complete
                      ? "bg-success text-canvas"
                      : active
                        ? "bg-canvas text-ink-deep"
                        : "bg-ink/10 text-slate"
                  }`}
                >
                  {complete ? "✓" : index + 1}
                </span>
                <span>{label}</span>
              </span>
              {index < steps.length - 1 ? (
                <span
                  className={`text-base ${
                    index < step ? "text-success" : "text-hairline-soft"
                  }`}
                >
                  →
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 rounded-xxxl border border-hairline-soft bg-canvas p-6">
        {done ? (
          <div className="py-4 text-center">
            <p className="text-base text-ink">{t("onboarding.done")}</p>
          </div>
        ) : step === 0 ? (
          <div className="grid gap-4">
            <label className="block text-sm font-medium text-ink">
              {t("account.name")}
              <input
                className={inputClass}
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder={t("account.name")}
              />
            </label>
            <label className="block text-sm font-medium text-ink">
              {t("account.accountNumber")}
              <input
                className={inputClass}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-ink">
              {t("account.initialCapital")}
              <input
                className={inputClass}
                type="number"
                min="0"
                step="0.01"
                value={initialCapital}
                onChange={(e) => setInitialCapital(e.target.value)}
              />
            </label>
          </div>
        ) : step === 1 ? (
          <div>
            <input
              className={inputClass}
              value={brokerQuery}
              onChange={(e) => setBrokerQuery(e.target.value)}
              placeholder={t("common.search")}
              aria-label={t("common.search")}
            />
            <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1">
              {filteredBrokers.map((b) => (
                <label
                  key={b.id}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                    brokerId === b.id
                      ? "border-primary bg-primary-soft"
                      : "border-hairline-soft"
                  }`}
                >
                  <input
                    type="radio"
                    name="broker"
                    checked={brokerId === b.id}
                    onChange={() => setBrokerId(b.id)}
                  />
                  {b.name} ({b.shortName})
                </label>
              ))}
              {filteredBrokers.length === 0 ? (
                <p className="text-sm text-slate">{t("common.empty")}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div>
            <input
              className={inputClass}
              value={instrumentQuery}
              onChange={(e) => setInstrumentQuery(e.target.value)}
              placeholder={t("common.search")}
              aria-label={t("common.search")}
            />
            <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {filteredInstruments.map((i) => (
                <label
                  key={i.id}
                  className="flex items-center gap-2 rounded-xl border border-hairline-soft px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={instrumentIds.includes(i.id)}
                    onChange={(e) =>
                      setInstrumentIds((current) =>
                        e.target.checked
                          ? [...current, i.id]
                          : current.filter((id) => id !== i.id),
                      )
                    }
                  />
                  {i.code} · {i.name}
                </label>
              ))}
              {filteredInstruments.length === 0 ? (
                <p className="text-sm text-slate">{t("common.empty")}</p>
              ) : null}
            </div>
          </div>
        )}

        {finish.isError ? (
          <p className="mt-4 text-sm text-critical">{t("onboarding.error")}</p>
        ) : null}

        <div className="mt-6 flex justify-between gap-3">
          <button
            type="button"
            className="rounded-full px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-surface-soft disabled:opacity-40"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || finish.isPending}
          >
            {t("onboarding.back")}
          </button>
          {step < 2 ? (
            <button
              type="button"
              className="rounded-full bg-ink-deep px-4 py-2 text-sm font-bold text-canvas transition-colors hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 0 && !step0Valid) || (step === 1 && brokerId === null)
              }
            >
              {t("onboarding.next")}
            </button>
          ) : (
            <button
              type="button"
              className="rounded-full bg-ink-deep px-4 py-2 text-sm font-bold text-canvas transition-colors hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => finish.mutate()}
              disabled={finish.isPending}
            >
              {finish.isPending ? t("onboarding.saving") : t("onboarding.finish")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}