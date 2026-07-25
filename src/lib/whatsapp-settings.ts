// Server-only: WhatsApp Cloud API settings (DB portal + env fallback).
import { db } from "./db";

/** Graph API version used for all WhatsApp Cloud API calls. */
export const WHATSAPP_GRAPH_VERSION = "v21.0";

function graphUrl(path: string) {
  return `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${path.replace(/^\//, "")}`;
}

function maskAuthHeader(token: string) {
  const t = token.trim();
  if (t.length <= 8) return "••••••••";
  return `Bearer ${t.slice(0, 8)}…`;
}

function whatsappDebugEnabled() {
  return process.env.WHATSAPP_DEBUG === "1" || process.env.WHATSAPP_DEBUG === "true";
}

function debugWhatsApp(event: string, fields: Record<string, unknown>) {
  if (!whatsappDebugEnabled()) return;
  // Full payload — bypass log sanitiser truncation when WHATSAPP_DEBUG=1.
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: "debug", event, ...fields }));
}

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
  wabaReviewStatus?: string;
  appLinked?: boolean;
  /** Hard failures only — credential/phone lookup or messaging API probe errors. */
  blockers: WhatsAppHealthBlocker[];
  /** Meta health_status advisories (e.g. 141008) — informational, not used to block sends. */
  advisories: WhatsAppHealthBlocker[];
  summary: string;
  /** Diagnostics — which credentials the check used. */
  phoneNumberId?: string;
  configSource?: WhatsAppConfig["source"];
  tokenMask?: string;
  verifiedVia?: "phone_lookup" | "phone_lookup+messaging_probe";
  qualityRating?: string;
};

type MetaGraphError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

async function graphGet(token: string, path: string, label: string) {
  const endpoint = graphUrl(path);
  const headers = { Authorization: `Bearer ${token.trim()}` };
  debugWhatsApp("whatsapp.graph.request", {
    label,
    endpoint,
    apiVersion: WHATSAPP_GRAPH_VERSION,
    authorization: maskAuthHeader(token),
    method: "GET",
  });
  const res = await fetch(endpoint, { headers, cache: "no-store" });
  const raw = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    json = { _raw: raw };
  }
  const err = json.error as MetaGraphError | undefined;
  debugWhatsApp("whatsapp.graph.response", {
    label,
    httpStatus: res.status,
    body: raw,
    metaErrorCode: err?.code ?? null,
    metaErrorSubcode: err?.error_subcode ?? null,
    fbtrace_id: err?.fbtrace_id ?? null,
  });
  return { res, json, raw, err };
}

function parseHealthAdvisories(healthStatus: {
  can_send_message?: string;
  entities?: Array<{
    entity_type?: string;
    id?: string;
    can_send_message?: string;
    errors?: Array<{ error_code?: number; error_description?: string; possible_solution?: string }>;
  }>;
} | undefined): { advisories: WhatsAppHealthBlocker[]; wabaId: string; canSendMessage: string } {
  const entities = healthStatus?.entities || [];
  const advisories: WhatsAppHealthBlocker[] = [];
  let wabaId = "";
  for (const ent of entities) {
    if (ent.entity_type === "WABA" && ent.id) wabaId = ent.id;
    if ((ent.can_send_message || "").toUpperCase() !== "AVAILABLE") {
      for (const err of ent.errors || []) {
        advisories.push({
          entity: ent.entity_type || "UNKNOWN",
          code: err.error_code || 0,
          description: err.error_description || "Advisory",
          solution: err.possible_solution || "",
        });
      }
      if (!(ent.errors || []).length) {
        advisories.push({
          entity: ent.entity_type || "UNKNOWN",
          code: 0,
          description: `can_send_message=${ent.can_send_message || "BLOCKED"}`,
          solution: "",
        });
      }
    }
  }
  return {
    advisories,
    wabaId,
    canSendMessage: (healthStatus?.can_send_message || "UNKNOWN").toUpperCase(),
  };
}

/**
 * Verify Cloud API credentials by reading the phone number node.
 * This is the authoritative readiness check — not Meta's health_status field,
 * which can report 141008 even while POST /messages succeeds.
 */
