import { AppHeader } from "@/components/app-header";
import { CustomerAccountPage } from "@/components/customer/customer-account-page";

export default function CustomerPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <CustomerAccountPage />
      </main>
    </>
  );
}
