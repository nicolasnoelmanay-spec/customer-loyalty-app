"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function isMemberWebViewApp(): boolean {
  if (typeof navigator === "undefined") return false;
  return /CoffeesentialsCustomerApp/i.test(navigator.userAgent);
}

function registrationHref(searchParams: URLSearchParams): string {
  const params = new URLSearchParams({ join: "1" });
  if (searchParams.get("app") === "member" || isMemberWebViewApp()) {
    params.set("app", "member");
  }
  return `/login?${params.toString()}`;
}

function PrivacyBackToRegistrationButton() {
  const searchParams = useSearchParams();

  function handleBack() {
    if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    const href = registrationHref(searchParams);
    // Hard navigation so Android WebView always reloads /login?join=1 (Join tab).
    // Soft client routing was racing with member-app defaults that open Member login.
    window.location.assign(href);
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
