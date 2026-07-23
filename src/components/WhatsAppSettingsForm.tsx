"use client";

import FormSubmitButton from "@/components/FormSubmitButton";
import { saveWhatsAppSettings, testWhatsAppConnection } from "@/app/admin/actions";

type Cfg = {
  token: string;
  phoneNumberId: string;
  templatesEnabled: boolean;
  templateLang: string;
  tplProposal: string;
  tplReminder: string;
  tplLogin: string;
  webhookVerifyToken: string;
  metaAppSecret: string;
  adminNotifyWhatsApp: string;
  source: string;
};

function maskSecret(value: string) {
  const v = value.trim();
  if (!v) return "";
  if (v.length <= 8) return "••••••••";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export default function WhatsAppSettingsForm({
  cfg,
  appUrl,
}: {
  cfg: Cfg;
  appUrl: string;
}) {
  const connected = !!(cfg.token && cfg.phoneNumberId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>WhatsApp Cloud API</div>
            <div style={{ fontSize: 13, color: "#7A8696", marginTop: 4, lineHeight: 1.55 }}>
              Paste credentials from Meta → WhatsApp → API Setup. Saved in the shared database so{" "}
              <strong>local and production</strong> both use the same connection.
            </div>
          </div>
          <span
            className="badge"
            style={{
              background: connected ? "#E6F6EA" : "#FBF3E2",
              color: connected ? "#1C7C3A" : "#B7791F",
              padding: "6px 11px",
            }}
          >
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>
        <div style={{ marginTop: 12, fontSize: 12.5, color: "#8A96A5" }}>
          Active source: <strong>{cfg.source}</strong>
          {cfg.phoneNumberId ? ` · Phone Number ID ${cfg.phoneNumberId}` : ""}
          {cfg.token ? ` · Token ${maskSecret(cfg.token)}` : ""}
        </div>
        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 11, background: "#FBE9E8", border: "1px solid #F0C4C0", fontSize: 13, color: "#8A2E2A", lineHeight: 1.55 }}>
          <strong>If messages show “accepted” but patients never receive them:</strong> Meta is blocking delivery with billing error{" "}
          <code>131042</code>. Fix in{" "}
          <a href="https://business.facebook.com/settings/whatsapp-business-accounts" target="_blank" rel="noreferrer" style={{ color: "#8A2E2A", fontWeight: 700 }}>
            Meta Business Suite → WhatsApp Accounts → Billing
          </a>
          : assign an active payment method (and tax info) to the <em>WhatsApp</em> account — not only the Business Manager wallet.
        </div>
      </div>

      <form action={saveWhatsAppSettings} className="card" style={{ padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Connection</div>
        <div style={{ fontSize: 12.5, color: "#7A8696", marginBottom: 16, lineHeight: 1.5 }}>
          Leave token / secret fields blank to keep the current value.
        </div>

        <label className="label">Phone Number ID *</label>
        <input className="input" name="phoneNumberId" defaultValue={cfg.phoneNumberId} placeholder="1186752691194998" required />

        <div style={{ marginTop: 14 }}>
          <label className="label">Permanent access token (System User)</label>
          <input
            className="input"
            name="token"
            type="password"
            autoComplete="new-password"
            placeholder={cfg.token ? `Saved: ${maskSecret(cfg.token)} — paste to replace` : "EAAG…"}
          />
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 16, cursor: "pointer" }}>
          <input type="checkbox" name="templatesEnabled" defaultChecked={cfg.templatesEnabled} style={{ width: 17, height: 17, accentColor: "#0E9384", marginTop: 1 }} />
          <span style={{ fontSize: 13, color: "#3C4a59", lineHeight: 1.5 }}>
            <strong>Templates enabled</strong> — send approved Meta templates for proposals, reminders, and login codes
          </span>
        </label>

        <div style={{ marginTop: 14 }}>
          <label className="label">Template language</label>
          <input className="input" name="templateLang" defaultValue={cfg.templateLang || "en_GB"} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
          <div>
            <label className="label">Proposal template</label>
            <input className="input" name="tplProposal" defaultValue={cfg.tplProposal} />
          </div>
          <div>
            <label className="label">Reminder template</label>
            <input className="input" name="tplReminder" defaultValue={cfg.tplReminder} />
          </div>
          <div>
            <label className="label">Login OTP template</label>
            <input className="input" name="tplLogin" defaultValue={cfg.tplLogin} />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label className="label">Practice alert WhatsApp (E.164)</label>
          <input className="input" name="adminNotifyWhatsApp" defaultValue={cfg.adminNotifyWhatsApp} placeholder="+447915357177" />
        </div>

        <div style={{ fontSize: 15, fontWeight: 800, margin: "22px 0 8px" }}>Webhook</div>
        <div style={{ fontSize: 12.5, color: "#7A8696", marginBottom: 12, lineHeight: 1.55 }}>
          Meta callback URL (read-only):{" "}
          <code style={{ fontSize: 12 }}>{appUrl.replace(/\/$/, "")}/api/whatsapp/webhook</code>
        </div>

        <label className="label">Verify token</label>
        <input
          className="input"
          name="webhookVerifyToken"
          defaultValue={cfg.webhookVerifyToken}
          placeholder="Same value as in Meta → WhatsApp → Configuration"
        />

        <div style={{ marginTop: 14 }}>
          <label className="label">Meta App Secret</label>
          <input
            className="input"
            name="metaAppSecret"
            type="password"
            autoComplete="new-password"
            placeholder={cfg.metaAppSecret ? `Saved: ${maskSecret(cfg.metaAppSecret)} — paste to replace` : "From App settings → Basic"}
          />
        </div>

        <FormSubmitButton
          className="btn btn-teal"
          style={{ marginTop: 20, width: "100%", padding: 13 }}
          label="Save WhatsApp settings"
          pendingLabel="Saving…"
        />
      </form>

      <form action={testWhatsAppConnection} className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Test connection</div>
        <div style={{ fontSize: 13, color: "#7A8696", marginTop: 4, lineHeight: 1.5 }}>
          Calls Meta Graph with your saved Phone Number ID + token (no message is sent).
        </div>
        <FormSubmitButton
          className="btn btn-outline"
          style={{ marginTop: 14, padding: "11px 16px" }}
          label="Test Cloud API"
          pendingLabel="Testing…"
        />
      </form>
    </div>
  );
}
