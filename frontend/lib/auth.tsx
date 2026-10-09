"use client";
/**
 * Auth state for the whole app.
 *
 * status:
 *   loading - checking a stored token with GET /api/auth/me
 *   authed  - `user` is set
 *   anon    - no (valid) session
 *   error   - the server couldn't be reached; we keep the token and let the user retry
 */
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, api } from "./api";
import { clearToken, getToken, setToken, setUnauthorizedHandler } from "./session";
import type { User } from "./types";

type Status = "loading" | "authed" | "anon" | "error";

interface AuthApi {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Only allow same-site relative redirects (blocks open-redirect via ?next=https://evil.com or //evil.com). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const check = useCallback(async () => {
    if (!getToken()) {
      setStatus("anon");
      return;
    }
    setStatus("loading");
    try {
      setUser(await api.me());
      setStatus("authed");
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        setStatus("error"); // backend down: don't throw the session away
      } else {
        clearToken();
        setUser(null);
        setStatus("anon");
      }
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  // Any API call that comes back 401 (expired / revoked session) logs us out locally.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken();
      setUser(null);
      setStatus("anon");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const accept = (res: { token: string; user: User }) => {
    setToken(res.token);
    setUser(res.user);
    setStatus("authed");
  };

  const value = useMemo<AuthApi>(
    () => ({
      user,
      status,
      login: async (email, password) => accept(await api.login(email, password)),
      signup: async (email, password, name) => accept(await api.signup(email, password, name)),
      logout: async () => {
        try {
          await api.logout();
        } catch {
          /* token may already be dead server-side; we clear it locally regardless */
        }
        clearToken();
        setUser(null);
        setStatus("anon");
        router.push("/");
      },
      retry: () => void check(),
    }),
    [user, status, check, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
