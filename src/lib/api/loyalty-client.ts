import type {
  CreateCustomerInput,
  CreatePendingOrderInput,
  CompletedOrder,
  Customer,
  LogPurchaseInput,
  LoyaltyData,
  PendingOrder,
  Product,
  PurchaseItemInput,
  RedeemFreeDrinkVoucherInput,
  RedeemPointsInput,
  RedeemVoucherInput,
  Transaction,
  UpdateCustomerInput,
  UpdatePendingOrderInput,
} from "@/types";

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Request failed."
    );
  }
  return data as T;
}

export async function fetchLoyaltyData(): Promise<LoyaltyData> {
  const response = await fetch("/api/loyalty", { credentials: "include" });
  return parseJson<LoyaltyData>(response);
}

export async function lookupCustomer(query: string): Promise<{
  customer: Customer | null;
  transactions: Transaction[];
}> {
  const response = await fetch(
    `/api/lookup?q=${encodeURIComponent(query)}`,
    { credentials: "include" }
  );
  return parseJson(response);
}

export async function apiAddCustomer(
  input: CreateCustomerInput
): Promise<Customer> {
  const response = await fetch("/api/customers", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function apiRegisterMember(
  input: CreateCustomerInput
): Promise<Customer> {
  const response = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function apiUpdateCustomer(
  input: UpdateCustomerInput
): Promise<Customer> {
  const response = await fetch(`/api/customers/${input.customerId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      phone: input.phone,
      email: input.email,
      points: input.points,
    }),
  });
  return parseJson(response);
}

export async function apiSendEmail(input: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}): Promise<{ id: string }> {
  const response = await fetch("/api/email", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function apiDeleteCustomer(input: {
  customerId: string;
  adminUsername: string;
  adminPassword: string;
}): Promise<void> {
  const response = await fetch(`/api/customers/${input.customerId}`, {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: input.adminUsername,
      password: input.adminPassword,
    }),
  });
  await parseJson(response);
}

export async function fetchProducts(): Promise<Product[]> {
  const response = await fetch("/api/products");
  const data = await parseJson<{ products: Product[] }>(response);
  return data.products;
}

export async function fetchCompletedOrders(): Promise<CompletedOrder[]> {
  const response = await fetch("/api/completed-orders", {
    credentials: "include",
  });
  const data = await parseJson<{ orders: CompletedOrder[] }>(response);
  return data.orders;
}

export async function fetchPendingOrders(): Promise<PendingOrder[]> {
  const response = await fetch("/api/pending-orders", {
    credentials: "include",
  });
  const data = await parseJson<{ orders: PendingOrder[] }>(response);
  return data.orders;
}

export async function apiCreatePendingOrder(
  input: CreatePendingOrderInput
): Promise<PendingOrder> {
  const response = await fetch("/api/pending-orders", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function apiUpdatePendingOrder(
  orderId: string,
  input: UpdatePendingOrderInput
): Promise<PendingOrder> {
  const response = await fetch(`/api/pending-orders/${orderId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function apiCompletePendingOrder(
  orderId: string
): Promise<Transaction> {
  const response = await fetch(`/api/pending-orders/${orderId}/complete`, {
    method: "POST",
    credentials: "include",
  });
  return parseJson(response);
}

export async function apiDeletePendingOrder(orderId: string): Promise<void> {
  const response = await fetch(`/api/pending-orders/${orderId}`, {
    method: "DELETE",
    credentials: "include",
  });
  await parseJson(response);
}

export async function apiLogPurchase(
  input: LogPurchaseInput
): Promise<Transaction> {
  const response = await fetch(`/api/customers/${input.customerId}/purchase`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      drinkCount: input.drinkCount,
      items: input.items,
      notes: input.notes,
    }),
  });
  return parseJson(response);
}

export async function apiRedeemPoints(
  input: RedeemPointsInput
): Promise<Transaction> {
  const response = await fetch(
    `/api/customers/${input.customerId}/redeem-points`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        points: input.points,
        reason: input.reason,
      }),
    }
  );
  return parseJson(response);
}

export async function apiRedeemVoucher(
  input: RedeemVoucherInput
): Promise<Transaction> {
  const response = await fetch(
    `/api/customers/${input.customerId}/redeem-voucher`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        count: input.count,
        reason: input.reason,
      }),
    }
  );
  return parseJson(response);
}

export async function apiRedeemFreeDrinkVoucher(
  input: RedeemFreeDrinkVoucherInput
): Promise<Transaction> {
  const response = await fetch(
    `/api/customers/${input.customerId}/redeem-free-drink-voucher`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        count: input.count,
        reason: input.reason,
      }),
    }
  );
  return parseJson(response);
}

export async function apiClearTransactionHistory(): Promise<void> {
  const response = await fetch("/api/transactions", {
    method: "DELETE",
    credentials: "include",
  });
  await parseJson(response);
}

export async function apiDeleteTransaction(transactionId: string): Promise<void> {
  const response = await fetch(`/api/transactions/${transactionId}`, {
    method: "DELETE",
    credentials: "include",
  });
  await parseJson(response);
}

export async function apiLogin(
  username: string,
  password: string
): Promise<void> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  await parseJson(response);
}

export async function apiLogout(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  await parseJson(response);
}

export async function apiGetSession(): Promise<boolean> {
  const response = await fetch("/api/auth/session", {
    credentials: "include",
  });
  const data = await parseJson<{ authenticated: boolean }>(response);
  return data.authenticated;
}
