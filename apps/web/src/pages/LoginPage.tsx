import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export function LoginPage() {
  const { t } = useTranslation();
  const { authenticate, needsBootstrap } = useAuth();
  const [form, setForm] = useState({ displayName: "", email: "", password: "" });
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(false); setSaving(true);
    try { await authenticate(form.email, form.password, form.displayName); } catch { setError(true); } finally { setSaving(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-surface-soft p-6">
    <div className="w-full max-w-md rounded-xxxl border border-hairline-soft bg-canvas p-8 shadow-xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div><img src="/favicon.png" alt="" className="mb-4 h-12 w-12 rounded-xl" /><h1 className="text-2xl font-bold text-ink-deep">{needsBootstrap ? t("auth.setupTitle") : t("auth.loginTitle")}</h1><p className="mt-2 text-sm text-slate">{needsBootstrap ? t("auth.setupHelp") : t("auth.loginHelp")}</p></div>
        <LanguageSwitcher />
      </div>
      <form className="space-y-4" onSubmit={submit}>
        {needsBootstrap ? <label className="block text-sm font-medium text-ink">{t("auth.displayName")}<input className="mt-1 w-full rounded-xl border border-hairline-soft px-3 py-2" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required /></label> : null}
        <label className="block text-sm font-medium text-ink">{t("auth.email")}<input className="mt-1 w-full rounded-xl border border-hairline-soft px-3 py-2" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label className="block text-sm font-medium text-ink">{t("auth.password")}<input className="mt-1 w-full rounded-xl border border-hairline-soft px-3 py-2" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        {error ? <p className="text-sm text-critical">{t("auth.error")}</p> : null}
        <button className="w-full rounded-full bg-ink-deep px-4 py-3 text-sm font-bold text-canvas disabled:opacity-60" disabled={saving}>{saving ? t("auth.saving") : needsBootstrap ? t("auth.createAdmin") : t("auth.login")}</button>
      </form>
    </div>
  </main>;
}
