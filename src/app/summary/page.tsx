import { AppHeader } from "@/components/app-header";
import { SummaryContent } from "@/components/summary/summary-content";

export default function SummaryPage() {
  return (
    <>
      <AppHeader active="summary" />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <SummaryContent />
      </main>
    </>
  );
}
