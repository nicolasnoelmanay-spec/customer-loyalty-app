import { AuthGuard } from "@/components/auth-guard";

export default function PendingOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
