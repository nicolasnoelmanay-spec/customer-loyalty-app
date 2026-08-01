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
  clearTransactionHistory as apiClearTransactionHistory,
  createCustomer,
  fetchLoyaltyData,
  logPurchase as apiLogPurchase,
  redeemFreeDrinkVoucher as apiRedeemFreeDrinkVoucher,
  redeemPoints as apiRedeemPoints,
  redeemVoucher as apiRedeemVoucher,
  updateCustomer as apiUpdateCustomer,
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

const emptyValue = (refresh: () => Promise<void>): LoyaltyContextValue => ({
  isReady: false,
  customers: [],
  transactions: [],
  refresh,
  addCustomer: notReady,
  updateCustomer: notReady,
  logPurchase: notReady,
  redeemPoints: notReady,
  redeemVoucher: notReady,
  redeemFreeDrinkVoucher: notReady,
  clearTransactionHistory: notReady,
  findCustomerByContact: () => undefined,
  getCustomerById: () => undefined,
  getTransactionsForCustomer: () => [],
});

export function LoyaltyProvider({ children }: { children: ReactNode }) {
  const { isReady: authReady, isAuthenticated } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCustomers([]);
      setTransactions([]);
      setIsReady(true);
      return;
    }

    setIsReady(false);
    try {
      const data = await fetchLoyaltyData();
      setCustomers(data.customers);
      setTransactions(data.transactions);
    } finally {
      setIsReady(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authReady) return;
    void refresh();
  }, [authReady, refresh]);

  const value: LoyaltyContextValue = !authReady
    ? emptyValue(refresh)
    : {
        isReady,
        customers,
        transactions,
        refresh,
        addCustomer: async (input) => {
          const customer = await createCustomer(input);
          await refresh();
          return customer;
        },
        updateCustomer: async (input) => {
          const customer = await apiUpdateCustomer(input);
          await refresh();
          return customer;
        },
        logPurchase: async (input) => {
          const transaction = await apiLogPurchase(input);
          await refresh();
          return transaction;
        },
        redeemPoints: async (input) => {
          const transaction = await apiRedeemPoints(input);
          await refresh();
          return transaction;
        },
        redeemVoucher: async (input) => {
          const transaction = await apiRedeemVoucher(input);
          await refresh();
          return transaction;
        },
        redeemFreeDrinkVoucher: async (input) => {
          const transaction = await apiRedeemFreeDrinkVoucher(input);
          await refresh();
          return transaction;
        },
        clearTransactionHistory: async () => {
          await apiClearTransactionHistory();
          await refresh();
        },
        findCustomerByContact: (phoneOrEmail) => {
          const query = phoneOrEmail.trim().toLowerCase();
          return customers.find(
            (c) =>
              c.phone.trim().toLowerCase() === query ||
              c.email.toLowerCase() === query ||
              c.phone.includes(phoneOrEmail.trim()) ||
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