export async function getWhatsAppHealth(opts?: { probeMessaging?: boolean }): Promise<WhatsAppHealth | null> {
  const c = await getWhatsAppConfig();
  if (!c.token || !c.phoneNumberId) return null;

  const token = c.token.trim();
  const phoneNumberId = c.phoneNumberId.trim();
  const baseDiag = {
    phoneNumberId,
    configSource: c.source,
    tokenMask: maskSecret(c.token),
  };

  try {
    const phoneFields = "id,display_phone_number,verified_name,quality_rating,health_status";
    const phone = await graphGet(token, `${encodeURIComponent(phoneNumberId)}?fields=${phoneFields}`, "phone_lookup");
    const phoneJson = phone.json as {
      id?: string;
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
      health_status?: Parameters<typeof parseHealthAdvisories>[0];
    };

    if (!phone.res.ok) {
      const err = phone.err;
      return {
        ok: false,
        canSendMessage: "ERROR",
        displayPhone: "",
        verifiedName: "",
        wabaId: "",
        blockers: [
          {
            entity: "API",
            code: err?.code || phone.res.status,
            description: err?.message || "Phone number lookup failed",
            solution: "Re-check Phone Number ID and access token in Admin → WhatsApp",
          },
        ],
        advisories: [],
        summary: err?.message || "WhatsApp phone lookup failed",
        ...baseDiag,
      };
    }

    const { advisories, wabaId, canSendMessage } = parseHealthAdvisories(phoneJson.health_status);
    let verifiedVia: WhatsAppHealth["verifiedVia"] = "phone_lookup";
    const blockers: WhatsAppHealthBlocker[] = [];

    // Optional: prove messaging permissions via WABA template list (no message sent).
    if (opts?.probeMessaging && wabaId) {
      const templates = await graphGet(
        token,
        `${encodeURIComponent(wabaId)}/message_templates?limit=1`,
        "messaging_probe"
      );
      if (!templates.res.ok) {
        const err = templates.err;
        blockers.push({
          entity: "MESSAGING_API",
          code: err?.code || templates.res.status,
          description: err?.message || "Messaging API probe failed",
          solution: "Ensure the token has whatsapp_business_messaging permission",
        });
      } else {
        verifiedVia = "phone_lookup+messaging_probe";
      }
    }

    let wabaReviewStatus: string | undefined;
    let appLinked: boolean | undefined;
    const resolvedWabaId = wabaId;
    if (resolvedWabaId) {
      try {
        const [wabaRes, appsRes] = await Promise.all([
          graphGet(token, `${encodeURIComponent(resolvedWabaId)}?fields=account_review_status,name`, "waba_lookup"),
          graphGet(token, `${encodeURIComponent(resolvedWabaId)}/subscribed_apps`, "waba_apps"),
        ]);
        const wabaJson = wabaRes.json as { account_review_status?: string; name?: string };
        const appsJson = appsRes.json as { data?: unknown[] };
        if (wabaRes.res.ok) wabaReviewStatus = wabaJson.account_review_status;
        if (appsRes.res.ok) appLinked = (appsJson.data?.length || 0) > 0;
      } catch {
        // Optional diagnostics — ignore failures.
      }
    }

    const ok = blockers.length === 0;
    const top = blockers[0];
    const summary = !ok && top
      ? `WhatsApp not ready (${top.entity} ${top.code || "—"}) — ${top.description}`
      : `WhatsApp ready · ${phoneJson.verified_name || "Connected"} · ${phoneJson.display_phone_number || phoneNumberId}`;

    return {
      ok,
      canSendMessage,
      displayPhone: phoneJson.display_phone_number || "",
      verifiedName: phoneJson.verified_name || "",
      wabaId: resolvedWabaId,
      wabaReviewStatus,
      appLinked,
      blockers,
      advisories,
      summary,
      qualityRating: phoneJson.quality_rating,
      verifiedVia,
      ...baseDiag,
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
      advisories: [],
      summary: e instanceof Error ? e.message : "WhatsApp health check failed",
      ...baseDiag,
    };
  }
}
