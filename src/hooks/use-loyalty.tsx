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
  apiAddCustomer,
  apiClearTransactionHistory,
  apiLogPurchase,
  apiRedeemFreeDrinkVoucher,
  apiRedeemPoints,
  apiRedeemVoucher,
  apiUpdateCustomer,
  fetchLoyaltyData,
} from "@/lib/api/loyalty-client";
import { useAuth } from "@/hooks/use-auth";
import type {
  CreateCustomerInput,
  Customer,
  LogPurchaseInput,
  RedeemFreeDrinkVoucherInput,
  RedeemPointsInput,
  Transaction,
  UpdateCustomerInput,
  RedeemVoucherInput,
} from "@/types";

interface LoyaltyContextValue {
  isReady: boolean;
  customers: Customer[];
  transactions: Transaction[];
  refresh: () => Promise<void>;
  addCustomer: (input: CreateCustomerInput) => Promise<Customer>;
  updateCustomer: (input: UpdateCustomerInput) => Promise<Customer>;
  logPurchase: (input: LogPurchaseInput) => Promise<Transaction>;
  redeemPoints: (input: RedeemPointsInput) => Promise<Transaction>;
  redeemVoucher: (input: RedeemVoucherInput) => Promise<Transaction>;
  redeemFreeDrinkVoucher: (
    input: RedeemFreeDrinkVoucherInput
  ) => Promise<Transaction>;
  clearTransactionHistory: () => Promise<void>;
  findCustomerByContact: (phoneOrEmail: string) => Customer | undefined;
  getCustomerById: (id: string) => Customer | undefined;
  getTransactionsForCustomer: (customerId: string) => Transaction[];
}

const LoyaltyContext = createContext<LoyaltyContextValue | null>(null);

function notReady(): never {
  throw new Error("Loyalty data is not loaded yet.");
}

export function LoyaltyProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isReady: authReady } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCustomers([]);
      setTransactions([]);
      return;
    }

    const data = await fetchLoyaltyData();
    setCustomers(data.customers);
    setTransactions(data.transactions);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authReady) return;

    if (!isAuthenticated) {
      setCustomers([]);
      setTransactions([]);
      setIsReady(true);
      return;
    }

    let cancelled = false;
    setIsReady(false);
    fetchLoyaltyData()
      .then((data) => {
        if (!cancelled) {
          setCustomers(data.customers);
          setTransactions(data.transactions);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCustomers([]);
          setTransactions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated]);

  const value: LoyaltyContextValue = {
    isReady: authReady && isReady,
    customers,
    transactions,
    refresh,
    addCustomer: async (input) => {
      if (!isReady || !isAuthenticated) notReady();
      const customer = await apiAddCustomer(input);
      await refresh();
      return customer;
    },
    updateCustomer: async (input) => {
      if (!isReady || !isAuthenticated) notReady();
      const customer = await apiUpdateCustomer(input);
      await refresh();
      return customer;
    },
    logPurchase: async (input) => {
      if (!isReady || !isAuthenticated) notReady();
      const txn = await apiLogPurchase(input);
      await refresh();
      return txn;
    },
    redeemPoints: async (input) => {
      if (!isReady || !isAuthenticated) notReady();
      const txn = await apiRedeemPoints(input);
      await refresh();
      return txn;
    },
    redeemVoucher: async (input) => {
      if (!isReady || !isAuthenticated) notReady();
      const txn = await apiRedeemVoucher(input);
      await refresh();
      return txn;
    },
    redeemFreeDrinkVoucher: async (input) => {
      if (!isReady || !isAuthenticated) notReady();
      const txn = await apiRedeemFreeDrinkVoucher(input);
      await refresh();
      return txn;
    },
    clearTransactionHistory: async () => {
      if (!isReady || !isAuthenticated) notReady();
      await apiClearTransactionHistory();
      await refresh();
    },
    findCustomerByContact: (phoneOrEmail) => {
      const query = phoneOrEmail.trim().toLowerCase();
      return customers.find(
        (c) =>
          c.phone.toLowerCase().includes(query) ||
          c.email.toLowerCase() === query
      );
    },
    getCustomerById: (id) => customers.find((c) => c.id === id),
    getTransactionsForCustomer: (customerId) =>
      transactions.filter((t) => t.customerId === customerId),
  };

  return (
    <LoyaltyContext.Provider value={value}>{children}</LoyaltyContext.Provider>
  );
}

export function useLoyalty() {
  const context = useContext(LoyaltyContext);
  if (!context) {
    throw new Error("useLoyalty must be used within LoyaltyProvider");
  }
  return context;
}
