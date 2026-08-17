import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { PasswordInput } from "../components/ui";

const input = "mt-1 w-full rounded-xl border border-hairline-soft px-3 py-2";

export function LoginPage() {
  const { t } = useTranslation();
  const { authenticate, register, needsBootstrap } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ displayName: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [registered, setRegistered] = useState(false);

  const isRegister = !needsBootstrap && mode === "register";

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null);
    if (isRegister && form.password !== form.confirmPassword) { setError(t("auth.passwordMismatch")); return; }
    setSaving(true);
    try {
      if (isRegister) {
        await register(form.email, form.password, form.confirmPassword, form.displayName);
        setRegistered(true);
        setMode("login");
        setForm({ displayName: "", email: form.email, password: "", confirmPassword: "" });
      } else {
        await authenticate(form.email, form.password, form.displayName);
      }
    } catch {
      setError(t(isRegister ? "auth.registerError" : "auth.error"));
    } finally {
      setSaving(false);
    }
  }

  function switchMode(next: "login" | "register") {
    setMode(next); setError(null); setRegistered(false);
    setForm({ displayName: "", email: "", password: "", confirmPassword: "" });
  }

  return <main className="flex min-h-screen items-center justify-center bg-surface-soft p-6">
    <div className="w-full max-w-md rounded-xxxl border border-hairline-soft bg-canvas p-8 shadow-xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div><img src="/favicon.png" alt="" className="mb-4 h-12 w-12 rounded-xl" /><h1 className="text-2xl font-bold text-ink-deep">{needsBootstrap ? t("auth.setupTitle") : isRegister ? t("auth.registerTitle") : t("auth.loginTitle")}</h1><p className="mt-2 text-sm text-slate">{needsBootstrap ? t("auth.setupHelp") : isRegister ? t("auth.registerHelp") : t("auth.loginHelp")}</p></div>
        <LanguageSwitcher />
      </div>
      {registered ? <p className="mb-4 rounded-xl bg-surface-soft px-4 py-3 text-sm text-ink">{t("auth.registerSuccess")}</p> : null}
      <form className="space-y-4" onSubmit={submit}>
        {needsBootstrap || isRegister ? <label className="block text-sm font-medium text-ink">{t("auth.displayName")}<input className={input} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required /></label> : null}
        <label className="block text-sm font-medium text-ink">{t("auth.email")}<input className={input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label className="block text-sm font-medium text-ink">{t("auth.password")}<PasswordInput className={input} minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        {isRegister ? <label className="block text-sm font-medium text-ink">{t("auth.confirmPassword")}<PasswordInput className={input} minLength={8} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required /></label> : null}
        {error ? <p className="text-sm text-critical">{error}</p> : null}
        <button className="w-full rounded-full bg-ink-deep px-4 py-3 text-sm font-bold text-canvas disabled:opacity-60" disabled={saving}>{saving ? t("auth.saving") : needsBootstrap ? t("auth.createAdmin") : isRegister ? t("auth.register") : t("auth.login")}</button>
      </form>
      {needsBootstrap ? null : <p className="mt-6 text-center text-sm text-slate">
        {isRegister
          ? <>{t("auth.haveAccount")} <button type="button" className="font-bold text-ink-deep underline" onClick={() => switchMode("login")}>{t("auth.login")}</button></>
          : <>{t("auth.noAccount")} <button type="button" className="font-bold text-ink-deep underline" onClick={() => switchMode("register")}>{t("auth.register")}</button></>}
      </p>}
    </div>
  </main>;
}
