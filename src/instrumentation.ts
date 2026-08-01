export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureDatabaseInitialized } = await import(
      "@/lib/db/initialize-database"
    );
    await ensureDatabaseInitialized();
  }
}
