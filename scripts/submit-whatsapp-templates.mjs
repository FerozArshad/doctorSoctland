/**
 * Submit Dental Scotland WhatsApp templates to Meta for approval.
 * Usage: node scripts/submit-whatsapp-templates.mjs
 */
import { PrismaClient } from "@prisma/client";

function pick(dbVal, envVal, fallback = "") {
  const d = (dbVal || "").trim();
  if (d) return d;
  return (envVal || "").trim() || fallback;
}

const db = new PrismaClient();
const row = await db.whatsAppSettings.findUnique({ where: { id: "default" } }).catch(() => null);
const token = pick(row?.token, process.env.WHATSAPP_TOKEN);
const waba = pick("", process.env.WHATSAPP_WABA_ID, "2294276881326866");
const lang = pick(row?.templateLang, process.env.WHATSAPP_TEMPLATE_LANG, "en_GB") || "en_GB";

if (!token) {
  console.error("Missing WHATSAPP_TOKEN");
  process.exit(1);
}

const templates = [
  {
    name: pick(row?.tplProposal, process.env.WHATSAPP_TPL_PROPOSAL, "payment_reminder"),
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Hello {{1}}, your personalised treatment plan from Dental Scotland is ready. Open your secure proposal here: {{2}} Thanks, Dental Scotland.",
        example: { body_text: [["Sarah", "https://dashboard.dentalscotland.com/p/example"]] },
      },
    ],
  },
  {
    name: pick(row?.tplReminder, process.env.WHATSAPP_TPL_REMINDER, "proposal_ready"),
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Hello {{1}}, a reminder that your Dental Scotland treatment proposal is waiting. View it here: {{2}} Thanks, Dental Scotland.",
        example: { body_text: [["Sarah", "https://dashboard.dentalscotland.com/p/example"]] },
      },
    ],
  },
  {
    name: pick(row?.tplLogin, process.env.WHATSAPP_TPL_LOGIN, "login_code"),
    category: "AUTHENTICATION",
    components: [
      {
        type: "BODY",
        add_security_recommendation: true,
        example: { body_text: [["123456"]] },
      },
      {
        type: "BUTTONS",
        buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copy code" }],
      },
    ],
  },
];

for (const tpl of templates) {
  const payload = {
    name: tpl.name,
    language: lang,
    category: tpl.category,
    components: tpl.components,
  };
  console.log(`\nSubmitting ${tpl.name} (${tpl.category}, ${lang})…`);
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(waba)}/message_templates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  console.log(JSON.stringify({ status: res.status, ...json }, null, 2));
}

await db.$disconnect();
