"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiGetSession, apiLogin, apiLogout } from "@/lib/api/loyalty-client";

interface AuthContextValue {
  isReady: boolean;
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGetSession()
      .then((session) => {
        if (!cancelled) {
          setIsAuthenticated(session.authenticated);
          setUsername(session.username);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAuthenticated(false);
          setUsername(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (usernameValue: string, password: string) => {
    try {
      const result = await apiLogin(usernameValue, password);
      setIsAuthenticated(true);
      setUsername(result.username);
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setIsAuthenticated(false);
      setUsername(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ isReady, isAuthenticated, username, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
