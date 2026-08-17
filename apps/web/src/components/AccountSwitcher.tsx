import { useAccountSelection } from "../auth/AccountContext";
import { useTranslation } from "react-i18next";

export function AccountSwitcher() {
  const { t } = useTranslation();
  const { accounts, activeAccountId, setActiveAccountId } = useAccountSelection();

  if (accounts.length === 0) return null;

  return (
    <select
      aria-label={t("account.title")}
      title={t("account.title")}
      value={activeAccountId ?? ""}
      onChange={(e) => setActiveAccountId(Number(e.target.value))}
      className="max-w-full rounded-xl border border-hairline-soft bg-canvas px-3 py-2 text-sm text-ink"
    >
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name}
          {account.accountNumber ? ` · ${account.accountNumber}` : ""}
        </option>
      ))}
    </select>
  );
}