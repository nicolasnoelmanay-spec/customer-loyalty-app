import { AppHeader } from "@/components/app-header";
import { PendingOrdersContent } from "@/components/pending-orders/pending-orders-content";

export default function PendingOrdersPage() {
  return (
    <>
      <AppHeader active="pending-orders" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <PendingOrdersContent />
      </main>
    </>
  );
}
