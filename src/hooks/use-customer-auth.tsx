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
  apiCustomerLogin,
  apiCustomerLogout,
  apiGetCustomerAccount,
  apiGetCustomerSession,
} from "@/lib/api/customer-auth-client";
import type { Customer, Transaction } from "@/types";

interface CustomerAuthContextValue {
  isReady: boolean;
  isAuthenticated: boolean;
  customer: Customer | null;
  transactions: Transaction[];
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAccount: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(
  null
);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const refreshAccount = useCallback(async () => {
    try {
      const account = await apiGetCustomerAccount();
      setCustomer(account.customer);
      setTransactions(account.transactions);
      setIsAuthenticated(true);
    } catch {
      setCustomer(null);
      setTransactions([]);
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiGetCustomerSession()
      .then(async (authenticated) => {
        if (cancelled) return;
        if (authenticated) {
          await refreshAccount();
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsAuthenticated(false);
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshAccount]);

  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const loggedInCustomer = await apiCustomerLogin(username, password);
        setCustomer(loggedInCustomer);
        setIsAuthenticated(true);
        await refreshAccount();
        return true;
      } catch {
        return false;
      }
    },
    [refreshAccount]
  );

  const logout = useCallback(async () => {
    try {
      await apiCustomerLogout();
    } finally {
      setCustomer(null);
      setTransactions([]);
      setIsAuthenticated(false);
    }
  }, []);

  return (
    <CustomerAuthContext.Provider
      value={{
        isReady,
        isAuthenticated,
        customer,
        transactions,
        login,
        logout,
        refreshAccount,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  }
  return context;
}
