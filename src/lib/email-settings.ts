import { db } from "./db";

export type EmailSettingsConfig = {
  alertEmails: string[];
  failureThreshold: number;
  failureWindowMinutes: number;
  lastSpikeAlertAt: Date | null;
};

const DEFAULTS: EmailSettingsConfig = {
  alertEmails: [],
  failureThreshold: 5,
  failureWindowMinutes: 15,
  lastSpikeAlertAt: null,
};

function parseEnvAlertEmails(): string[] {
  const raw = (process.env.ADMIN_NOTIFY_EMAIL || "").trim();
  if (!raw) return [];
  return raw
    .split(/[,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /.+@.+\..+/.test(e));
}

export async function getEmailSettings(): Promise<EmailSettingsConfig> {
  try {
    const row = await db.emailSettings.findUnique({ where: { id: "default" } });
    if (!row) {
      return { ...DEFAULTS, alertEmails: parseEnvAlertEmails() };
    }
    const dbEmails = row.alertEmails.map((e) => e.trim().toLowerCase()).filter(Boolean);
    return {
      alertEmails: dbEmails.length > 0 ? dbEmails : parseEnvAlertEmails(),
      failureThreshold: row.failureThreshold > 0 ? row.failureThreshold : DEFAULTS.failureThreshold,
      failureWindowMinutes: row.failureWindowMinutes > 0 ? row.failureWindowMinutes : DEFAULTS.failureWindowMinutes,
      lastSpikeAlertAt: row.lastSpikeAlertAt,
    };
  } catch {
    return { ...DEFAULTS, alertEmails: parseEnvAlertEmails() };
  }
}

export async function getAlertRecipientEmails(): Promise<string[]> {
  const cfg = await getEmailSettings();
  const recipients = new Set<string>();
  for (const e of cfg.alertEmails) recipients.add(e);
  if (recipients.size === 0) {
    const admins = await db.admin.findMany({ select: { email: true } });
    for (const a of admins) {
      const e = a.email.trim().toLowerCase();
      if (/.+@.+\..+/.test(e)) recipients.add(e);
    }
  }
  return Array.from(recipients);
}
