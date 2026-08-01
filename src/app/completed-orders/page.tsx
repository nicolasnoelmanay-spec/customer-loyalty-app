import { AppHeader } from "@/components/app-header";
import { CompletedOrdersContent } from "@/components/completed-orders/completed-orders-content";

export default function CompletedOrdersPage() {
  return (
    <>
      <AppHeader active="completed-orders" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <CompletedOrdersContent />
      </main>
    </>
  );
}
