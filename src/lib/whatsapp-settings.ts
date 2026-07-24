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

export type WhatsAppHealthBlocker = {
  entity: string;
  code: number;
  description: string;
  solution: string;
};

export type WhatsAppHealth = {
  ok: boolean;
  canSendMessage: string;
  displayPhone: string;
  verifiedName: string;
  wabaId: string;
  blockers: WhatsAppHealthBlocker[];
  summary: string;
};

/** Live Meta health_status — detects WABA/phone blocks that still return API "accepted". */
export async function getWhatsAppHealth(): Promise<WhatsAppHealth | null> {
  const c = await getWhatsAppConfig();
  if (!c.token || !c.phoneNumberId) return null;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(c.phoneNumberId)}?fields=display_phone_number,verified_name,health_status`,
      { headers: { Authorization: `Bearer ${c.token.trim()}` }, cache: "no-store" }
    );
    const json = (await res.json()) as {
      error?: { message?: string };
      display_phone_number?: string;
      verified_name?: string;
      health_status?: {
        can_send_message?: string;
        entities?: Array<{
          entity_type?: string;
          id?: string;
          can_send_message?: string;
          errors?: Array<{ error_code?: number; error_description?: string; possible_solution?: string }>;
        }>;
      };
    };
    if (!res.ok) {
      return {
        ok: false,
        canSendMessage: "ERROR",
        displayPhone: "",
        verifiedName: "",
        wabaId: "",
        blockers: [
          {
            entity: "API",
            code: res.status,
            description: json.error?.message || "Health check failed",
            solution: "Re-check Phone Number ID and access token in Admin → WhatsApp",
          },
        ],
        summary: json.error?.message || "WhatsApp health check failed",
      };
    }

    const entities = json.health_status?.entities || [];
    const blockers: WhatsAppHealthBlocker[] = [];
    let wabaId = "";
    for (const ent of entities) {
      if (ent.entity_type === "WABA" && ent.id) wabaId = ent.id;
      if ((ent.can_send_message || "").toUpperCase() !== "AVAILABLE") {
        for (const err of ent.errors || []) {
          blockers.push({
            entity: ent.entity_type || "UNKNOWN",
            code: err.error_code || 0,
            description: err.error_description || "Blocked",
            solution: err.possible_solution || "",
          });
        }
        if (!(ent.errors || []).length) {
          blockers.push({
            entity: ent.entity_type || "UNKNOWN",
            code: 0,
            description: `can_send_message=${ent.can_send_message || "BLOCKED"}`,
            solution: "",
          });
        }
      }
    }

    // Ignore SIP/calling-only blockers — they do not stop chat messages.
    const messagingBlockers = blockers.filter(
      (b) =>
        b.code !== 138024 &&
        b.code !== 138025 &&
        !/sip/i.test(b.description) &&
        !/calling/i.test(b.description)
    );

    const canSendMessage = (json.health_status?.can_send_message || "UNKNOWN").toUpperCase();
    // Prefer entity messaging blockers over the overall flag (SIP calling can mark overall BLOCKED).
    const ok = messagingBlockers.length === 0 && canSendMessage !== "ERROR";

    const top = messagingBlockers[0];
    const summary = !ok && top
      ? `WhatsApp blocked (${top.entity} ${top.code || "—"}) — ${top.description}`
      : ok
        ? `WhatsApp ready · ${json.verified_name || "Connected"} · ${json.display_phone_number || c.phoneNumberId}`
        : `WhatsApp health: ${canSendMessage}`;

    return {
      ok,
      canSendMessage,
      displayPhone: json.display_phone_number || "",
      verifiedName: json.verified_name || "",
      wabaId,
      blockers: messagingBlockers,
      summary,
    };
  } catch (e) {
    return {
      ok: false,
      canSendMessage: "ERROR",
      displayPhone: "",
      verifiedName: "",
      wabaId: "",
      blockers: [
        {
          entity: "API",
          code: 0,
          description: e instanceof Error ? e.message : "Health check failed",
          solution: "",
        },
      ],
      summary: e instanceof Error ? e.message : "WhatsApp health check failed",
    };
  }
}
