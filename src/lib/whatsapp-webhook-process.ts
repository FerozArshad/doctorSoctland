import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { forwardWhatsAppWebhook } from "@/lib/whatsapp-forward";

type Status = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
};

type WebhookBody = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        statuses?: Status[];
        messages?: Array<{ from?: string; type?: string; text?: { body?: string }; id?: string }>;
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        metadata?: { phone_number_id?: string; display_phone_number?: string };
      };
    }>;
  }>;
};

/** Dashboard webhook work — delivery logs, inbound logging, affiliate forward. */
export async function processWhatsAppWebhookPost(
  rawBody: string,
  metaSignature: string | null,
  body: WebhookBody
): Promise<void> {
  const jobs: Promise<unknown>[] = [];

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;

      for (const st of value.statuses || []) {
        jobs.push(handleStatus(st));
      }

      for (const msg of value.messages || []) {
        if (msg.type === "text" && msg.text?.body) {
          log.info("whatsapp.inbound", {
            from: msg.from || null,
            messageId: msg.id ? msg.id.slice(0, 28) + "…" : null,
            preview: msg.text.body.slice(0, 120),
          });
        }
      }
    }
  }

  await Promise.allSettled(jobs);
  await forwardWhatsAppWebhook(rawBody, metaSignature);
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

  if (!waId || (status !== "failed" && status !== "undeliverable" && status !== "delivered")) return;

  const patient = await findPatientByWaId(waId);
  if (!patient) {
    log.warn("whatsapp.status.unmatched", { waId, status });
    return;
  }

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
    });
    text = "WhatsApp not delivered";
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
