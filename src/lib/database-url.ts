/** Ensures we only connect to remote Postgres — never a local SQLite file. */
export function assertRemoteDatabaseUrl(url = process.env.DATABASE_URL): string {
  if (!url?.trim()) {
    throw new Error(
      "DATABASE_URL is not set. Copy the Production value from Vercel → Settings → Environment Variables into .env"
    );
  }
  if (url.startsWith("file:") || url.includes("dev.db")) {
    throw new Error(
      "Local SQLite is disabled. Set DATABASE_URL to your remote Postgres URL from Vercel (same DB as production)."
    );
  }
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection string (postgresql://...).");
  }
  return url;
}
