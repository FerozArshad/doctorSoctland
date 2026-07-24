import type { Activity, Patient } from "@prisma/client";
import {
  channelLabel,
  formatMessageDate,
  nextScheduledMessage,
  sentMessagesFromActivities,
  sequenceStatusLabel,
} from "@/lib/messages";
import { timeAgo } from "@/lib/status";

export default function MessageLog({
  patient,
  activities,
}: {
  patient: Pick<Patient, "id" | "firstName" | "lastName" | "status" | "proposalSentAt" | "sequenceTouch" | "priceLockExpired" | "phone" | "financeStatus" | "paymentPreference">;
  activities: Activity[];
}) {
  const sent = sentMessagesFromActivities(activities);
  const next = nextScheduledMessage(patient);
  const statusNote = sequenceStatusLabel(patient);
  const lastSent = sent[0] ?? null;

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Messages sent</div>
      <div style={{ fontSize: 12.5, color: "#7A8696", marginBottom: 16 }}>
        Automated proposal and follow-up emails — not a manual patient chat.
      </div>

      {next ? (
        <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 12, background: next.overdue ? "#FBE9E8" : next.dueToday ? "#FBF3E2" : "#F0FBF8", border: `1px solid ${next.overdue ? "#F0C4C0" : next.dueToday ? "#F0DCA8" : "#CFEDE5"}` }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: next.overdue ? "#C23B34" : next.dueToday ? "#B7791F" : "#0B7A6E" }}>
            {next.overdue ? "Overdue" : next.dueToday ? "Due today" : "Next message"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#16202E", marginTop: 6 }}>
            Follow-up {next.touch}/{next.total} — {next.label}
          </div>
          <div style={{ fontSize: 13, color: "#5C6a79", marginTop: 4 }}>
            Scheduled {formatMessageDate(next.dueDate)} · {channelLabel(next.channel)}
          </div>
        </div>
      ) : statusNote ? (
        <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#F4F6F9", fontSize: 13, color: "#5C6a79", lineHeight: 1.5 }}>
          {statusNote}
        </div>
      ) : null}

      {lastSent && (
        <div style={{ marginBottom: 14, padding: "11px 14px", borderRadius: 11, background: "#FAFBFC", border: "1px solid #EEF2F6" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8A96A5" }}>Last sent</div>
          <div style={{ fontSize: 13.5, color: "#2C3847", marginTop: 4, lineHeight: 1.45 }}>{lastSent.summary}</div>
          <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 4 }}>
            {channelLabel(lastSent.channel)} · {timeAgo(lastSent.at)}
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "#8A96A5", marginBottom: 10 }}>
        Full history
      </div>
      {sent.length === 0 ? (
        <div style={{ fontSize: 13.5, color: "#9AA6B4" }}>No messages sent yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {sent.map((m) => (
            <div key={m.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: "1px solid #F1F4F8" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0E9384", marginTop: 6, flex: "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#2C3847", lineHeight: 1.45 }}>{m.summary}</div>
                <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 2 }}>
                  {channelLabel(m.channel)} · {formatMessageDate(m.at)} · {timeAgo(m.at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
