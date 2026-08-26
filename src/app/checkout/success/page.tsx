import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CheckoutSuccessPageProps {
  searchParams: Promise<{ orderId?: string }>;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  const params = await searchParams;
  const orderId = params.orderId?.trim() ?? "";

  return (
    <>
      <AppHeader active="pending-orders" />
      <main className="mx-auto max-w-lg flex-1 px-4 py-10 sm:px-6">
        <Card>
          <CardHeader className="items-center text-center">
            <CheckCircle2 className="mb-2 size-12 text-emerald-600" />
            <CardTitle>QR Ph payment received</CardTitle>
            <CardDescription>
              Payment is marked paid. The order stays in Pending Orders until
              staff taps Complete.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            {orderId ? (
              <p className="text-sm text-muted-foreground">
                Order ID:{" "}
                <span className="font-medium text-foreground">{orderId}</span>
              </p>
            ) : null}
            <Link
              href="/pending-orders"
              className={cn(
                buttonVariants({
                  className: "bg-emerald-600 hover:bg-emerald-700 text-white",
                })
              )}
            >
              Back to Pending Orders
            </Link>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
