"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  fetchStaffSession,
  loginStaff,
  logoutStaff,
  type StaffUser,
} from "@/lib/api/loyalty-client";

interface AuthContextValue {
  isReady: boolean;
  isAuthenticated: boolean;
  staff: StaffUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [staff, setStaff] = useState<StaffUser | null>(null);

  useEffect(() => {
    fetchStaffSession()
      .then(setStaff)
      .catch(() => setStaff(null))
      .finally(() => setIsReady(true));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const session = await loginStaff(username, password);
      setStaff(session);
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutStaff();
    setStaff(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isReady,
        isAuthenticated: staff !== null,
        staff,
        login,
        logout,
      }}
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
