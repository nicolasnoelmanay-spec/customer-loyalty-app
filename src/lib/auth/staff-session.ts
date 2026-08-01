import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

export const STAFF_SESSION_COOKIE = "loyalty-staff-id";

export interface StaffSession {
  id: string;
  username: string;
  name: string | null;
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const cookieStore = await cookies();
  const staffId = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  if (!staffId) return null;

  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { id: true, username: true, name: true },
  });

  return staff ?? null;
}

export async function requireStaffSession(): Promise<StaffSession> {
  const staff = await getStaffSession();
  if (!staff) {
    throw new Error("Unauthorized");
  }
  return staff;
}

export async function setStaffSession(staffId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(STAFF_SESSION_COOKIE, staffId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearStaffSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_SESSION_COOKIE);
}
