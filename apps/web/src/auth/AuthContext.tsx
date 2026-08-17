import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, AUTH_TOKEN_KEY, type AuthUser } from "../services/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  needsBootstrap: boolean;
  authenticate: (email: string, password: string, displayName?: string) => Promise<void>;
  register: (email: string, password: string, confirmPassword: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const status = await api.get<{ needsBootstrap: boolean }>("/auth/status");
        setNeedsBootstrap(status.needsBootstrap);
        if (window.localStorage.getItem(AUTH_TOKEN_KEY)) setUser(await api.get<AuthUser>("/auth/me"));
      } catch {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function authenticate(email: string, password: string, displayName?: string) {
    const path = needsBootstrap ? "/auth/bootstrap" : "/auth/login";
    const result = await api.post<{ token: string; user: AuthUser }>(path, { email, password, ...(needsBootstrap ? { displayName } : {}) });
    window.localStorage.setItem(AUTH_TOKEN_KEY, result.token);
    setUser(result.user);
    setNeedsBootstrap(false);
  }

  async function register(email: string, password: string, confirmPassword: string, displayName: string) {
    await api.post("/auth/register", { email, password, confirmPassword, displayName });
  }

  async function logout() {
    try { await api.post("/auth/logout"); } finally {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      setUser(null);
    }
  }

  return <AuthContext.Provider value={{ user, loading, needsBootstrap, authenticate, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
