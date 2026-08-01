"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { useAuth } from "@/hooks/use-auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isReady, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isReady, isAuthenticated, router]);

  if (!isReady) {
    return (
      <div className="mx-auto max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <DashboardSkeleton />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return children;
}
