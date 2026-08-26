const PAYMONGO_API_BASE = "https://api.paymongo.com/v1";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function basicAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

function secretAuthHeader(): string {
  return basicAuthHeader(requireEnv("PAYMONGO_SECRET_KEY"));
}

function publicAuthHeader(): string {
  const publicKey = process.env.PAYMONGO_PUBLIC_KEY?.trim();
  if (publicKey) {
    return basicAuthHeader(publicKey);
  }
  return secretAuthHeader();
}

interface PaymongoErrorBody {
  errors?: Array<{ detail?: string; code?: string }>;
}

async function paymongoFetch<T>(
  path: string,
  options: {
    method: "GET" | "POST";
    auth: "secret" | "public";
    body?: unknown;
  }
): Promise<T> {
  const response = await fetch(`${PAYMONGO_API_BASE}${path}`, {
    method: options.method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization:
        options.auth === "secret" ? secretAuthHeader() : publicAuthHeader(),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const data = (await response.json()) as T & PaymongoErrorBody;
  if (!response.ok) {
    const detail =
      data.errors?.[0]?.detail ??
      `PayMongo request failed (${response.status}).`;
    throw new Error(detail);
  }
  return data;
}

export interface PaymongoPaymentIntent {
  id: string;
  clientKey: string;
}

export interface PaymongoPaymentMethod {
  id: string;
}

export interface PaymongoAttachResult {
  id: string;
  status: string;
  qrCodeUrl: string;
}

interface PaymentIntentResponse {
  data: {
    id: string;
    attributes: {
      client_key: string;
      status?: string;
      next_action?: {
        code?: {
          image_url?: string;
        };
      };
    };
  };
}

interface PaymentMethodResponse {
  data: {
    id: string;
  };
}

export async function createQrphPaymentIntent(input: {
  amountCentavos: number;
  description: string;
  pendingOrderId: string;
}): Promise<PaymongoPaymentIntent> {
  const response = await paymongoFetch<PaymentIntentResponse>(
    "/payment_intents",
    {
      method: "POST",
      auth: "secret",
      body: {
        data: {
          attributes: {
            amount: input.amountCentavos,
            currency: "PHP",
            payment_method_allowed: ["qrph"],
            description: input.description,
            metadata: {
              pending_order_id: input.pendingOrderId,
              order_id: input.pendingOrderId,
            },
          },
        },
      },
    }
  );

  return {
    id: response.data.id,
    clientKey: response.data.attributes.client_key,
  };
}

export async function createQrphPaymentMethod(): Promise<PaymongoPaymentMethod> {
  const response = await paymongoFetch<PaymentMethodResponse>(
    "/payment_methods",
    {
      method: "POST",
      auth: "public",
      body: {
        data: {
          attributes: {
            type: "qrph",
          },
        },
      },
    }
  );

  return { id: response.data.id };
}

export async function attachQrphPaymentIntent(input: {
  paymentIntentId: string;
  paymentMethodId: string;
  clientKey: string;
}): Promise<PaymongoAttachResult> {
  const response = await paymongoFetch<PaymentIntentResponse>(
    `/payment_intents/${input.paymentIntentId}/attach`,
    {
      method: "POST",
      auth: "public",
      body: {
        data: {
          attributes: {
            payment_method: input.paymentMethodId,
            client_key: input.clientKey,
          },
        },
      },
    }
  );

  const qrCodeUrl =
    response.data.attributes.next_action?.code?.image_url?.trim() ?? "";
  if (!qrCodeUrl) {
    throw new Error("PayMongo did not return a QR Ph image URL.");
  }

  return {
    id: response.data.id,
    status: response.data.attributes.status ?? "awaiting_next_action",
    qrCodeUrl,
  };
}

export async function retrievePaymentIntent(
  paymentIntentId: string
): Promise<{ id: string; status: string }> {
  const response = await paymongoFetch<PaymentIntentResponse>(
    `/payment_intents/${paymentIntentId}`,
    {
      method: "GET",
      auth: "secret",
    }
  );

  return {
    id: response.data.id,
    status: response.data.attributes.status ?? "unknown",
  };
}

export function pesosToCentavos(amountPesos: number): number {
  return amountPesos * 100;
}
