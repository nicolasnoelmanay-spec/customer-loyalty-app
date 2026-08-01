import { cookies } from "next/headers";
import { getSql } from "@/lib/db";

const SESSION_COOKIE = "loyalty-customer-session";
const SESSION_DAYS = 30;

export async function createCustomerSession(customerId: string): Promise<string> {
  const sessionId = `csess-${crypto.randomUUID()}`;
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const sql = getSql();
  await sql`
    INSERT INTO customer_sessions (id, customer_id, expires_at)
    VALUES (${sessionId}, ${customerId}, ${expiresAt})
  `;
  return sessionId;
}

export async function getCustomerSession(): Promise<{ customerId: string } | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const sql = getSql();
  const rows = await sql`
    SELECT customer_id
    FROM customer_sessions
    WHERE id = ${sessionId} AND expires_at > NOW()
  `;

  if (rows.length === 0) return null;
  return { customerId: rows[0].customer_id as string };
}

export async function setCustomerSessionCookie(sessionId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearCustomerSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    const sql = getSql();
    await sql`DELETE FROM customer_sessions WHERE id = ${sessionId}`;
  }
  cookieStore.delete(SESSION_COOKIE);
}
