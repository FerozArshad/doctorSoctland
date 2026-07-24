import { db } from "./db";
import { log, summarizeError } from "./log";
import { getAlertRecipientEmails, getEmailSettings } from "./email-settings";

export const EMAIL_STATUSES = ["queued", "sent", "delivered", "bounced", "failed", "deferred"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const EMAIL_ERROR_TYPES = [
  "auth",
  "connection",
  "rate_limit",
  "bounce",
  "queue",
  "retry",
  "delivery",
  "unknown",
] as const;
export type EmailErrorType = (typeof EMAIL_ERROR_TYPES)[number];

export type SendEmailMeta = {
  category?: string;
  patientId?: string;
  metadata?: Record<string, unknown>;
  skipLog?: boolean;
  parentLogId?: string;
  fromOverride?: string;
};

const HTML_MAX = 120_000;
const API_RESPONSE_MAX = 4000;
const SPIKE_ALERT_COOLDOWN_MS = 30 * 60 * 1000;

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…[truncated]";
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

export function classifyEmailError(err: unknown, httpStatus?: number): { errorType: EmailErrorType; errorCode: string; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  const status = httpStatus ?? 0;
  const combined = `${status} ${message}`.toLowerCase();

  if (status === 401 || status === 403 || /token|auth|unauthorized|invalid_grant|credentials/i.test(combined)) {
    return { errorType: "auth", errorCode: String(status || "auth"), message };
  }
  if (status === 429 || /rate.?limit|quota|too many/i.test(combined)) {
    return { errorType: "rate_limit", errorCode: String(status || "429"), message };
  }
  if (/bounce|550|551|552|553|554|recipient rejected|mailbox unavailable/i.test(combined)) {
    return { errorType: "bounce", errorCode: String(status || "bounce"), message };
  }
  if (/econnrefused|etimedout|enotfound|network|fetch failed|connection|socket/i.test(combined)) {
    return { errorType: "connection", errorCode: String(status || "connection"), message };
  }
  if (/queue|stuck|timeout waiting/i.test(combined)) {
    return { errorType: "queue", errorCode: String(status || "queue"), message };
  }
  if (/retry|deferred/i.test(combined)) {
    return { errorType: "retry", errorCode: String(status || "retry"), message };
  }
  return { errorType: "unknown", errorCode: String(status || "error"), message };
}

export async function createEmailLog(input: {
  to: string;
  from: string;
  subject: string;
  html: string;
  category: string;
  patientId?: string;
  metadata?: Record<string, unknown>;
  parentLogId?: string;
  retryCount?: number;
}) {
  return db.emailLog.create({
    data: {
      to: input.to.trim().toLowerCase(),
      fromAddress: input.from,
      subject: input.subject,
      htmlBody: truncate(input.html, HTML_MAX),
      category: input.category,
      patientId: input.patientId || null,
      metadata: safeJson(input.metadata || {}),
      parentLogId: input.parentLogId || null,
      retryCount: input.retryCount ?? 0,
      status: "queued",
    },
  });
}

export async function markEmailLogSent(
  logId: string,
  data: { provider: string; providerMessageId?: string; apiResponse?: string }
) {
  await db.emailLog.update({
    where: { id: logId },
    data: {
      status: "sent",
      provider: data.provider,
      providerMessageId: data.providerMessageId || "",
      apiResponse: truncate(data.apiResponse || "", API_RESPONSE_MAX),
      sentAt: new Date(),
      errorMessage: "",
      errorCode: "",
      errorType: "",
    },
  });
}

export async function markEmailLogFailed(
  logId: string,
  data: {
    provider: string;
    errorType: EmailErrorType;
    errorCode: string;
    errorMessage: string;
    apiResponse?: string;
    deferred?: boolean;
  }
) {
  await db.emailLog.update({
    where: { id: logId },
    data: {
      status: data.deferred ? "deferred" : "failed",
      provider: data.provider,
      errorType: data.errorType,
      errorCode: data.errorCode,
      errorMessage: truncate(data.errorMessage, 2000),
      apiResponse: truncate(data.apiResponse || "", API_RESPONSE_MAX),
    },
  });
}

async function sendSystemAlertEmail(subject: string, html: string) {
  const recipients = await getAlertRecipientEmails();
  if (recipients.length === 0) {
    log.warn("email.alert.skip", { reason: "no_recipients", subject });
    return;
  }

  const { sendEmailRaw } = await import("./notify");
  await Promise.all(
    recipients.map(async (to) => {
      try {
        await sendEmailRaw(to, subject, html);
        log.info("email.alert.sent", { to, subject });
      } catch (e) {
        log.error("email.alert.fail", { to, subject, ...summarizeError(e) });
      }
    })
  );
}

export async function sendEmailIssueAlert(opts: {
  title: string;
  detail: string;
  errorType?: EmailErrorType;
  logId?: string;
  recipient?: string;
  subject?: string;
}) {
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const logsLink = `${appUrl}/admin/email`;
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#16202E;max-width:640px;margin:0 auto;padding:24px;">
    <h2 style="color:#B4530A;">⚠️ Email system alert</h2>
    <p><strong>${opts.title}</strong></p>
    <p style="line-height:1.6;">${opts.detail}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      ${opts.errorType ? `<tr><td style="padding:6px 0;color:#7A8696;">Error type</td><td style="padding:6px 0;font-weight:700;">${opts.errorType}</td></tr>` : ""}
      ${opts.recipient ? `<tr><td style="padding:6px 0;color:#7A8696;">Recipient</td><td style="padding:6px 0;">${opts.recipient}</td></tr>` : ""}
      ${opts.subject ? `<tr><td style="padding:6px 0;color:#7A8696;">Subject</td><td style="padding:6px 0;">${opts.subject}</td></tr>` : ""}
      ${opts.logId ? `<tr><td style="padding:6px 0;color:#7A8696;">Log ID</td><td style="padding:6px 0;font-family:monospace;font-size:12px;">${opts.logId}</td></tr>` : ""}
    </table>
    <p><a href="${logsLink}" style="display:inline-block;background:#0E9384;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;">View email logs →</a></p>
  </body></html>`;

  await sendSystemAlertEmail(`[Dental Scotland] ${opts.title}`, html);
}

export async function checkFailureRateAndAlert(failedLogId: string) {
  const cfg = await getEmailSettings();
  const since = new Date(Date.now() - cfg.failureWindowMinutes * 60 * 1000);

  if (cfg.lastSpikeAlertAt && Date.now() - cfg.lastSpikeAlertAt.getTime() < SPIKE_ALERT_COOLDOWN_MS) {
    return;
  }

  const recentFailures = await db.emailLog.count({
    where: {
      status: { in: ["failed", "deferred", "bounced"] },
      createdAt: { gte: since },
    },
  });

  if (recentFailures < cfg.failureThreshold) return;

  try {
    await db.emailSettings.upsert({
      where: { id: "default" },
      update: { lastSpikeAlertAt: new Date() },
      create: { id: "default", lastSpikeAlertAt: new Date() },
    });
  } catch {
    // non-fatal
  }

  await sendEmailIssueAlert({
    title: `High email failure rate detected`,
    detail: `${recentFailures} email(s) failed in the last ${cfg.failureWindowMinutes} minutes (threshold: ${cfg.failureThreshold}). Investigate delivery issues immediately.`,
    errorType: "delivery",
    logId: failedLogId,
  });

  log.warn("email.failure.spike", {
    recentFailures,
    windowMinutes: cfg.failureWindowMinutes,
    threshold: cfg.failureThreshold,
  });
}

export async function handleEmailFailureAlert(opts: {
  logId: string;
  to: string;
  subject: string;
  errorType: EmailErrorType;
  errorMessage: string;
  retryCount: number;
  maxRetries: number;
}) {
  const criticalTypes: EmailErrorType[] = ["auth", "connection", "rate_limit", "queue"];
  const shouldAlert =
    criticalTypes.includes(opts.errorType) ||
    opts.errorType === "bounce" ||
    (opts.errorType === "retry" && opts.retryCount >= opts.maxRetries);

  if (shouldAlert) {
    const titles: Record<string, string> = {
      auth: "Email authentication failure",
      connection: "Email service connection error",
      rate_limit: "Email provider rate limit hit",
      bounce: "Email bounced",
      queue: "Email queue failure",
      retry: "Email delivery retries exhausted",
      delivery: "Email delivery failure",
      unknown: "Email delivery failure",
    };

    await sendEmailIssueAlert({
      title: titles[opts.errorType] || titles.unknown,
      detail: opts.errorMessage,
      errorType: opts.errorType,
      logId: opts.logId,
      recipient: opts.to,
      subject: opts.subject,
    });
  }

  await checkFailureRateAndAlert(opts.logId);
}

export type EmailLogFilters = {
  status?: string;
  errorType?: string;
  to?: string;
  q?: string;
  from?: Date;
  toDate?: Date;
  page?: number;
  pageSize?: number;
};

export async function queryEmailLogs(filters: EmailLogFilters) {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize || 25));
  const where: Record<string, unknown> = {};

  if (filters.status && filters.status !== "all") where.status = filters.status;
  if (filters.errorType && filters.errorType !== "all") where.errorType = filters.errorType;
  if (filters.to?.trim()) where.to = { contains: filters.to.trim().toLowerCase() };
  if (filters.q?.trim()) {
    where.OR = [
      { subject: { contains: filters.q.trim(), mode: "insensitive" } },
      { to: { contains: filters.q.trim().toLowerCase() } },
      { errorMessage: { contains: filters.q.trim(), mode: "insensitive" } },
    ];
  }
  if (filters.from || filters.toDate) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }

  const [rows, total, statusCounts] = await Promise.all([
    db.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        to: true,
        fromAddress: true,
        subject: true,
        status: true,
        provider: true,
        providerMessageId: true,
        category: true,
        errorCode: true,
        errorMessage: true,
        errorType: true,
        retryCount: true,
        maxRetries: true,
        parentLogId: true,
        patientId: true,
        sentAt: true,
        createdAt: true,
      },
    }),
    db.emailLog.count({ where }),
    db.emailLog.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: filters.from || filters.toDate ? { createdAt: where.createdAt as object } : undefined,
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const s of statusCounts) counts[s.status] = s._count._all;

  return { rows, total, page, pageSize, counts };
}

export async function getEmailLogDetail(id: string) {
  return db.emailLog.findUnique({ where: { id } });
}
