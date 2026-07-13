import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

function priceFor(c: number) {
  if (c <= 7) return 150_000;
  if (c <= 20) return 225_000;
  return 275_000;
}

const H = 3_600_000;
const D = 86_400_000;
const now = Date.now();
const ago = (ms: number) => new Date(now - ms);

export type SeedResult = {
  adminEmail: string;
  adminCreated: boolean;
  patientsSeeded: number;
  patientsSkipped: boolean;
  defaultPassword: string;
};

export async function runSeed(db: PrismaClient): Promise<SeedResult> {
  const existingAdmin = await db.admin.findUnique({ where: { email: "concierge@dentalscotland.com" } });

  await db.admin.upsert({
    where: { email: "concierge@dentalscotland.com" },
    update: {},
    create: {
      email: "concierge@dentalscotland.com",
      passwordHash: await bcrypt.hash("dental123", 10),
      name: "Dr. Rhona Sinclair",
      role: "Treatment Coordinator",
    },
  });

  const patientCount = await db.patient.count();
  if (patientCount > 0) {
    return {
      adminEmail: "concierge@dentalscotland.com",
      adminCreated: !existingAdmin,
      patientsSeeded: 0,
      patientsSkipped: true,
      defaultPassword: "dental123",
    };
  }

  const patients: Array<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    alignerCount: number;
    pkg: string;
    status: string;
    amountPaidPence: number;
    notes: string;
    activity: Array<[number, string]>;
    paidAgoMs?: number;
    paymentType?: string;
  }> = [
    { firstName: "Emma", lastName: "MacLeod", email: "emma.macleod@gmail.com", phone: "07700 900123", alignerCount: 26, pkg: "Go", status: "paid", amountPaidPence: 261_200, notes: "Keen to start before autumn wedding.", activity: [[2 * H, "Paid in full via secure link — £2,612"], [2 * D, "Opened proposal email"], [3 * D, "Proposal emailed"], [15 * D, "Draft proposal created"]], paidAgoMs: 2 * H, paymentType: "full" },
    { firstName: "Callum", lastName: "Fraser", email: "callum.fraser@outlook.com", phone: "07700 900456", alignerCount: 15, pkg: "Go", status: "deposit", amountPaidPence: 70_000, notes: "", activity: [[6 * H, "£700 deposit received"], [1 * D, "Confirmed interest"], [4 * D, "Proposal emailed"]], paidAgoMs: 6 * H, paymentType: "deposit" },
    { firstName: "Sophie", lastName: "Brown", email: "sophie.b@gmail.com", phone: "07700 900789", alignerCount: 18, pkg: "Go", status: "awaiting", amountPaidPence: 0, notes: "Comparing finance options.", activity: [[8 * H, "Selected 0% finance — awaiting payment"], [2 * D, "Proposal emailed"]] },
    { firstName: "Aiden", lastName: "Ross", email: "aiden.ross@icloud.com", phone: "07700 900222", alignerCount: 12, pkg: "Go", status: "overdue", amountPaidPence: 0, notes: "Follow up — no reply for 10 days.", activity: [[11 * D, "Proposal emailed"], [14 * D, "Draft proposal created"]] },
    { firstName: "Isla", lastName: "Campbell", email: "isla.campbell@gmail.com", phone: "07700 900333", alignerCount: 20, pkg: "Go", status: "interested", amountPaidPence: 0, notes: "Wants a follow-up call.", activity: [[5 * H, "Replied “I’M INTERESTED”"], [1 * D, "Proposal emailed"]] },
    { firstName: "Jack", lastName: "Wilson", email: "jack.wilson@gmail.com", phone: "07700 900444", alignerCount: 6, pkg: "Express", status: "sent", amountPaidPence: 0, notes: "", activity: [[3 * H, "Proposal emailed"]] },
    { firstName: "Grace", lastName: "Stewart", email: "grace.stewart@gmail.com", phone: "07700 900555", alignerCount: 14, pkg: "Go", status: "draft", amountPaidPence: 0, notes: "ClinCheck approved, ready to send.", activity: [[30 * 60_000, "Draft proposal created"]] },
    { firstName: "Liam", lastName: "Murray", email: "liam.murray@outlook.com", phone: "07700 900666", alignerCount: 9, pkg: "Go", status: "paid", amountPaidPence: 213_800, notes: "", activity: [[2 * D, "Paid in full — £2,138"], [5 * D, "Proposal emailed"]], paidAgoMs: 2 * D, paymentType: "full" },
    { firstName: "Ava", lastName: "Docherty", email: "ava.d@gmail.com", phone: "07700 900777", alignerCount: 30, pkg: "Go", status: "sent", amountPaidPence: 0, notes: "", activity: [[20 * H, "Proposal emailed"]] },
  ];

  const demoPassword = await bcrypt.hash("dental123", 10);

  for (const p of patients) {
    const slug = (p.firstName + "-" + p.lastName).toLowerCase();
    await db.patient.create({
      data: {
        passwordHash: demoPassword,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        alignerCount: p.alignerCount,
        pkg: p.pkg,
        status: p.status,
        amountPaidPence: p.amountPaidPence,
        pricePence: priceFor(p.alignerCount),
        notes: p.notes,
        videoUrl: `https://clincheck.invisalign.com/${slug}`,
        activities: {
          create: p.activity.map(([ms, text]) => ({ text, createdAt: ago(ms) })),
        },
        payments: p.paidAgoMs
          ? {
              create: [
                {
                  amountPence: p.amountPaidPence,
                  type: p.paymentType || "manual",
                  status: "paid",
                  paidAt: ago(p.paidAgoMs),
                },
              ],
            }
          : undefined,
      },
    });
  }

  return {
    adminEmail: "concierge@dentalscotland.com",
    adminCreated: !existingAdmin,
    patientsSeeded: patients.length,
    patientsSkipped: false,
    defaultPassword: "dental123",
  };
}
