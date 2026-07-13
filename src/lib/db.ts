import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "./database-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    // Resolve from DATABASE_URL or the Supabase-provided POSTGRES_* fallbacks,
    // so production connects even when only the integration's vars are set.
    globalForPrisma.prisma = new PrismaClient({ datasources: { db: { url: resolveDatabaseUrl() } } });
  }
  return globalForPrisma.prisma;
}

/** Lazy singleton — avoids Prisma init during Next.js build when routes are analysed. */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
