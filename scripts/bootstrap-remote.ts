// Creates tables + admin on the remote Postgres (same DB as production).
// Requires DATABASE_URL in .env or environment — must be postgresql://...
//
//   npm run bootstrap:remote
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { assertRemoteDatabaseUrl } from "../src/lib/database-url";
import { runSeed } from "../src/lib/seed-data";

async function main() {
  const url = assertRemoteDatabaseUrl();
  console.log("Using remote Postgres:", url.replace(/:[^:@/]+@/, ":****@"));

  console.log("Applying schema (prisma db push)...");
  execSync("npx prisma db push", { stdio: "inherit", env: process.env });

  console.log("Seeding admin + demo patients...");
  const db = new PrismaClient();
  try {
    const result = await runSeed(db);
    if (result.patientsSkipped) {
      console.log(
        `${result.adminCreated ? "Created" : "Admin ready"}: ${result.adminEmail} / ${result.defaultPassword}` +
          " — patients already exist."
      );
    } else {
      console.log(`Done: ${result.adminEmail} / ${result.defaultPassword} + ${result.patientsSeeded} demo patients.`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
