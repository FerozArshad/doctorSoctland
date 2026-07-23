import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export type SeedResult = {
  adminEmail: string;
  adminCreated: boolean;
  patientsSeeded: number;
  patientsSkipped: boolean;
  defaultPassword: string;
};

/** Seeds the Super Admin account only — no demo patients. */
export async function runSeed(db: PrismaClient): Promise<SeedResult> {
  const existingAdmin = await db.admin.findUnique({ where: { email: "concierge@dentalscotland.com" } });

  await db.admin.upsert({
    where: { email: "concierge@dentalscotland.com" },
    update: { name: "M. Arfan" },
    create: {
      email: "concierge@dentalscotland.com",
      passwordHash: await bcrypt.hash("dental123", 10),
      name: "M. Arfan",
      role: "Super Admin",
      isSuperAdmin: true,
    },
  });

  return {
    adminEmail: "concierge@dentalscotland.com",
    adminCreated: !existingAdmin,
    patientsSeeded: 0,
    patientsSkipped: true,
    defaultPassword: "dental123",
  };
}
