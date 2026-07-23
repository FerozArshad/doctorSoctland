import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { timingSafeEqualStr } from "@/lib/secure";
import { getWhatsAppConfig } from "@/lib/whatsapp-settings";

export const dynamic = "force-dynamic";

/**
 * Meta WhatsApp Cloud API webhook.
 * Configure in Meta App → WhatsApp → Configuration:
 *   Callback URL: https://dashboard.dentalscotland.com/api/whatsapp/webhook
 *   Verify token: same as saved in Admin → WhatsApp (or WHATSAPP_WEBHOOK_VERIFY_TOKEN)
 * Subscribe to: messages (includes delivery status updates)
 */

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token") || "";
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  const cfg = await getWhatsAppConfig();
  const expected = cfg.webhookVerifyToken || "";

  if (mode === "subscribe" && expected.length >= 16 && challenge && timingSafeEqualStr(token, expected)) {
    log.info("whatsapp.webhook.verify", { ok: true });
    return new NextResponse(challenge, { status: 200 });
  }
  log.warn("whatsapp.webhook.verify", { ok: false });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

type Status = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
};

async function verifyMetaSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const cfg = await getWhatsAppConfig();
  const secret = cfg.metaAppSecret || "";
  if (!secret || secret.length < 16) {
    return process.env.NODE_ENV !== "production";
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  return timingSafeEqualStr(expected, provided);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!(await verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256")))) {
    log.warn("whatsapp.webhook.bad_signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: {
    entry?: Array<{
      changes?: Array<{
        value?: {
          statuses?: Status[];
          messages?: Array<{ from?: string; type?: string; text?: { body?: string } }>;
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        };
      }>;
    }>;
  };

  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const jobs: Promise<unknown>[] = [];

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;
      for (const st of value.statuses || []) {
        jobs.push(handleStatus(st));
      }
    }
  }

  await Promise.allSettled(jobs);
  return NextResponse.json({ ok: true });
}

async function handleStatus(st: Status) {
  const status = (st.status || "").toLowerCase();
  const waId = st.recipient_id || "";
  const messageId = st.id || "";
  const err = st.errors?.[0];
  const errMsg = err?.message || err?.title || err?.error_data?.details || "";

  log.info("whatsapp.status", {
    status,
    waId: waId || null,
    messageId: messageId ? messageId.slice(0, 28) + "…" : null,
    code: err?.code || null,
    message: errMsg ? errMsg.slice(0, 160) : null,
  });

  if (!waId || (status !== "failed" && status !== "undeliverable")) return;

  const patient = await findPatientByWaId(waId);
  if (!patient) {
    log.warn("whatsapp.status.unmatched", { waId, status });
    return;
  }

  const text = `WhatsApp delivery ${status} to +${waId}${errMsg ? ` — ${errMsg}` : ""}${
    err?.code ? ` (code ${err.code})` : ""
  }`;
  await db.activity.create({ data: { patientId: patient.id, text } });
}

async function findPatientByWaId(waId: string) {
  const digits = waId.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const patients = await db.patient.findMany({
    where: { phone: { contains: digits.slice(-10) } },
    select: { id: true, phone: true },
    take: 5,
  });
  return (
    patients.find((p) => (p.phone || "").replace(/\D/g, "").endsWith(digits) || digits.endsWith((p.phone || "").replace(/\D/g, "").slice(-10))) ||
    patients[0] ||
    null
  );
}
