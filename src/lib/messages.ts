import type { Activity, Patient } from "@prisma/client";
import { LOCK_DAYS, TOUCHES } from "./sequence";
import { receivesProposalFollowUps } from "./follow-ups";

export type MessageChannel = "email" | "whatsapp" | "both";

export type SentMessageRecord = {
  id: string;
  key: string;
  at: Date;
  channel: MessageChannel;
  summary: string;
  kind: "proposal" | "follow-up" | "finance" | "manual" | "other";
  failed: boolean;
};

export type UpcomingMessage = {
  key: string;
  patientId: string;
  patientName: string;
  touch: number;
  total: number;
  label: string;
  dueDate: Date;
  channel: MessageChannel;
  dueToday: boolean;
  overdue: boolean;
};

export type NotificationItem = {
  key: string;
  kind: "upcoming" | "sent" | "instalment";
  patientId: string;
  patientName: string;
  title: string;
  detail: string;
  at?: Date;
  dueDate?: Date;
  channel?: MessageChannel;
  dueToday?: boolean;
  overdue?: boolean;
  failed?: boolean;
  unread: boolean;
};

export type MessageNotifications = {
  items: NotificationItem[];
  upcoming: UpcomingMessage[];
  recentSent: Array<SentMessageRecord & { patientId: string; patientName: string; unread: boolean }>;
  alertCount: number;
};

const UNPAID_STATUSES = ["sent", "interested", "awaiting"];

export function isMessageActivity(text: string): boolean {
  return (
    text.startsWith("Proposal emailed") ||
    text.startsWith("WhatsApp sent") ||
    text.startsWith("WhatsApp accepted") ||
    text.startsWith("WhatsApp to ") ||
    text.startsWith("WhatsApp delivery") ||
    /^Follow-up \d+\/7 sent/.test(text) ||
    text.startsWith("Email sent:") ||
    text.includes("link emailed to patient") ||
    (text.includes("Email to ") && text.includes("failed"))
  );
}

function channelFromActivity(text: string): MessageChannel {
  if (text.startsWith("WhatsApp")) return "whatsapp";
  if (text.startsWith("Email sent:")) return "email";
  if (/^Follow-up 1\/7 sent/.test(text)) return "both";
  if (/^Follow-up \d+\/7 sent/.test(text)) return "email";
  if (text.startsWith("Proposal emailed")) return "email";
  return "email";
}

function kindFromActivity(text: string): SentMessageRecord["kind"] {
  if (text.startsWith("Proposal emailed") || text.startsWith("WhatsApp")) return "proposal";
  if (/^Follow-up \d+\/7 sent/.test(text)) return "follow-up";
  if (text.includes("Finance") || text.includes("finance")) return "finance";
  if (text.startsWith("Email sent:")) return "manual";
  return "other";
}

