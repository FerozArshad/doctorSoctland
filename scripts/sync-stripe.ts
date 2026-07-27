// One-off Stripe → dashboard sync. Run: npx tsx --env-file=.env scripts/sync-stripe.ts
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env before any app modules (tsx --env-file can load too late for singletons).
let stripeFromFile = false;
for (const line of readFileSync(resolve(process.cwd(), ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[m[1]] = v; // always prefer .env over shell overrides for this script
  if (m[1] === "STRIPE_SECRET_KEY") stripeFromFile = true;
}

const loadedKey = process.env.STRIPE_SECRET_KEY || "";
console.log(
  "Loaded Stripe key mode:",
  loadedKey.startsWith("sk_live") ? "live" : loadedKey.startsWith("sk_test") ? "test" : "missing",
  stripeFromFile ? "(from .env)" : "(not in .env)"
);

async function main() {
  const { syncAllStripePayments } = await import("../src/lib/stripe-checkout");
  const { stripe } = await import("../src/lib/stripe");
  const { db } = await import("../src/lib/db");

  const key = process.env.STRIPE_SECRET_KEY || "";
  console.log("Stripe key mode:", key.startsWith("sk_live") ? "live" : key.startsWith("sk_test") ? "test" : "missing");

  const since = Math.floor((Date.now() - 120 * 24 * 60 * 60 * 1000) / 1000);
  const list = await stripe().checkout.sessions.list({ limit: 20, created: { gte: since } });
  const paid = list.data.filter((s) => s.payment_status === "paid");
  console.log("Recent sessions total:", list.data.length, "paid:", paid.length);
  for (const s of paid) {
    console.log("PAID", s.id, s.metadata?.patientId || "no-patient", s.amount_total);
  }

  const result = await syncAllStripePayments({ days: 120 });
  console.log("Sync result:", JSON.stringify(result));

  const counts = await db.patient.groupBy({ by: ["status"], _count: true });
  console.log("Patient status counts:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { db } = await import("../src/lib/db");
    await db.$disconnect();
  });
