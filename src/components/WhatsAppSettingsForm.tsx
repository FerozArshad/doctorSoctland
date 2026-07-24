"use client";

import FormSubmitButton from "@/components/FormSubmitButton";
import { saveWhatsAppSettings, testWhatsAppConnection, registerWhatsAppPhone } from "@/app/admin/actions";

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

type Health = {
  ok: boolean;
  canSendMessage: string;
  displayPhone: string;
  verifiedName: string;
  wabaId: string;
  blockers: Array<{ entity: string; code: number; description: string; solution: string }>;
  summary: string;
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
  health,
}: {
  cfg: Cfg;
  appUrl: string;
  health: Health | null;
}) {
  const connected = !!(cfg.token && cfg.phoneNumberId);
  const blocked = !!(health && !health.ok);

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
              background: blocked ? "#FBE9E8" : connected ? "#E6F6EA" : "#FBF3E2",
              color: blocked ? "#C23B34" : connected ? "#1C7C3A" : "#B7791F",
              padding: "6px 11px",
            }}
          >
            {blocked ? "Blocked by Meta" : connected ? "Connected" : "Not connected"}
          </span>
        </div>
        <div style={{ marginTop: 12, fontSize: 12.5, color: "#8A96A5" }}>
          Active source: <strong>{cfg.source}</strong>
          {cfg.phoneNumberId ? ` · Phone Number ID ${cfg.phoneNumberId}` : ""}
          {cfg.token ? ` · Token ${maskSecret(cfg.token)}` : ""}
        </div>

        {health && (
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 11,
              background: blocked ? "#FBE9E8" : "#E6F6EA",
              border: `1px solid ${blocked ? "#F0C4C0" : "#B7E4D4"}`,
              fontSize: 13,
              color: blocked ? "#8A2E2A" : "#1C7C3A",
              lineHeight: 1.55,
            }}
          >
            <strong>Live Meta health:</strong> {health.summary}
            {health.displayPhone ? (
              <div style={{ marginTop: 6, opacity: 0.9 }}>
                Number: {health.verifiedName || "WhatsApp"} · {health.displayPhone}
                {health.wabaId ? ` · WABA ${health.wabaId}` : ""}
              </div>
            ) : null}
            {blocked && health.blockers.length > 0 && (
              <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
                {health.blockers.map((b) => (
                  <li key={`${b.entity}-${b.code}-${b.description}`}>
                    <strong>
                      {b.entity}
                      {b.code ? ` ${b.code}` : ""}:
                    </strong>{" "}
                    {b.description}
                    {b.solution ? ` — ${b.solution}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {blocked && (
              <div style={{ marginTop: 10 }}>
                Open{" "}
                <a
                  href="https://business.facebook.com/latest/whatsapp_manager/overview"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#8A2E2A", fontWeight: 700 }}
                >
                  WhatsApp Manager → Account overview
                </a>{" "}
                for WABA <strong>Dental Scotland</strong> and activate / request review with Meta support.
                Payment cards alone will not fix error <code>141008</code> (WABA not active).
              </div>
            )}
          </div>
        )}

        {!health && connected && (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 11, background: "#FBF3E2", border: "1px solid #F0D9A8", fontSize: 13, color: "#8A5A12", lineHeight: 1.55 }}>
            Could not load Meta health status. Use <strong>Test Cloud API</strong> below.
          </div>
        )}
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
          Checks Meta Graph credentials <em>and</em> live WABA health (whether Meta will actually deliver).
        </div>
        <FormSubmitButton
          className="btn btn-outline"
          style={{ marginTop: 14, padding: "11px 16px" }}
          label="Test Cloud API"
          pendingLabel="Testing…"
        />
      </form>

      <form action={registerWhatsAppPhone} className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Register phone with Cloud API</div>
        <div style={{ fontSize: 13, color: "#7A8696", marginTop: 4, lineHeight: 1.55 }}>
          If Meta shows WABA status <strong>Onboarding</strong> or error <code>141008</code>, complete registration
          for Phone Number ID <strong>{cfg.phoneNumberId || "1186752691194998"}</strong> (not the WABA id). Uses Meta&apos;s{" "}
          <code>POST /&#123;phone-number-id&#125;/register</code> endpoint.{" "}
          <strong>Max 10 attempts per 72 hours</strong> — wrong PINs count toward the limit.
        </div>
        <div style={{ marginTop: 14 }}>
          <label className="label">6-digit two-step PIN</label>
          <input
            className="input"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete="off"
            placeholder="••••••"
            required
          />
        </div>
        <FormSubmitButton
          className="btn btn-teal"
          style={{ marginTop: 14, padding: "11px 16px", width: "100%" }}
          label="Register +44 7915 357177 with Meta"
          pendingLabel="Registering…"
        />
      </form>
    </div>
  );
}
