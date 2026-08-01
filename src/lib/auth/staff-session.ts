import { cookies } from "next/headers";
import { getSql } from "@/lib/db";

const SESSION_COOKIE = "loyalty-staff-session";
const SESSION_DAYS = 7;

export async function createStaffSession(staffId: string): Promise<string> {
  const sessionId = `sess-${crypto.randomUUID()}`;
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const sql = getSql();
  await sql`
    INSERT INTO staff_sessions (id, staff_id, expires_at)
    VALUES (${sessionId}, ${staffId}, ${expiresAt})
  `;
  return sessionId;
}

export async function getStaffSession(): Promise<{ staffId: string } | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const sql = getSql();
  const rows = await sql`
    SELECT staff_id
    FROM staff_sessions
    WHERE id = ${sessionId} AND expires_at > NOW()
  `;

  if (rows.length === 0) return null;
  return { staffId: rows[0].staff_id as string };
}

export async function setSessionCookie(sessionId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearStaffSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    const sql = getSql();
    await sql`DELETE FROM staff_sessions WHERE id = ${sessionId}`;
  }
  cookieStore.delete(SESSION_COOKIE);
}
