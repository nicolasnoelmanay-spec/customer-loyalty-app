"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authConfig, validateStaffCredentials } from "@/config/auth";

interface AuthContextValue {
  isReady: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(authConfig.storageKey) === "authenticated";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read sessionStorage after mount
    setIsAuthenticated(readSession());
    setIsReady(true);
  }, []);

  const login = useCallback((username: string, password: string) => {
    if (!validateStaffCredentials(username, password)) {
      return false;
    }
    sessionStorage.setItem(authConfig.storageKey, "authenticated");
    setIsAuthenticated(true);
    return true;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(authConfig.storageKey);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isReady, isAuthenticated, login, logout }}
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
