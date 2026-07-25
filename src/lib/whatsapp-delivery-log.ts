// Persistent WhatsApp delivery tracing — outbound sends + inbound status webhooks.
import type { Prisma } from "@prisma/client";
import { db } from "./db";

export type MetaStatusPayload = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  conversation?: Record<string, unknown>;
  pricing?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  errors?: Array<{
    code?: number;
    title?: string;
    message?: string;
    error_data?: { details?: string };
    href?: string;
  }>;
};

export async function logWhatsAppOutbound(opts: {
  recipientId: string;
  phoneNumberId: string;
  payloadType: string;
  templateName?: string;
  requestBody: Record<string, unknown>;
  responseBody: unknown;
  httpStatus: number;
  messageId?: string;
  waId?: string;
  messageStatus?: string;
  patientId?: string;
}) {
  try {
    await db.whatsAppOutboundLog.create({
      data: {
        messageId: opts.messageId || "",
        recipientId: opts.recipientId,
        phoneNumberId: opts.phoneNumberId,
        payloadType: opts.payloadType,
        templateName: opts.templateName || "",
        requestBody: opts.requestBody as Prisma.InputJsonValue,
        responseBody: (opts.responseBody ?? {}) as Prisma.InputJsonValue,
        httpStatus: opts.httpStatus,
        waId: opts.waId || "",
        messageStatus: opts.messageStatus || "",
        patientId: opts.patientId || null,
      },
    });
  } catch {
    // Never block sends on audit log failure.
  }
}

export async function logWhatsAppStatusEvent(st: MetaStatusPayload, patientId?: string | null) {
  const status = (st.status || "").toLowerCase();
  const messageId = st.id || "";
  const recipientId = st.recipient_id || "";
  if (!messageId || !status) return null;

  const err = st.errors?.[0];
  const eventTimestamp = st.timestamp ? new Date(Number(st.timestamp) * 1000) : null;

  try {
    return await db.whatsAppStatusEvent.create({
      data: {
        messageId,
        recipientId,
        status,
        eventTimestamp,
        errorCode: err?.code ?? null,
        errorTitle: err?.title || "",
        errorMessage: err?.message || err?.error_data?.details || "",
        errorsJson: (st.errors || []) as Prisma.InputJsonValue,
        conversation: (st.conversation || null) as Prisma.InputJsonValue,
        pricing: (st.pricing || null) as Prisma.InputJsonValue,
        metadata: (st.metadata || null) as Prisma.InputJsonValue,
        rawPayload: st as Prisma.InputJsonValue,
        patientId: patientId || null,
      },
    });
  } catch (e) {
    console.error("whatsapp.status.log.fail", e);
    return null;
  }
}

export async function getDeliveryLifecycle(messageId: string) {
  const [outbound, events] = await Promise.all([
    db.whatsAppOutboundLog.findFirst({ where: { messageId }, orderBy: { createdAt: "desc" } }),
    db.whatsAppStatusEvent.findMany({ where: { messageId }, orderBy: { eventTimestamp: "asc" } }),
  ]);
  return { outbound, events };
}
