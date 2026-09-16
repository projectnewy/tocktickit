import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as authApi from "../api/auth.js";
import type { AuthUser } from "../api/types.js";

interface AuthContextValue {
  user: AuthUser | null;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  // Re-fetches /auth/me — used after a successful password change so the
  // in-memory user's mustChangePassword flips without a full page reload.
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // The httpOnly session cookie (not localStorage) is the real source of
    // truth for "am I logged in" — ask the server on every load rather than
    // caching identity client-side.
    authApi
      .me()
      .then(({ user: current }) => {
        if (!cancelled) setUser(current);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string): Promise<AuthUser> {
    const { user: logged } = await authApi.login({ email, password });
    setUser(logged);
    return logged;
  }

  async function logout(): Promise<void> {
    await authApi.logout();
    setUser(null);
  }

  async function refresh(): Promise<void> {
    const { user: current } = await authApi.me();
    setUser(current);
  }

  return (
    <AuthContext.Provider value={{ user, isBootstrapping, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
