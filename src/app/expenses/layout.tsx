import { AuthGuard } from "@/components/auth-guard";

export default function ExpensesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
