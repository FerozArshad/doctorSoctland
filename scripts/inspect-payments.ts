import { readFileSync } from "fs";
import { resolve } from "path";

for (const line of readFileSync(resolve(process.cwd(), ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[m[1]] = v;
}

async function main() {
  const { db } = await import("../src/lib/db");
  const payments = await db.payment.findMany({
    select: { status: true, stripeSessionId: true, type: true, amountPence: true, patientId: true },
    orderBy: { createdAt: "desc" },
  });
  const patients = await db.patient.findMany({
    select: { id: true, firstName: true, lastName: true, status: true, stripeCustomerId: true },
    orderBy: { updatedAt: "desc" },
  });
  console.log(
    "Payments:",
    payments.map((p) => ({
      status: p.status,
      session: p.stripeSessionId?.slice(0, 12) ?? null,
      type: p.type,
      amount: p.amountPence,
    }))
  );
  console.log(
    "Patients with Stripe customer:",
    patients
      .filter((p) => p.stripeCustomerId)
      .map((p) => ({ name: `${p.firstName} ${p.lastName}`, status: p.status, customer: p.stripeCustomerId?.slice(0, 12) }))
  );
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
