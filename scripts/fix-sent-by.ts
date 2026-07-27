// Fix patients where owner is a coordinator but sentBy was saved as practice fallback.
import { readFileSync } from "fs";
import { resolve } from "path";
import { COORDINATORS, FALLBACK_COORDINATOR } from "../src/lib/coordinators";

for (const line of readFileSync(resolve(process.cwd(), ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[m[1]] = v;
}

async function main() {
  const { db } = await import("../src/lib/db");
  const patients = await db.patient.findMany({
    where: { status: { not: "draft" } },
    include: { owner: true },
  });

  let fixed = 0;
  for (const p of patients) {
    const ownerCo = p.owner ? COORDINATORS.find((c) => c.email === p.owner!.email) : null;
    const wrongSender =
      !p.sentByEmail ||
      p.sentByEmail === FALLBACK_COORDINATOR.email ||
      p.sentByName === FALLBACK_COORDINATOR.name;
    if (!ownerCo || !wrongSender) continue;

    await db.patient.update({
      where: { id: p.id },
      data: { sentByName: ownerCo.name, sentByEmail: ownerCo.email },
    });
    console.log("Fixed", p.firstName, p.lastName, "→", ownerCo.name);
    fixed++;
  }

  // Allison Geddes: activity shows Rochelle even if owner mismatch
  const allison = await db.patient.findFirst({
    where: { firstName: { equals: "Allison", mode: "insensitive" }, lastName: { equals: "Geddes", mode: "insensitive" } },
  });
  if (allison) {
    const rochelle = COORDINATORS.find((c) => c.key === "rochelle")!;
    if (allison.sentByEmail !== rochelle.email) {
      const admin = await db.admin.findFirst({ where: { email: rochelle.email } });
      await db.patient.update({
        where: { id: allison.id },
        data: {
          sentByName: rochelle.name,
          sentByEmail: rochelle.email,
          ...(admin ? { ownerId: admin.id } : {}),
        },
      });
      console.log("Fixed Allison Geddes → Rochelle Copland");
      fixed++;
    }
  }

  console.log("Done. Fixed", fixed, "patient(s).");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