export function sentMessagesFromActivities(activities: Activity[]): SentMessageRecord[] {
  return activities
    .filter((a) => isMessageActivity(a.text))
    .map((a) => ({
      id: a.id,
      key: `sent:${a.id}`,
      at: a.createdAt,
      channel: channelFromActivity(a.text),
      summary: a.text,
      kind: kindFromActivity(a.text),
      failed: /failed|simulated/i.test(a.text),
    }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function nextScheduledMessage(
  p: Pick<Patient, "id" | "firstName" | "lastName" | "status" | "proposalSentAt" | "sequenceTouch" | "priceLockExpired" | "phone" | "financeStatus" | "paymentPreference">
): UpcomingMessage | null {
  if (p.status === "draft") return null;
  if (!receivesProposalFollowUps(p)) return null;
  if (p.sequenceTouch >= TOUCHES.length) return null;

  const next = TOUCHES.find((t) => t.n > p.sequenceTouch);
  if (!next) return null;

  const start = p.proposalSentAt ?? new Date();
  const dueDate = new Date(start.getTime() + next.day * 86400000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(dueDate);
  dueDay.setHours(0, 0, 0, 0);
  const hasPhone = !!p.phone && p.phone !== "—";

  return {
    key: `up:${p.id}:${next.n}`,
    patientId: p.id,
    patientName: `${p.firstName} ${p.lastName}`.trim(),
    touch: next.n,
    total: TOUCHES.length,
    label: next.label,
    dueDate,
    channel: next.n === 1 && hasPhone ? "both" : "email",
    dueToday: dueDay.getTime() === today.getTime(),
    overdue: dueDay.getTime() < today.getTime(),
  };
}

export function buildInstalmentNotifications(
  instalments: Array<{
    id: string;
    number: number;
    amountPence: number;
    dueDate: Date;
    status: string;
    patient: { id: string; firstName: string; lastName: string };
  }>,
  prefs: { readKeys?: string[]; dismissedKeys?: string[] } = {}
): NotificationItem[] {
  const read = new Set(prefs.readKeys || []);
  const dismissed = new Set(prefs.dismissedKeys || []);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today.getTime() + 3 * 86400000);

  return instalments
    .flatMap((inst) => {
      const patientName = `${inst.patient.firstName} ${inst.patient.lastName}`.trim();
      const dueDay = new Date(inst.dueDate);
      dueDay.setHours(0, 0, 0, 0);
      const overdue = inst.status === "failed" || (inst.status === "scheduled" && dueDay.getTime() < today.getTime());
      const dueToday = inst.status === "scheduled" && dueDay.getTime() === today.getTime();
      const dueSoon = inst.status === "scheduled" && inst.dueDate <= soon && !overdue;
      const key = `inst:${inst.id}`;
      if (dismissed.has(key)) return [];
      const when = formatMessageDate(inst.dueDate);
      const title = overdue
        ? `Instalment ${inst.number}/3 overdue`
        : dueToday
          ? `Instalment ${inst.number}/3 due today`
          : `Instalment ${inst.number}/3 due soon`;
      const detail = overdue
        ? `${patientName} · ${fmtPence(inst.amountPence)} · was due ${when}${inst.status === "failed" ? " · charge failed" : ""}`
        : `${patientName} · ${fmtPence(inst.amountPence)} · due ${when}`;
      return [
        {
          key,
          kind: "instalment" as const,
          patientId: inst.patient.id,
          patientName,
          title,
          detail,
          dueDate: inst.dueDate,
          dueToday,
          overdue,
          failed: inst.status === "failed",
          unread: !read.has(key) || overdue || dueToday || dueSoon,
        },
      ];
    })
    .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0));
}

function fmtPence(p: number) {
  return `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function buildMessageNotifications(
  patients: Array<
    Pick<Patient, "id" | "firstName" | "lastName" | "status" | "proposalSentAt" | "sequenceTouch" | "priceLockExpired" | "phone" | "financeStatus" | "paymentPreference"> & {
      activities: Activity[];
    }
  >,
  prefs: { readKeys?: string[]; dismissedKeys?: string[] } = {},
  instalments: Parameters<typeof buildInstalmentNotifications>[0] = []
): MessageNotifications {
  const read = new Set(prefs.readKeys || []);
  const dismissed = new Set(prefs.dismissedKeys || []);

  const recentSent = patients
    .flatMap((p) =>
      sentMessagesFromActivities(p.activities).map((m) => ({
        ...m,
        patientId: p.id,
        patientName: `${p.firstName} ${p.lastName}`.trim(),
        unread: !read.has(m.key),
      }))
    )
    .filter((m) => !dismissed.has(m.key))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 20);

  const upcoming = patients
    .map((p) => nextScheduledMessage(p))
    .filter((u): u is UpcomingMessage => u !== null)
    .filter((u) => !dismissed.has(u.key))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 15);

  const instalmentItems = buildInstalmentNotifications(instalments, prefs);

  const items: NotificationItem[] = [
    ...instalmentItems,
    ...upcoming.map((u) => ({
      key: u.key,
      kind: "upcoming" as const,
      patientId: u.patientId,
      patientName: u.patientName,
      title: u.patientName,
      detail: `Follow-up ${u.touch}/${u.total} · ${formatMessageDate(u.dueDate)}${u.overdue ? " · Overdue" : u.dueToday ? " · Due today" : ""}`,
      dueDate: u.dueDate,
      channel: u.channel,
      dueToday: u.dueToday,
      overdue: u.overdue,
      unread: !read.has(u.key) || u.dueToday || u.overdue,
    })),
    ...recentSent.map((m) => ({
      key: m.key,
      kind: "sent" as const,
      patientId: m.patientId,
      patientName: m.patientName,
      title: m.patientName,
      detail: m.summary,
      at: m.at,
      channel: m.channel,
      failed: m.failed,
      unread: m.unread || m.failed,
    })),
  ];

  const alertCount = items.filter((i) => i.unread || i.overdue || i.dueToday || i.failed).length;

  return { items, upcoming, recentSent, alertCount };
}

export function formatMessageDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function channelLabel(channel: MessageChannel): string {
  if (channel === "both") return "Email + WhatsApp";
  if (channel === "whatsapp") return "WhatsApp";
  return "Email";
}

export function sequenceStatusLabel(
  p: Pick<Patient, "status" | "proposalSentAt" | "sequenceTouch" | "priceLockExpired">
): string | null {
  if (p.status === "draft") return "Proposal not sent yet — no automated messages scheduled.";
  if (p.priceLockExpired) return `${LOCK_DAYS}-day sequence ended — resend the proposal to restart.`;
  if (p.status === "paid" || p.status === "deposit") return "Patient converted — follow-up sequence stopped.";
  if (p.sequenceTouch >= TOUCHES.length) return "All 7 follow-ups sent.";
  return null;
}
