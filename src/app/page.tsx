import Link from "next/link";
import { ArrowRight, Gift, LogIn, Search, UserPlus, Users } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loyaltyConfig } from "@/config/loyalty";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <>
      <AppHeader active="home" />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-8 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- preserve logo alpha without image optimizer cache */}
              <img
                src="/coffeesentials-mark.png"
                alt="Coffeesentials"
                width={320}
                height={320}
                className="size-60 object-contain sm:size-72"
              />
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              {loyaltyConfig.programName}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Manage customer loyalty points, track coffee purchases, and let customers
              check their rewards — all in one place.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-emerald-600 hover:bg-emerald-700 text-white"
                )}
              >
                Staff Login
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/login?customer=1"
                className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
              >
                <LogIn className="size-4" />
                Member Login
              </Link>
              <Link
                href="/login?join=1"
                className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
              >
                <UserPlus className="size-4" />
                Join Now
              </Link>
            </div>
          </div>

          <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <Users className="mb-2 size-8 text-emerald-600" />
                <CardTitle>Customer Directory</CardTitle>
                <CardDescription>
                  View all registered customers with contact info and point balances.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Gift className="mb-2 size-8 text-emerald-600" />
                <CardTitle>Earn & Redeem</CardTitle>
                <CardDescription>
                  Log coffee drinks to award points or deduct when customers redeem rewards.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="sm:col-span-2 lg:col-span-1">
              <CardHeader>
                <Search className="mb-2 size-8 text-emerald-600" />
                <CardTitle>Customer Lookup</CardTitle>
                <CardDescription>
                  Staff can search members by name, phone, or email after signing
                  in.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </main>
    </>
  );
}
