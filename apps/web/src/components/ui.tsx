import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatMoney, formatPercent, formatProfitFactor } from "../utils/format";

export function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xxxl border border-hairline-soft bg-canvas ${className}`}
    >
      {title ? (
        <div className="border-b border-hairline-soft px-8 py-6">
          <h3 className="text-[24px] font-medium leading-tight text-ink-deep">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
      <div className="p-8">{children}</div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xxxl p-8 ${
        accent
          ? "bg-ink-deep text-canvas"
          : "border border-hairline-soft bg-canvas"
      }`}
    >
      <div
        className={`text-sm font-medium ${
          accent ? "text-canvas/70" : "text-steel"
        }`}
      >
        {label}
      </div>
      <div
        className={`mt-3 text-[28px] font-medium leading-tight ${
          accent ? "text-canvas" : "text-ink-deep"
        }`}
      >
        {value}
      </div>
      {hint ? (
        <div
          className={`mt-2 text-xs ${
            accent ? "text-canvas/60" : "text-stone"
          }`}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function PnlText({
  value,
  lang,
}: {
  value: string | number;
  lang: string;
}) {
  const num = typeof value === "string" ? Number(value) : value;
  const color =
    num > 0 ? "text-success" : num < 0 ? "text-critical" : "text-stone";
  return (
    <span className={`font-medium ${color}`}>{formatMoney(value, lang)}</span>
  );
}

export function PercentText({
  value,
  lang,
}: {
  value: number | null | undefined;
  lang: string;
}) {
  if (value === null || value === undefined) {
    return <span className="text-stone">—</span>;
  }
  const color = value >= 0 ? "text-success" : "text-critical";
  return (
    <span className={`font-medium ${color}`}>{formatPercent(value, lang)}</span>
  );
}

export function ProfitFactorText({
  value,
  lang,
}: {
  value: number | null | undefined;
  lang: string;
}) {
  return (
    <span className="font-medium text-ink">
      {formatProfitFactor(value, lang)}
    </span>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "attention" | "critical" | "promo";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-soft text-ink",
    success: "bg-success-soft text-success",
    attention: "bg-attention-soft text-attention",
    critical: "bg-critical-soft text-critical",
    promo: "bg-warning text-ink-deep",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function DirectionBadge({ direction }: { direction: string }) {
  const isLong = direction === "LONG";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
        isLong ? "bg-success-soft text-success" : "bg-critical-soft text-critical"
      }`}
    >
      {direction}
    </span>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-stone">
      <div className="animate-pulse">{label}</div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-critical-strong bg-critical-soft p-4 text-sm text-critical-strong">
      {message}
    </div>
  );
}

export function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center py-12 text-sm text-stone">
      {t("common.empty")}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[36px] font-medium leading-tight text-ink-deep">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 text-base text-slate">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}