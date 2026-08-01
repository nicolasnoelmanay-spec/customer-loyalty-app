import type { Customer, Transaction } from "@/types";

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Request failed."
    );
  }
  return data as T;
}

export async function apiCustomerLogin(
  username: string,
  password: string
): Promise<Customer> {
  const response = await fetch("/api/customer-auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await parseJson<{ customer: Customer }>(response);
  return data.customer;
}

export async function apiCustomerLogout(): Promise<void> {
  const response = await fetch("/api/customer-auth/logout", {
    method: "POST",
    credentials: "include",
  });
  await parseJson(response);
}

export async function apiGetCustomerSession(): Promise<boolean> {
  const response = await fetch("/api/customer-auth/session", {
    credentials: "include",
  });
  const data = await parseJson<{ authenticated: boolean }>(response);
  return data.authenticated;
}

export async function apiGetCustomerAccount(): Promise<{
  customer: Customer;
  transactions: Transaction[];
}> {
  const response = await fetch("/api/customer-auth/me", {
    credentials: "include",
  });
  return parseJson(response);
}
