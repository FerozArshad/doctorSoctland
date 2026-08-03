/**
 * Verify patient-scoped admin email routing.
 * Usage: node --env-file=.env scripts/verify-admin-email-routing.mjs
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function addValidEmail(set, email) {
  const e = (email || "").trim().toLowerCase();
  if (/.+@.+\..+/.test(e)) set.add(e);
}

async function patientAdminNotifyEmails(patient) {
  const recipients = new Set();
  const sentBy = (patient.sentByEmail || "").trim();
  if (sentBy) addValidEmail(recipients, sentBy);

  if (patient.ownerId) {
    const owner = await db.admin.findUnique({ where: { id: patient.ownerId }, select: { email: true } });
    addValidEmail(recipients, owner?.email);
  }

  if (recipients.size === 0) {
    const supers = await db.admin.findMany({ where: { isSuperAdmin: true }, select: { email: true } });
    for (const a of supers) addValidEmail(recipients, a.email);
    addValidEmail(recipients, process.env.ADMIN_NOTIFY_EMAIL);
  }

  return Array.from(recipients);
}

async function main() {
  const admins = await db.admin.findMany({ select: { id: true, name: true, email: true, isSuperAdmin: true } });
  console.log("Admins:");
  for (const a of admins) {
    console.log(`  - ${a.name} <${a.email}>${a.isSuperAdmin ? " [super]" : ""}`);
  }
  console.log("");

  const patients = await db.patient.findMany({
    take: 20,
    orderBy: { updatedAt: "desc" },
    select: { id: true, firstName: true, lastName: true, sentByEmail: true, ownerId: true, status: true },
  });

  if (patients.length === 0) {
    console.log("No patients in DB — routing logic is ready but nothing to sample.");
    return;
  }

  console.log("Sample patient → admin email routing:");
  for (const p of patients) {
    const recipients = await patientAdminNotifyEmails(p);
    const label = `${p.firstName} ${p.lastName}`.trim();
    console.log(`  ${label} (${p.status})`);
    console.log(`    sentBy: ${p.sentByEmail || "(none)"}  ownerId: ${p.ownerId || "(none)"}`);
    console.log(`    → ${recipients.join(", ") || "(no recipients)"}`);
  }

  // Cross-check: each non-super admin should only appear for their own patients
  const leaks = [];
  for (const admin of admins.filter((a) => !a.isSuperAdmin)) {
    for (const p of patients) {
      const recipients = await patientAdminNotifyEmails(p);
      const isAssigned = p.sentByEmail === admin.email || p.ownerId === admin.id;
      if (!isAssigned && recipients.includes(admin.email.toLowerCase())) {
        leaks.push({ admin: admin.email, patient: `${p.firstName} ${p.lastName}` });
      }
    }
  }

  console.log("");
  if (leaks.length === 0) {
    console.log("OK — no cross-admin leakage in sample.");
  } else {
    console.log("LEAKS detected:");
    for (const l of leaks) console.log(`  ${l.admin} would get mail for ${l.patient}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
