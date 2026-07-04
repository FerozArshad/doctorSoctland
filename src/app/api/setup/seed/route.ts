// One-time production bootstrap: creates admin + demo patients on the live database.
// Uses the same DATABASE_URL as the deployed app (remote Postgres on Vercel).
//
//   curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://dashboard.dentalscotland.com/api/setup/seed
import { NextRequest, NextResponse } from "next/server";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { runSeed } from "@/lib/seed-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.startsWith("change-me") || secret.startsWith("dev-cron") || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  try {
    execSync("npx prisma db push --skip-generate", {
      stdio: "pipe",
      env: process.env,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "schema push failed", detail }, { status: 500 });
  }

  const db = new PrismaClient();
  try {
    const result = await runSeed(db);
    return NextResponse.json({
      ok: true,
      message: result.patientsSkipped
        ? `Admin ready at ${result.adminEmail} (password: ${result.defaultPassword}). Demo patients skipped — already in database.`
        : `Seeded ${result.adminEmail} / ${result.defaultPassword} + ${result.patientsSeeded} demo patients.`,
      ...result,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "seed failed", detail }, { status: 500 });
  } finally {
    await db.$disconnect();
  }
}
