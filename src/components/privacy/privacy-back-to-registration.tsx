"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function isMemberWebViewApp(): boolean {
  if (typeof navigator === "undefined") return false;
  return /CoffeesentialsCustomerApp/i.test(navigator.userAgent);
}

function PrivacyBackToRegistrationButton() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleBack() {
    // Always navigate explicitly — history.back() often returns to /login without
    // join=1, which opens the Member tab instead of registration (esp. in the app).
    const params = new URLSearchParams({ join: "1" });
    if (searchParams.get("app") === "member" || isMemberWebViewApp()) {
      params.set("app", "member");
      params.set("customer", "1");
    }
    router.push(`/login?${params.toString()}`);
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={cn(buttonVariants({ variant: "outline" }))}
    >
      Back to registration
    </button>
  );
}

export function PrivacyBackToRegistration() {
  return (
    <Suspense
      fallback={
        <span
          className={cn(
            buttonVariants({ variant: "outline" }),
            "pointer-events-none opacity-60"
          )}
        >
          Back to registration
        </span>
      }
    >
      <PrivacyBackToRegistrationButton />
    </Suspense>
  );
}
