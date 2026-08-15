import { useQuery } from "@tanstack/react-query";
import { api, type Account } from "../services/api";

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.get<Account[]>("/accounts"),
  });
}

export function useActiveAccountId(): number | undefined {
  const { data } = useAccounts();
  return data?.[0]?.id;
}