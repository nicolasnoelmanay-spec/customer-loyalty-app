import type {
  CreateCustomerInput,
  Customer,
  LogPurchaseInput,
  LoyaltyData,
  RedeemFreeDrinkVoucherInput,
  RedeemPointsInput,
  RedeemVoucherInput,
  Transaction,
  UpdateCustomerInput,
} from "@/types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }
  return data;
}

export async function fetchLoyaltyData(): Promise<LoyaltyData> {
  return fetchJson<LoyaltyData>("/api/loyalty");
}

export async function lookupCustomer(contact: string): Promise<{
  customer: Customer;
  transactions: Transaction[];
}> {
  const params = new URLSearchParams({ contact });
  return fetchJson(`/api/lookup?${params.toString()}`);
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return fetchJson<Customer>("/api/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateCustomer(input: UpdateCustomerInput): Promise<Customer> {
  return fetchJson<Customer>(`/api/customers/${input.customerId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function logPurchase(input: LogPurchaseInput): Promise<Transaction> {
  return fetchJson<Transaction>(`/api/customers/${input.customerId}/purchase`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function redeemPoints(input: RedeemPointsInput): Promise<Transaction> {
  return fetchJson<Transaction>(
    `/api/customers/${input.customerId}/redeem-points`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function redeemVoucher(input: RedeemVoucherInput): Promise<Transaction> {
  return fetchJson<Transaction>(
    `/api/customers/${input.customerId}/redeem-voucher`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function redeemFreeDrinkVoucher(
  input: RedeemFreeDrinkVoucherInput
): Promise<Transaction> {
  return fetchJson<Transaction>(
    `/api/customers/${input.customerId}/redeem-free-drink-voucher`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function clearTransactionHistory(): Promise<void> {
  await fetchJson<{ ok: true }>("/api/transactions", { method: "DELETE" });
}

export interface StaffUser {
  id: string;
  username: string;
  name: string | null;
}

export async function loginStaff(username: string): Promise<StaffUser> {
  return fetchJson<StaffUser>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export async function logoutStaff(): Promise<void> {
  await fetchJson<{ ok: true }>("/api/auth/logout", { method: "POST" });
}

export async function fetchStaffSession(): Promise<StaffUser | null> {
  const response = await fetch("/api/auth/session");
  if (response.status === 401) return null;
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "Failed to load session");
  }
  return response.json() as Promise<StaffUser>;
}
