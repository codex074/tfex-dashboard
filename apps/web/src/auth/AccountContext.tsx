import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Account } from "../services/api";

const ACTIVE_ACCOUNT_KEY = "tfex.activeAccountId";

interface AccountContextValue {
  accounts: Account[];
  activeAccountId: number | undefined;
  setActiveAccountId: (id: number) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

function readStoredId(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.get<Account[]>("/accounts"),
  });

  const liveAccounts = (data ?? []).filter((account) => !account.deletedAt);

  const [selectedId, setSelectedId] = useState<number | undefined>(readStoredId);

  // Fall back to the first live account when the stored selection is no
  // longer valid (e.g. the account was just deleted).
  const activeAccountId = liveAccounts.some((account) => account.id === selectedId)
    ? selectedId
    : liveAccounts[0]?.id;

  const setActiveAccountId = useCallback((id: number) => {
    setSelectedId(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, String(id));
    }
  }, []);

  useEffect(() => {
    if (activeAccountId !== undefined && activeAccountId !== selectedId) {
      setSelectedId(activeAccountId);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, String(activeAccountId));
      }
    }
  }, [activeAccountId, selectedId]);

  return (
    <AccountContext.Provider
      value={{ accounts: liveAccounts, activeAccountId, setActiveAccountId }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccountSelection(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccountSelection must be used inside AccountProvider");
  }
  return context;
}

export function useActiveAccountId(): number | undefined {
  return useAccountSelection().activeAccountId;
}