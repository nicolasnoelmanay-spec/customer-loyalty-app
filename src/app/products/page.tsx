import { AppHeader } from "@/components/app-header";
import { ProductsContent } from "@/components/products/products-content";

export default function ProductsPage() {
  return (
    <>
      <AppHeader active="products" />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <ProductsContent />
      </main>
    </>
  );
}
