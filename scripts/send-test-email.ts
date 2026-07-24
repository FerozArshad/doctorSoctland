import { brandedEmail, sendEmail } from "../src/lib/notify";

const to = process.argv[2] || "ferozarshad99@gmail.com";

async function main() {
  const html = brandedEmail(
    "Dental Scotland — test email",
    `<p style="font-size:15px;line-height:1.7;color:#3C4a59;">This is a test email from the Dental Scotland dashboard.</p>
     <p style="font-size:15px;line-height:1.7;color:#3C4a59;">If you received this, outbound email is working correctly.</p>
     <p style="font-size:13px;color:#7A8696;margin-top:16px;">Sent at ${new Date().toISOString()}</p>`
  );
  const result = await sendEmail(to, "Dental Scotland — test email", html);
  console.log(JSON.stringify({ ok: true, to, ...result }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
