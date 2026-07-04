import { PrismaClient } from "@prisma/client";
import { runSeed } from "../src/lib/seed-data";

const db = new PrismaClient();

async function main() {
  const result = await runSeed(db);
  if (result.patientsSkipped) {
    console.log(
      `${result.adminCreated ? "Created" : "Admin ready"}: ${result.adminEmail} / ${result.defaultPassword}` +
        " — patients already exist, skipped demo seed."
    );
    return;
  }
  console.log(`Seeded ${result.adminEmail} / ${result.defaultPassword} + ${result.patientsSeeded} demo patients.`);
}

main().finally(() => db.$disconnect());
