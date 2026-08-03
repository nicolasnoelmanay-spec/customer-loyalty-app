import type {
  CreateCustomerInput,
  Customer,
  LogPurchaseInput,
  LoyaltyData,
  RedeemFreeDrinkVoucherInput,
  RedeemPointsInput,
  Transaction,
  UpdateCustomerInput,
  RedeemVoucherInput,
} from "@/types";

export interface LoyaltyRepository {
  getData(): LoyaltyData;
  getCustomers(): Customer[];
  getCustomerById(id: string): Customer | undefined;
  findCustomerByContact(phoneEmailOrName: string): Customer | undefined;
  getTransactions(): Transaction[];
  getTransactionsForCustomer(customerId: string): Transaction[];
  addCustomer(input: CreateCustomerInput): Customer;
  updateCustomer(input: UpdateCustomerInput): Customer;
  logPurchase(input: LogPurchaseInput): Transaction;
  redeemPoints(input: RedeemPointsInput): Transaction;
  redeemVoucher(input: RedeemVoucherInput): Transaction;
  redeemFreeDrinkVoucher(input: RedeemFreeDrinkVoucherInput): Transaction;
  clearTransactionHistory(): void;
  deleteTransaction(transactionId: string): void;
}
