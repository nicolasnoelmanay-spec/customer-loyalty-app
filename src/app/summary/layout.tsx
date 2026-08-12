import { AuthGuard } from "@/components/auth-guard";

export default function SummaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
