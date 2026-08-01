import { AuthGuard } from "@/components/auth-guard";

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
