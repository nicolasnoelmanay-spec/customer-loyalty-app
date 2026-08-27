"use client";

import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function isMemberWebViewApp(): boolean {
  if (typeof navigator === "undefined") return false;
  return /CoffeesentialsCustomerApp/i.test(navigator.userAgent);
}

export function PrivacyBackToRegistration() {
  const router = useRouter();

  function handleBack() {
    // window.close() only works for script-opened popups — Android WebView
    // opens /privacy in the same WebView, so close() is a no-op.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    const params = new URLSearchParams({ join: "1" });
    if (isMemberWebViewApp()) {
      params.set("customer", "1");
      params.set("app", "member");
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
