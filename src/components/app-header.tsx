"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift, LogOut, Menu } from "lucide-react";
import { loyaltyConfig } from "@/config/loyalty";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  active?:
    | "home"
    | "dashboard"
    | "products"
    | "pending-orders"
    | "completed-orders"
    | "expenses"
    | "summary"
    | "lookup"
    | "login";
}

const staffLinks = [
  { href: "/dashboard", label: "Dashboard", key: "dashboard" as const },
  { href: "/products", label: "Products", key: "products" as const },
  { href: "/pending-orders", label: "Pending Orders", key: "pending-orders" as const },
  { href: "/completed-orders", label: "Completed Orders", key: "completed-orders" as const },
  { href: "/expenses", label: "Expenses", key: "expenses" as const },
  { href: "/summary", label: "Summary", key: "summary" as const },
  { href: "/lookup", label: "Customer Lookup", key: "lookup" as const },
];

export function AppHeader({ active }: AppHeaderProps) {
  const { isReady, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const showStaffNav =
    isReady &&
    isAuthenticated &&
    (active === "dashboard" ||
      active === "products" ||
      active === "pending-orders" ||
      active === "completed-orders" ||
      active === "expenses" ||
      active === "summary" ||
      active === "lookup");

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Gift className="size-4" />
          </span>
          <span className="truncate hidden sm:inline">{loyaltyConfig.programName}</span>
        </Link>

        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          {showStaffNav && (
            <div className="hidden md:flex items-center gap-1 sm:gap-2">
              {staffLinks.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  className={cn(
                    buttonVariants({
                      variant: active === link.key ? "secondary" : "ghost",
                      size: "sm",
                    })
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="size-4" />
                Logout
              </Button>
            </div>
          )}

          {showStaffNav && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="md:hidden"
                    aria-label="Open navigation menu"
                  />
                }
              >
                <Menu className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {staffLinks.map((link) => (
                  <DropdownMenuItem
                    key={link.key}
                    render={<Link href={link.href} className="w-full" />}
                    className={cn(active === link.key && "bg-accent")}
                  >
                    {link.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <LogOut className="size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
