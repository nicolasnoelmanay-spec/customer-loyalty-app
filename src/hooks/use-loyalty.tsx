"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { createLoyaltyRepository } from "@/lib/data";
import type { LoyaltyRepository } from "@/lib/data/types";
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
  refresh: () => void;
  addCustomer: (input: CreateCustomerInput) => Customer;
  updateCustomer: (input: UpdateCustomerInput) => Customer;
  logPurchase: (input: LogPurchaseInput) => Transaction;
  redeemPoints: (input: RedeemPointsInput) => Transaction;
  redeemVoucher: (input: RedeemVoucherInput) => Transaction;
  redeemFreeDrinkVoucher: (input: RedeemFreeDrinkVoucherInput) => Transaction;
  clearTransactionHistory: () => void;
  findCustomerByContact: (phoneOrEmail: string) => Customer | undefined;
  getCustomerById: (id: string) => Customer | undefined;
  getTransactionsForCustomer: (customerId: string) => Transaction[];
}

const LoyaltyContext = createContext<LoyaltyContextValue | null>(null);

function notReady(): never {
  throw new Error("Loyalty data is not loaded yet.");
}

const emptyValue = (refresh: () => void): LoyaltyContextValue => ({
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

function buildValue(
  repository: LoyaltyRepository,
  refresh: () => void
): LoyaltyContextValue {
  return {
    isReady: true,
    customers: repository.getCustomers(),
    transactions: repository.getTransactions(),
    refresh,
    addCustomer: (input) => {
      const customer = repository.addCustomer(input);
      refresh();
      return customer;
    },
    updateCustomer: (input) => {
      const customer = repository.updateCustomer(input);
      refresh();
      return customer;
    },
    logPurchase: (input) => {
      const txn = repository.logPurchase(input);
      refresh();
      return txn;
    },
    redeemPoints: (input) => {
      const txn = repository.redeemPoints(input);
      refresh();
      return txn;
    },
    redeemVoucher: (input) => {
      const txn = repository.redeemVoucher(input);
      refresh();
      return txn;
    },
    redeemFreeDrinkVoucher: (input) => {
      const txn = repository.redeemFreeDrinkVoucher(input);
      refresh();
      return txn;
    },
    clearTransactionHistory: () => {
      repository.clearTransactionHistory();
      refresh();
    },
    findCustomerByContact: (phoneOrEmail) =>
      repository.findCustomerByContact(phoneOrEmail),
    getCustomerById: (id) => repository.getCustomerById(id),
    getTransactionsForCustomer: (customerId) =>
      repository.getTransactionsForCustomer(customerId),
  };
}

export function LoyaltyProvider({ children }: { children: ReactNode }) {
  const [repository, setRepository] = useState<LoyaltyRepository | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const refresh = useCallback(() => rerender(), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- defer localStorage read until after hydration
    setRepository(createLoyaltyRepository());
  }, []);

  const value = repository
    ? buildValue(repository, refresh)
    : emptyValue(refresh);

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
