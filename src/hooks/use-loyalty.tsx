"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  apiAddCustomer,
  apiClearTransactionHistory,
  apiDeleteCustomer,
  apiDeleteTransaction,
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
  deleteCustomer: (input: {
    customerId: string;
    adminUsername: string;
    adminPassword: string;
  }) => Promise<void>;
  logPurchase: (input: LogPurchaseInput) => Promise<Transaction>;
  redeemPoints: (input: RedeemPointsInput) => Promise<Transaction>;
  redeemVoucher: (input: RedeemVoucherInput) => Promise<Transaction>;
  redeemFreeDrinkVoucher: (
    input: RedeemFreeDrinkVoucherInput
  ) => Promise<Transaction>;
  clearTransactionHistory: () => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  findCustomerByContact: (phoneEmailOrName: string) => Customer | undefined;
  getCustomerById: (id: string) => Customer | undefined;
  getTransactionsForCustomer: (customerId: string) => Transaction[];
}

const LoyaltyContext = createContext<LoyaltyContextValue | null>(null);

const FULL_PAGE_REFRESH_MS = 15 * 60 * 1000;
const NEW_CUSTOMER_POLL_MS = 30 * 1000;

function customerIdsFingerprint(customers: Customer[]): string {
  return customers
    .map((customer) => customer.id)
    .sort()
    .join(",");
}

function notReady(): never {
  throw new Error("Loyalty data is not loaded yet.");
}

export function LoyaltyProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isReady: authReady } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const customersRef = useRef(customers);
  customersRef.current = customers;

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

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;

    let cancelled = false;

    const pollForNewCustomers = async () => {
      try {
        const data = await fetchLoyaltyData();
        if (cancelled) return;

        const previousFingerprint = customerIdsFingerprint(customersRef.current);
        const nextFingerprint = customerIdsFingerprint(data.customers);
        if (previousFingerprint === nextFingerprint) return;

        setCustomers(data.customers);
        setTransactions(data.transactions);
      } catch {
        // Keep showing the last successful load on transient poll failures.
      }
    };

    const customerPollId = window.setInterval(
      pollForNewCustomers,
      NEW_CUSTOMER_POLL_MS
    );
    const pageRefreshId = window.setInterval(() => {
      window.location.reload();
    }, FULL_PAGE_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(customerPollId);
      window.clearInterval(pageRefreshId);
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
    deleteCustomer: async (input) => {
      if (!isReady || !isAuthenticated) notReady();
      await apiDeleteCustomer(input);
      await refresh();
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
    deleteTransaction: async (transactionId) => {
      if (!isReady || !isAuthenticated) notReady();
      await apiDeleteTransaction(transactionId);
      await refresh();
    },
    findCustomerByContact: (phoneEmailOrName) => {
      const trimmed = phoneEmailOrName.trim();
      if (!trimmed) return undefined;
      const query = trimmed.toLowerCase();

      if (trimmed.includes("@")) {
        return customers.find((c) => c.email.toLowerCase() === query);
      }

      const digits = trimmed.replace(/\D/g, "");
      if (digits) {
        const byPhone = customers.find(
          (c) =>
            c.phone.replace(/\D/g, "").includes(digits) ||
            c.phone.toLowerCase().includes(query)
        );
        if (byPhone) return byPhone;
      }

      const exactName = customers.find(
        (c) => c.name.trim().toLowerCase() === query
      );
      if (exactName) return exactName;

      return customers
        .filter((c) => c.name.toLowerCase().includes(query))
        .sort(
          (a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name)
        )[0];
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
