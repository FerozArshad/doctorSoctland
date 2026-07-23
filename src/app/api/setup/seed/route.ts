// One-time production bootstrap: creates admin + demo patients on the live database.
// Disabled in production unless ALLOW_PRODUCTION_SEED=1 (and CRON_SECRET).
//
//   curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://…/api/setup/seed
import { NextRequest, NextResponse } from "next/server";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { runSeed } from "@/lib/seed-data";
import { bearerMatches } from "@/lib/secure";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "1") {
    log.warn("seed.blocked", { reason: "production_seed_disabled" });
    return NextResponse.json({ error: "seed disabled in production" }, { status: 403 });
  }

  if (!bearerMatches(req.headers.get("authorization"), process.env.CRON_SECRET)) {
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
    // Never echo passwords in HTTP responses.
    log.info("seed.ok", {
      adminEmail: result.adminEmail,
      patientsSeeded: result.patientsSeeded,
      patientsSkipped: result.patientsSkipped,
    });
    return NextResponse.json({
      ok: true,
      adminEmail: result.adminEmail,
      patientsSeeded: result.patientsSeeded,
      patientsSkipped: result.patientsSkipped,
      message: result.patientsSkipped
        ? `Admin ready at ${result.adminEmail}. Demo patients skipped — already in database.`
        : `Seeded admin ${result.adminEmail} + ${result.patientsSeeded} demo patients.`,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "seed failed", detail }, { status: 500 });
  } finally {
    await db.$disconnect();
  }
}
