import { loyaltyConfig } from "@/config/loyalty";

const SENDWITH_API_URL = "https://api.sendwith.email/api/send";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

interface EmailAddress {
  email: string;
  name?: string;
}

interface SendWithMessage {
  to: EmailAddress[];
  from: EmailAddress;
  subject: string;
  body: string;
  HTMLbody?: string;
  replyTo?: EmailAddress;
}

function getApiKey(): string {
  const apiKey = process.env.SENDWITH_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("SENDWITH_API_KEY is not configured.");
  }

  return apiKey;
}

function parseEmailAddress(value: string): EmailAddress {
  const match = value.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }

  return { email: value.trim() };
}

function getFromAddress(): EmailAddress {
  const from = process.env.SENDWITH_FROM?.trim();
  if (from) return parseEmailAddress(from);

  const { fromName, fromAddress } = loyaltyConfig.email;
  return { email: fromAddress, name: fromName };
}

function normalizeRecipients(to: string | string[]): EmailAddress[] {
  const recipients = (Array.isArray(to) ? to : [to])
    .map((address) => address.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    throw new Error("At least one recipient email is required.");
  }

  for (const address of recipients) {
    if (!address.includes("@")) {
      throw new Error(`Invalid recipient email: ${address}`);
    }
  }

  return recipients.map((email) => ({ email }));
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildMessage(input: SendEmailInput): SendWithMessage {
  const subject = input.subject.trim();
  const html = input.html?.trim();
  const text = input.text?.trim();
  const replyTo = input.replyTo?.trim();

  if (!subject) {
    throw new Error("Email subject is required.");
  }

  const body = text || (html ? stripHtml(html) : "");
  if (!body) {
    throw new Error("Email html or text content is required.");
  }

  const message: SendWithMessage = {
    to: normalizeRecipients(input.to),
    from: getFromAddress(),
    subject,
    body,
  };

  if (html) {
    message.HTMLbody = html;
  }

  if (replyTo) {
    message.replyTo = parseEmailAddress(replyTo);
  }

  return message;
}

function extractMessageId(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "sent";
  }

  const data = payload as Record<string, unknown>;
  for (const key of ["id", "messageId", "message_id", "receipt_id"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "sent";
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  const response = await fetch(SENDWITH_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: buildMessage(input) }),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorMessage =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : payload &&
            typeof payload === "object" &&
            "message" in payload &&
            typeof (payload as { message?: unknown }).message === "string"
          ? (payload as { message: string }).message
          : `Failed to send email (${response.status}).`;

    throw new Error(errorMessage);
  }

  return { id: extractMessageId(payload) };
}
