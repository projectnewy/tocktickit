import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { setUnauthorizedHandler } from "../api/client.js";
import * as authApi from "../api/auth.js";
import type { AuthUser } from "../api/types.js";

interface AuthContextValue {
  user: AuthUser | null;
  isBootstrapping: boolean;
  // True after a request came back 401 while signed in (BR-33): the route guard then returns to Login and
  // Login explains why.
  sessionExpired: boolean;
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
  const [sessionExpired, setSessionExpired] = useState(false);

  // Any feature call that comes back 401 ends the client session; nothing here guesses at the cause.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser((current) => {
        if (current) setSessionExpired(true); // only a signed-in user can have an expired session
        return null;
      });
    });
    return () => setUnauthorizedHandler(null);
  }, []);

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
    setSessionExpired(false);
    setUser(logged);
    return logged;
  }

  async function logout(): Promise<void> {
    await authApi.logout();
    setSessionExpired(false);
    setUser(null);
  }

  async function refresh(): Promise<void> {
    const { user: current } = await authApi.me();
    setUser(current);
  }

  return (
    <AuthContext.Provider value={{ user, isBootstrapping, sessionExpired, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
