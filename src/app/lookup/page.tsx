import { AppHeader } from "@/components/app-header";
import { CustomerLookupForm } from "@/components/lookup/customer-lookup-form";

export default function LookupPage() {
  return (
    <>
      <AppHeader active="lookup" />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <CustomerLookupForm />
      </main>
    </>
  );
}
