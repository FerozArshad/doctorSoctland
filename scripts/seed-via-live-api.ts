// Seeds the live database through the deployed app (uses Vercel's DATABASE_URL).
// Requires CRON_SECRET in .env — copy the Production value from Vercel.
//
//   npm run seed:live
async function main() {
  const appUrl = (process.env.APP_URL || "https://dashboard.dentalscotland.com").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET;

  if (!secret || secret.startsWith("dev-cron") || secret.startsWith("change-me")) {
    console.error("Set CRON_SECRET in .env to your Production value from Vercel.");
    process.exit(1);
  }

  const res = await fetch(`${appUrl}/api/setup/seed`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });

  const body = await res.text();
  console.log(body);
  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
