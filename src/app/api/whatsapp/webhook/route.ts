import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { timingSafeEqualStr } from "@/lib/secure";
import { getWhatsAppConfig } from "@/lib/whatsapp-settings";
import { logWhatsAppStatusEvent, type MetaStatusPayload } from "@/lib/whatsapp-delivery-log";

export const dynamic = "force-dynamic";

/**
 * Meta WhatsApp Cloud API webhook.
 * Callback URL: https://dashboard.dentalscotland.com/api/whatsapp/webhook
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
  const signatureOk = await verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"));
  if (!signatureOk) {
    log.warn("whatsapp.webhook.bad_signature", { bodyLength: rawBody.length });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: {
    object?: string;
    entry?: Array<{
      id?: string;
      changes?: Array<{
        field?: string;
        value?: {
          messaging_product?: string;
          metadata?: Record<string, unknown>;
          statuses?: MetaStatusPayload[];
          messages?: Array<{ from?: string; type?: string; text?: { body?: string } }>;
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        };
      }>;
    }>;
  };

  try {
    body = JSON.parse(rawBody);
  } catch {
    log.warn("whatsapp.webhook.bad_json");
    return NextResponse.json({ ok: true });
  }

  log.info("whatsapp.webhook.received", {
    object: body.object || null,
    entryCount: body.entry?.length || 0,
    rawBody: rawBody,
  });

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

async function handleStatus(st: MetaStatusPayload) {
  const status = (st.status || "").toLowerCase();
  const waId = st.recipient_id || "";
  const messageId = st.id || "";
  const err = st.errors?.[0];

  log.info("whatsapp.status", {
    status,
    waId: waId || null,
    messageId: messageId || null,
    code: err?.code ?? null,
    title: err?.title ?? null,
    message: err?.message ?? null,
    errors: st.errors ?? null,
    conversation: st.conversation ?? null,
    pricing: st.pricing ?? null,
    metadata: st.metadata ?? null,
    rawPayload: st,
  });

  const patient = waId ? await findPatientByWaId(waId) : null;
  await logWhatsAppStatusEvent(st, patient?.id);

  if (!waId || (status !== "failed" && status !== "undeliverable" && status !== "delivered")) return;

  if (!patient) return;

  const errMsg = err?.message || err?.title || err?.error_data?.details || "";
  let text: string;
  if (status === "delivered") {
    text = "WhatsApp delivered";
  } else {
    log.error("whatsapp.delivery.failed", {
      patientId: patient.id,
      waId,
      status,
      messageId: messageId || null,
      code: err?.code || null,
      message: errMsg || null,
      errors: st.errors,
      rawPayload: st,
    });
    text = err?.code
      ? `WhatsApp not delivered — Meta error ${err.code}: ${errMsg}`
      : "WhatsApp not delivered";
  }
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
