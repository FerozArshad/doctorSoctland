// Change the admin password from the terminal:
//   npm run admin:password -- newSecurePassword123
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const password = process.argv[2];
  if (!password || password.length < 8) {
    console.error("Usage: npm run admin:password -- <new password (8+ chars)>");
    process.exit(1);
  }
  const admin = await db.admin.findFirst();
  if (!admin) {
    console.error("No admin account found — run `npm run db:seed` first.");
    process.exit(1);
  }
  await db.admin.update({
    where: { id: admin.id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`Password updated for ${admin.email}. Use it at /admin/login.`);
}

main().finally(() => db.$disconnect());
