import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const GRAPH = "https://graph.facebook.com/v21.0";

function pick(dbVal, envVal, fallback = "") {
  const d = (dbVal || "").trim();
  if (d) return d;
  return (envVal || "").trim() || fallback;
}

function mask(v) {
  const s = (v || "").trim();
  if (!s) return "(empty)";
  if (s.length <= 8) return "••••••••";
  return `${s.slice(0, 4)}…${s.slice(-4)} (${s.length} chars)`;
}

async function getConfig() {
  let row = null;
  try {
    row = await db.whatsAppSettings.findUnique({ where: { id: "default" } });
  } catch {
    row = null;
  }
  return {
    token: pick(row?.token, process.env.WHATSAPP_TOKEN),
    phoneNumberId: pick(row?.phoneNumberId, process.env.WHATSAPP_PHONE_NUMBER_ID),
    webhookVerifyToken: pick(row?.webhookVerifyToken, process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
    metaAppSecret: pick(row?.metaAppSecret, process.env.META_APP_SECRET),
    metaAppId: (process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || "").trim(),
    appUrl: (process.env.APP_URL || "https://dashboard.dentalscotland.com").replace(/\/$/, ""),
  };
}

async function graphGet(path, token) {
  const res = await fetch(`${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${token.trim()}` },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function debugToken(inputToken, appId, appSecret) {
  if (!appId || !appSecret) return null;
  const url = `${GRAPH}/debug_token?input_token=${encodeURIComponent(inputToken)}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`;
  const res = await fetch(url, { cache: "no-store" });
  return res.json();
}

async function testWebhook(baseUrl, verifyToken) {
  const challenge = "audit-challenge-12345";
  const params = new URLSearchParams({
    "hub.mode": "subscribe",
    "hub.verify_token": verifyToken,
    "hub.challenge": challenge,
  });
  const res = await fetch(`${baseUrl}/api/whatsapp/webhook?${params}`, { cache: "no-store" });
  const body = await res.text();
  return {
    url: `${baseUrl}/api/whatsapp/webhook`,
    status: res.status,
    body: body.slice(0, 80),
    challengeReturned: body === challenge,
  };
}

const cfg = await getConfig();
const report = {
  config: {
    phoneNumberId: cfg.phoneNumberId || "(missing)",
    token: cfg.token ? mask(cfg.token) : "(missing)",
    webhookVerifyToken: mask(cfg.webhookVerifyToken),
    webhookTokenLength: cfg.webhookVerifyToken.length,
    webhookTokenMeetsMin16: cfg.webhookVerifyToken.length >= 16,
    metaAppSecret: cfg.metaAppSecret ? mask(cfg.metaAppSecret) : "(missing)",
    metaAppId: cfg.metaAppId || "(not set in env — will try APP id from phone health)",
    webhookCallbackUrl: `${cfg.appUrl}/api/whatsapp/webhook`,
  },
  tokenPermissions: null,
  phoneAndWaba: null,
  subscribedApps: null,
  webhookTests: [],
  findings: [],
};

if (!cfg.token || !cfg.phoneNumberId) {
  report.findings.push("Missing token or phone number ID — cannot audit further.");
  console.log(JSON.stringify(report, null, 2));
  await db.$disconnect();
  process.exit(1);
}

// Phone + WABA alignment (fetch first — also supplies APP id for token debug)
const phone = await graphGet(
  `/${encodeURIComponent(cfg.phoneNumberId)}?fields=id,display_phone_number,verified_name,health_status`,
  cfg.token
);
report.phoneAndWaba = phone.json;
let wabaId = "";
for (const ent of phone.json?.health_status?.entities || []) {
  if (ent.entity_type === "WABA" && ent.id) wabaId = ent.id;
}

// Token debug / scopes — fall back to APP entity id from phone health if META_APP_ID unset
let appIdForDebug = cfg.metaAppId;
if (!appIdForDebug && phone.json?.health_status?.entities) {
  const appEnt = phone.json.health_status.entities.find((e) => e.entity_type === "APP");
  if (appEnt?.id) appIdForDebug = appEnt.id;
}
report.config.metaAppIdUsedForDebug = appIdForDebug || "(none)";

const debug = await debugToken(cfg.token, appIdForDebug, cfg.metaAppSecret);
if (debug?.data) {
  const scopes = debug.data.scopes || [];
  const required = ["whatsapp_business_messaging", "whatsapp_business_management"];
  report.tokenPermissions = {
    type: debug.data.type,
    appId: debug.data.app_id,
    userId: debug.data.user_id,
    isValid: debug.data.is_valid,
    expiresAt: debug.data.expires_at ? new Date(debug.data.expires_at * 1000).toISOString() : "never",
    scopes,
    hasMessaging: scopes.includes("whatsapp_business_messaging"),
    hasManagement: scopes.includes("whatsapp_business_management"),
    missingRequired: required.filter((s) => !scopes.includes(s)),
    granularScopes: debug.data.granular_scopes || [],
  };
  if (!debug.data.is_valid) report.findings.push("Access token is invalid or expired.");
  if (report.tokenPermissions.missingRequired.length) {
    report.findings.push(`Token missing scopes: ${report.tokenPermissions.missingRequired.join(", ")}`);
  }
} else if (debug?.error) {
  report.tokenPermissions = { error: debug.error.message || debug.error };
  report.findings.push("Could not debug token — set META_APP_ID in env with META_APP_SECRET for scope audit.");
} else {
  report.findings.push("Could not debug token — META_APP_SECRET missing or debug failed.");
}

if (!phone.ok) {
  report.findings.push(`Token cannot read phone number ${cfg.phoneNumberId}: ${phone.json?.error?.message || phone.status}`);
} else if (wabaId) {
  const waba = await graphGet(`/${encodeURIComponent(wabaId)}?fields=id,name,account_review_status,owner_business_info`, cfg.token);
  const apps = await graphGet(`/${encodeURIComponent(wabaId)}/subscribed_apps`, cfg.token);
  report.subscribedApps = apps.json;
  report.waba = waba.json;
  if (!apps.ok) {
    report.findings.push(`Token cannot list subscribed apps on WABA ${wabaId}.`);
  } else if (!(apps.json?.data?.length > 0)) {
    report.findings.push("No Meta app subscribed to this WABA — link your app in Business Settings.");
  }
  if (debug?.data?.granular_scopes?.length) {
    const wabaScopes = debug.data.granular_scopes.filter((g) => g.scope?.includes("whatsapp"));
    const targets = wabaScopes.flatMap((g) => g.target_ids || []);
    if (targets.length && !targets.includes(wabaId) && !targets.includes(cfg.phoneNumberId)) {
      report.findings.push(`Token granular scopes may not include WABA ${wabaId} or phone ${cfg.phoneNumberId}.`);
    }
  }
}

// Webhook verify token — code requires length >= 16
if (!cfg.webhookVerifyToken) {
  report.findings.push("Webhook verify token is empty — Meta webhook verification will fail.");
} else if (cfg.webhookVerifyToken.length < 16) {
  report.findings.push("Webhook verify token is shorter than 16 chars — our code rejects verification.");
}

for (const base of [cfg.appUrl, "http://localhost:3000", "https://doctor-soctland-ferozarshads-projects.vercel.app"]) {
  if (!cfg.webhookVerifyToken) break;
  try {
    report.webhookTests.push(await testWebhook(base, cfg.webhookVerifyToken));
  } catch (e) {
    report.webhookTests.push({ url: `${base}/api/whatsapp/webhook`, error: e.message });
  }
}

const wrongBase = "https://doctor-soctland-ferozarshads-projects.vercel.app";
const wrong = await testWebhook(wrongBase, `${cfg.webhookVerifyToken}x`).catch((e) => ({
  error: e.message,
}));
report.webhookTests.push({ label: "wrong-token-control", url: `${wrongBase}/api/whatsapp/webhook`, ...wrong });

if (report.webhookTests.some((t) => t.challengeReturned)) {
  report.findings.push("Webhook verify token matches our deployed endpoint (subscribe handshake succeeds).");
} else if (cfg.webhookVerifyToken.length >= 16) {
  report.findings.push("Webhook handshake did not succeed on tested URLs — check APP_URL / dev server, or token mismatch vs Meta.");
}

console.log(JSON.stringify(report, null, 2));
await db.$disconnect();
