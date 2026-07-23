// Server-only: WhatsApp Cloud API settings (DB portal + env fallback).
import { db } from "./db";

export type WhatsAppConfig = {
  token: string;
  phoneNumberId: string;
  templatesEnabled: boolean;
  templateLang: string;
  tplProposal: string;
  tplReminder: string;
  tplLogin: string;
  webhookVerifyToken: string;
  metaAppSecret: string;
  adminNotifyWhatsApp: string;
  /** True when values came from the admin portal DB row (non-empty token or phone id). */
  source: "database" | "env" | "mixed" | "none";
};

function envBool(v: string | undefined) {
  const s = (v || "").toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function pick(dbVal: string | undefined | null, envVal: string | undefined, fallback = "") {
  const d = (dbVal || "").trim();
  if (d) return d;
  return (envVal || "").trim() || fallback;
}

/** Resolve live Cloud API config: portal DB wins when set, else Vercel/local env. */
export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  let row: {
    token: string;
    phoneNumberId: string;
    templatesEnabled: boolean;
    templateLang: string;
    tplProposal: string;
    tplReminder: string;
    tplLogin: string;
    webhookVerifyToken: string;
    metaAppSecret: string;
    adminNotifyWhatsApp: string;
  } | null = null;

  try {
    row = await db.whatsAppSettings.findUnique({ where: { id: "default" } });
  } catch {
    row = null;
  }

  const token = pick(row?.token, process.env.WHATSAPP_TOKEN);
  const phoneNumberId = pick(row?.phoneNumberId, process.env.WHATSAPP_PHONE_NUMBER_ID);
  const dbHasCreds = !!(row?.token?.trim() || row?.phoneNumberId?.trim());
  const envHasCreds = !!(process.env.WHATSAPP_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());

  let source: WhatsAppConfig["source"] = "none";
  if (dbHasCreds && envHasCreds) source = "mixed";
  else if (dbHasCreds) source = "database";
  else if (envHasCreds) source = "env";

  const templatesEnabled = row
    ? row.templatesEnabled || envBool(process.env.WHATSAPP_TEMPLATES_ENABLED)
    : envBool(process.env.WHATSAPP_TEMPLATES_ENABLED);

  return {
    token,
    phoneNumberId,
    templatesEnabled,
    templateLang: pick(row?.templateLang, process.env.WHATSAPP_TEMPLATE_LANG, "en_GB") || "en_GB",
    tplProposal: pick(row?.tplProposal, process.env.WHATSAPP_TPL_PROPOSAL, "payment_reminder"),
    tplReminder: pick(row?.tplReminder, process.env.WHATSAPP_TPL_REMINDER, "porposal_ready"),
    tplLogin: pick(row?.tplLogin, process.env.WHATSAPP_TPL_LOGIN, "login_code"),
    webhookVerifyToken: pick(row?.webhookVerifyToken, process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
    metaAppSecret: pick(row?.metaAppSecret, process.env.META_APP_SECRET),
    adminNotifyWhatsApp: pick(row?.adminNotifyWhatsApp, process.env.ADMIN_NOTIFY_WHATSAPP),
    source,
  };
}

export function maskSecret(value: string) {
  const v = value.trim();
  if (!v) return "";
  if (v.length <= 8) return "••••••••";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}
