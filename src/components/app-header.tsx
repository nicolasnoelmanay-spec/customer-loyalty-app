"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift, LogOut } from "lucide-react";
import { loyaltyConfig } from "@/config/loyalty";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  active?: "home" | "dashboard" | "products" | "lookup" | "login";
}

export function AppHeader({ active }: AppHeaderProps) {
  const { isReady, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const dashboardHref =
    isReady && isAuthenticated ? "/dashboard" : "/login";

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Gift className="size-4" />
          </span>
          <span className="hidden sm:inline">{loyaltyConfig.programName}</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href={dashboardHref}
            className={cn(
              buttonVariants({
                variant:
                  active === "dashboard" || active === "login"
                    ? "secondary"
                    : "ghost",
                size: "sm",
              })
            )}
          >
            Dashboard
          </Link>
          {isReady && isAuthenticated && (
            <Link
              href="/products"
              className={cn(
                buttonVariants({
                  variant: active === "products" ? "secondary" : "ghost",
                  size: "sm",
                })
              )}
            >
              Products
            </Link>
          )}
          <Link
            href="/lookup"
            className={cn(
              buttonVariants({
                variant: active === "lookup" ? "secondary" : "ghost",
                size: "sm",
              })
            )}
          >
            Customer Lookup
          </Link>
          {isReady && isAuthenticated && (active === "dashboard" || active === "products") && (
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="size-4" />
              Logout
            </Button>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
