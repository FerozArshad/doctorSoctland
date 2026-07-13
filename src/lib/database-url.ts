/** Ensures we only connect to remote Postgres — never a local SQLite file. */
export function assertRemoteDatabaseUrl(url = process.env.DATABASE_URL): string {
  if (!url?.trim()) {
    throw new Error(
      "No database URL found. Set DATABASE_URL (or the Supabase-provided " +
        "POSTGRES_PRISMA_URL / POSTGRES_URL) in your environment."
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

// Resolve the Postgres URL from the app's own var first, then the names the
// Supabase↔Vercel integration provisions automatically. This lets production
// work when only POSTGRES_* are present (the integration never creates a var
// literally named DATABASE_URL) without hand-adding anything.
export function resolveDatabaseUrl(): string {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    "";
  return normalizePooler(assertRemoteDatabaseUrl(raw));
}

// Supabase's transaction pooler (port 6543) needs pgbouncer=true so Prisma
// disables prepared statements; add it if a pooled URL arrives without it.
function normalizePooler(url: string): string {
  if (url.includes("pooler.supabase.com:6543") && !/[?&]pgbouncer=true/.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "pgbouncer=true";
  }
  return url;
}
