import type {
  CreateQrphCheckoutInput,
  CreateQrphCheckoutResult,
  QrphOrderPaymentStatus,
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

export async function apiCreateQrphCheckout(
  input: CreateQrphCheckoutInput
): Promise<CreateQrphCheckoutResult> {
  const response = await fetch("/api/checkout/qrph", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson(response);
}

export async function fetchOrderPaymentStatus(
  orderId: string
): Promise<QrphOrderPaymentStatus> {
  const response = await fetch(`/api/orders/${orderId}/status`, {
    credentials: "include",
  });
  return parseJson(response);
}
