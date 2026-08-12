import { AppHeader } from "@/components/app-header";
import { ExpensesContent } from "@/components/expenses/expenses-content";

export default function ExpensesPage() {
  return (
    <>
      <AppHeader active="expenses" />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <ExpensesContent />
      </main>
    </>
  );
}
