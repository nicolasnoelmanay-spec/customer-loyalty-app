"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PrivacyBackToRegistration() {
  function handleClose() {
    window.close();
  }

  return (
    <button
      type="button"
      onClick={handleClose}
      className={cn(buttonVariants({ variant: "outline" }))}
    >
      Back to registration
    </button>
  );
}
