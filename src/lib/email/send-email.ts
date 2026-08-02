import { Resend } from "resend";
import { loyaltyConfig } from "@/config/loyalty";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

function getFromAddress(): string {
  const from = process.env.RESEND_FROM?.trim();
  if (from) return from;

  const { fromName, fromAddress } = loyaltyConfig.email;
  return `${fromName} <${fromAddress}>`;
}

function normalizeRecipients(to: string | string[]): string[] {
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

  return recipients;
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string }> {
  const subject = input.subject.trim();
  const html = input.html?.trim();
  const text = input.text?.trim();
  const replyTo = input.replyTo?.trim();

  if (!subject) {
    throw new Error("Email subject is required.");
  }

  if (!html && !text) {
    throw new Error("Email html or text content is required.");
  }

  const resend = getResendClient();
  const recipients = normalizeRecipients(input.to);
  const from = getFromAddress();
  const base = {
    from,
    to: recipients,
    subject,
    ...(replyTo ? { replyTo } : {}),
  };

  const { data, error } = html
    ? await resend.emails.send({ ...base, html })
    : await resend.emails.send({ ...base, text: text! });

  if (error) {
    throw new Error(error.message || "Failed to send email.");
  }

  if (!data?.id) {
    throw new Error("Failed to send email.");
  }

  return { id: data.id };
}
