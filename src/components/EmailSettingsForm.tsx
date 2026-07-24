"use client";

import FormSubmitButton from "@/components/FormSubmitButton";
import { saveEmailSettings } from "@/app/admin/actions";

type Props = {
  alertEmails: string[];
  failureThreshold: number;
  failureWindowMinutes: number;
};

export default function EmailSettingsForm({ alertEmails, failureThreshold, failureWindowMinutes }: Props) {
  return (
    <form action={saveEmailSettings} className="card" style={{ padding: 26, maxWidth: 720 }}>
      <div style={{ fontSize: 16, fontWeight: 800 }}>Email alert recipients</div>
      <p style={{ fontSize: 13, color: "#7A8696", marginTop: 6, lineHeight: 1.6 }}>
        One or more addresses to receive automatic alerts when email delivery fails, authentication breaks, rate limits
        are hit, or failure rates spike. Separate multiple addresses with commas or new lines.
      </p>

      <div style={{ marginTop: 18 }}>
        <label className="label">Alert email addresses</label>
        <textarea
          className="input"
          name="alertEmails"
          rows={4}
          defaultValue={alertEmails.join("\n")}
          placeholder="concierge@dentalscotland.com&#10;admin@example.com"
          style={{ resize: "vertical", minHeight: 96 }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 18 }}>
        <div>
          <label className="label">Failure threshold (count)</label>
          <input
            className="input"
            type="number"
            name="failureThreshold"
            min={1}
            max={100}
            defaultValue={failureThreshold}
          />
          <p style={{ fontSize: 12, color: "#7A8696", marginTop: 6 }}>Alert when this many emails fail within the window.</p>
        </div>
        <div>
          <label className="label">Failure window (minutes)</label>
          <input
            className="input"
            type="number"
            name="failureWindowMinutes"
            min={5}
            max={1440}
            defaultValue={failureWindowMinutes}
          />
          <p style={{ fontSize: 12, color: "#7A8696", marginTop: 6 }}>Rolling window for spike detection.</p>
        </div>
      </div>

      <FormSubmitButton
        className="btn btn-teal"
        style={{ marginTop: 22, width: "100%", padding: 13 }}
        label="Save email alert settings"
        pendingLabel="Saving…"
      />

      <p style={{ fontSize: 12.5, color: "#7A8696", marginTop: 14, lineHeight: 1.6 }}>
        If no addresses are set, alerts fall back to all admin logins and <code>ADMIN_NOTIFY_EMAIL</code> from env.
      </p>
    </form>
  );
}
