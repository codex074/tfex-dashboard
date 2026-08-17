import { type FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthContext";
import { api, type AuthUser } from "../services/api";
import { Badge, ErrorState, Loading, PageTitle, PasswordInput } from "../components/ui";

const input = "mt-1 w-full rounded-xl border border-hairline-soft px-3 py-2 text-sm";

export function AdminUsersPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [member, setMember] = useState({ displayName: "", email: "", password: "", role: "USER" });

  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => api.get<AuthUser[]>("/admin/users") });

  const createMember = useMutation({
    mutationFn: () => api.post<AuthUser>("/admin/users", { displayName: member.displayName.trim(), email: member.email.trim(), password: member.password, role: member.role }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      setMember({ displayName: "", email: "", password: "", role: "USER" });
    },
  });

  const updateMember = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) => api.patch<AuthUser>(`/admin/users/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    createMember.mutate();
  }

  if (users.isLoading) return <Loading label={t("common.loading")} />;
  if (users.isError) return <ErrorState message={t("common.error")} />;

  const list = users.data ?? [];

  return (
    <div className="space-y-10">
      <PageTitle
        title={t("users.title")}
        subtitle={t("users.subtitle")}
        actions={<span className="rounded-full bg-surface-soft px-3 py-1 text-xs font-bold text-steel">{list.length}</span>}
      />

      <section className="overflow-hidden rounded-xxxl border border-hairline-soft bg-canvas">
        <div className="border-b border-hairline-soft px-6 py-5">
          <h2 className="text-xl font-medium text-ink-deep">{t("users.createTitle")}</h2>
          <p className="text-sm text-slate">{t("users.createHelp")}</p>
        </div>
        <form className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-4" onSubmit={submit}>
          <label className="text-sm font-medium text-ink">
            {t("auth.displayName")}
            <input className={input} value={member.displayName} onChange={(e) => setMember({ ...member, displayName: e.target.value })} required />
          </label>
          <label className="text-sm font-medium text-ink">
            {t("auth.email")}
            <input className={input} type="email" value={member.email} onChange={(e) => setMember({ ...member, email: e.target.value })} required />
          </label>
          <label className="text-sm font-medium text-ink">
            {t("auth.password")}
            <PasswordInput className={input} minLength={8} value={member.password} onChange={(e) => setMember({ ...member, password: e.target.value })} required />
          </label>
          <label className="text-sm font-medium text-ink">
            {t("users.role")}
            <select className={input} value={member.role} onChange={(e) => setMember({ ...member, role: e.target.value })}>
              <option value="USER">{t("users.roleUser")}</option>
              <option value="ADMIN">{t("users.roleAdmin")}</option>
            </select>
          </label>
          <div className="md:col-span-2 lg:col-span-4">
            {createMember.isError ? <p className="mb-2 text-sm text-critical">{t("users.createError")}</p> : null}
            <button className="w-full rounded-full bg-ink-deep px-4 py-2 text-sm font-bold text-canvas disabled:opacity-60" disabled={createMember.isPending}>
              {createMember.isPending ? t("auth.saving") : t("users.add")}
            </button>
          </div>
        </form>
      </section>

      {list.length === 0 ? (
        <p className="py-12 text-center text-stone">{t("common.empty")}</p>
      ) : (
        <div className="overflow-hidden rounded-xxxl border border-hairline-soft bg-canvas">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline-soft text-xs uppercase tracking-wide text-steel">
                <th className="px-6 py-3 font-medium">{t("users.columns.name")}</th>
                <th className="px-6 py-3 font-medium">{t("auth.email")}</th>
                <th className="px-6 py-3 font-medium">{t("users.role")}</th>
                <th className="px-6 py-3 font-medium">{t("common.status")}</th>
                <th className="px-6 py-3 font-medium">{t("users.columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const busy = updateMember.isPending && updateMember.variables?.id === u.id;
                return (
                  <tr key={u.id} className="border-b border-hairline-soft last:border-0">
                    <td className="px-6 py-3 font-medium text-ink-deep">{u.displayName}</td>
                    <td className="px-6 py-3 text-slate">{u.email}</td>
                    <td className="px-6 py-3">
                      <select
                        className="rounded-xl border border-hairline-soft px-2 py-1 text-sm"
                        value={u.role}
                        disabled={busy}
                        onChange={(e) => updateMember.mutate({ id: u.id, body: { role: e.target.value } })}
                      >
                        <option value="USER">{t("users.roleUser")}</option>
                        <option value="ADMIN">{t("users.roleAdmin")}</option>
                      </select>
                    </td>
                    <td className="px-6 py-3">
                      <Badge tone={u.isActive ? "success" : "attention"}>
                        {u.isActive ? t("users.active") : t("users.inactive")}
                      </Badge>
                    </td>
                    <td className="px-6 py-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-hairline-soft px-3 py-1 text-xs font-bold text-ink transition-colors hover:bg-surface-soft disabled:opacity-60"
                        disabled={busy}
                        onClick={() => updateMember.mutate({ id: u.id, body: { isActive: !u.isActive } })}
                      >
                        {busy ? t("auth.saving") : u.isActive ? t("users.deactivate") : t("users.activate")}
                        {isSelf ? <span className="text-stone">· {t("users.you")}</span> : null}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {updateMember.isError ? <p className="px-6 py-4 text-sm text-critical">{t("users.updateError")}</p> : null}
        </div>
      )}
    </div>
  );
}