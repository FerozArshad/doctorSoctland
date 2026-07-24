/**
 * Sanitise activity / message text shown to admins in the UI.
 * Technical Meta/API errors stay in server logs only.
 */

function stripWhatsAppDetail(text: string): string {
  if (/delivered/i.test(text) && !/not delivered|failed|undeliverable/i.test(text)) return "WhatsApp delivered";
  if (/failed|undeliverable|not sent|simulated|not delivered|blocked/i.test(text)) return "WhatsApp not sent";
  if (/accepted|queued|^WhatsApp sent/i.test(text)) return "WhatsApp sent";
  return "WhatsApp not sent";
}

function stripEmailDetail(text: string): string {
  if (/failed/i.test(text)) return "Email not sent";
  if (text.startsWith("Proposal emailed")) return "Proposal email sent";
  if (text.startsWith("Email sent:")) return "Email sent";
  if (text.startsWith("Email to ")) return "Email sent";
  return text;
}

/** Activity feed, patient timeline, notifications — no API codes or phone numbers. */
export function publicActivityText(text: string): string {
  const t = text.trim();
  if (!t) return t;

  if (/^WhatsApp/i.test(t)) return stripWhatsAppDetail(t);

  if (t.startsWith("Proposal emailed") || t.startsWith("Email to ") || t.startsWith("Email sent:")) {
    return stripEmailDetail(t);
  }

  const followUp = t.match(/^Follow-up (\d+\/\d+) sent — (.+?)( · .+)?$/);
  if (followUp) {
    const base = `Follow-up ${followUp[1]} sent — ${followUp[2]}`;
    if (/WhatsApp failed|WhatsApp not sent|WhatsApp simulated/i.test(t)) return `${base} · WhatsApp not sent`;
    if (/WhatsApp queued|WhatsApp sent/i.test(t)) return `${base} · WhatsApp sent`;
    return base;
  }

  if (/^Instalment \d+\/3 failed/i.test(t)) {
    return t.replace(/failed — .+$/i, "failed");
  }

  // Strip embedded Meta / Graph API error tails if old records still have them.
  if (/code \d{5,6}|Meta |billing|WABA|Graph API/i.test(t)) {
    if (/WhatsApp/i.test(t)) return stripWhatsAppDetail(t);
    if (/email/i.test(t)) return stripEmailDetail(t);
    if (/failed|error/i.test(t)) return "Delivery error";
  }

  return t;
}

/** Message log + notification bell summaries. */
export function publicMessageSummary(text: string): string {
  return publicActivityText(text);
}
