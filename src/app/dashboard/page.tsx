import { AppHeader } from "@/components/app-header";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default function DashboardPage() {
  return (
    <>
      <AppHeader active="dashboard" />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <DashboardContent />
      </main>
    </>
  );
}
