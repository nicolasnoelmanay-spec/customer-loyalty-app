import { AuthGuard } from "@/components/auth-guard";

export default function CompletedOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
