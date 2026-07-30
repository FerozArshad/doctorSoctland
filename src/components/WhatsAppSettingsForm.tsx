"use client";

import { useEffect, useState } from "react";
import FormSubmitButton from "@/components/FormSubmitButton";
import { saveWhatsAppSettings, testWhatsAppConnection, registerWhatsAppPhone, sendWhatsAppTestMessage } from "@/app/admin/actions";

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
  wabaReviewStatus?: string;
  appLinked?: boolean;
  blockers: Array<{ entity: string; code: number; description: string; solution: string }>;
  summary: string;
};

type TemplateStatus = {
  key: string;
  label: string;
  name: string;
  status: string;
  language: string;
};

function templateBadge(status: string) {
  if (status === "APPROVED") return { label: "Approved", bg: "#E6F6EA", fg: "#1C7C3A" };
  if (status === "PENDING") return { label: "Pending Meta review", bg: "#FBF3E2", fg: "#B7791F" };
  if (status === "REJECTED") return { label: "Rejected", bg: "#FBE9E8", fg: "#C23B34" };
  return { label: "Not created", bg: "#F4F6F9", fg: "#7A8696" };
}

function maskSecret(value: string | null | undefined) {
  const v = (value || "").trim();
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
  const [health, setHealth] = useState<Health | null>(null);
  const [healthLoading, setHealthLoading] = useState(!!(cfg.token && cfg.phoneNumberId));
  const [templates, setTemplates] = useState<TemplateStatus[]>([]);

  useEffect(() => {
    if (!cfg.token || !cfg.phoneNumberId) {
      setHealth(null);
      setTemplates([]);
      setHealthLoading(false);
      return;
    }
    let cancelled = false;
    setHealthLoading(true);
    Promise.all([
      fetch("/api/admin/whatsapp/health", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/admin/whatsapp/templates", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([healthJson, templateJson]) => {
        if (cancelled) return;
        if (!healthJson || typeof healthJson !== "object") setHealth(null);
        else {
          setHealth({
            ...healthJson,
            blockers: Array.isArray(healthJson.blockers) ? healthJson.blockers : [],
            summary: typeof healthJson.summary === "string" ? healthJson.summary : "WhatsApp health unavailable",
          });
        }
        setTemplates(Array.isArray(templateJson) ? templateJson : []);
      })
      .catch(() => {
        if (!cancelled) {
          setHealth(null);
          setTemplates([]);
        }
      })
      .finally(() => {
        if (!cancelled) setHealthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cfg.token, cfg.phoneNumberId]);

  const connected = !!(cfg.token && cfg.phoneNumberId);
  const blocked = !!(health && !health.ok);
  const published = !!(health?.verifiedName && health?.displayPhone);
  const proposalTpl = templates.find((t) => t.key === "proposal");
  const templatesReady = proposalTpl?.status === "APPROVED";
  const templatesPending = proposalTpl?.status === "PENDING";

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
              background: blocked ? "#FBE9E8" : connected && templatesReady ? "#E6F6EA" : connected && templatesPending ? "#FBF3E2" : connected ? "#E6F6EA" : "#FBF3E2",
              color: blocked ? "#C23B34" : connected && templatesReady ? "#1C7C3A" : connected && templatesPending ? "#B7791F" : connected ? "#1C7C3A" : "#B7791F",
              padding: "6px 11px",
            }}
          >
            {blocked ? "Messaging blocked" : connected && templatesPending ? "Templates pending" : connected ? "Ready to send" : "Not connected"}
          </span>
        </div>
        {published && (
          <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#F4FCFA", border: "1px solid #CFEDE5", fontSize: 13, lineHeight: 1.5, color: "#0B7A6E" }}>
            <strong>Published on WhatsApp:</strong> {health?.verifiedName} · {health?.displayPhone}
            {blocked && (
              <span style={{ display: "block", marginTop: 6, color: "#8A5A12" }}>
                Display name is approved, but Meta still blocks outbound messages until the business account (WABA) is fully active — see blockers below.
              </span>
            )}
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 12.5, color: "#8A96A5" }}>
          Active source: <strong>{cfg.source}</strong>
          {cfg.phoneNumberId ? ` · Phone Number ID ${cfg.phoneNumberId}` : ""}
          {cfg.token ? ` · Token ${maskSecret(cfg.token)}` : ""}
        </div>

        {templates.length > 0 && (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 11, background: "#F6F9FA", border: "1px solid #EEF2F6" }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Message templates (live from Meta)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {templates.map((t) => {
                const badge = templateBadge(t.status);
                return (
                  <div key={t.key} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", fontSize: 13 }}>
                    <span>
                      <strong>{t.name}</strong> · {t.label} <span style={{ color: "#9AA6B4" }}>({t.language})</span>
                    </span>
                    <span className="badge" style={{ background: badge.bg, color: badge.fg, padding: "4px 8px", fontSize: 11.5 }}>
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {templatesPending && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: "#8A5A12", lineHeight: 1.55 }}>
                Proposal WhatsApp messages cannot send until <strong>payment_reminder</strong> is approved. Meta usually reviews within a few hours (sometimes 24–48h). Email proposals still work.
              </div>
            )}
          </div>
        )}

        {healthLoading && connected && (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 11, background: "#F4F6F9", fontSize: 13, color: "#7A8696" }}>
            Checking Meta health…
          </div>
        )}

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
            {health.wabaReviewStatus || health.appLinked !== undefined ? (
              <div style={{ marginTop: 6, opacity: 0.9 }}>
                {health.wabaReviewStatus ? <>WABA review: <strong>{health.wabaReviewStatus}</strong></> : null}
                {health.appLinked !== undefined ? (
                  <>
                    {health.wabaReviewStatus ? " · " : ""}
                    Meta app linked: <strong>{health.appLinked ? "Yes" : "No — link app in Business Settings"}</strong>
                  </>
                ) : null}
              </div>
            ) : null}
            {blocked && (health.blockers ?? []).length > 0 && (
              <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
                {(health.blockers ?? []).map((b) => (
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
        <input className="input" name="phoneNumberId" defaultValue={cfg.phoneNumberId} placeholder="1240334725831342" required />
        <div style={{ fontSize: 12, color: "#7A8696", marginTop: 6 }}>
          WABA ID (reference only — do not use for sends): <code>2294276881326866</code>
        </div>

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

        <div className="ds-form-3col" style={{ marginTop: 14 }}>
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
        <div style={{ fontSize: 12.5, color: "#7A8696", marginBottom: 12, lineHeight: 1.6 }}>
          <strong>Callback URL</strong> (paste in Meta → WhatsApp → Configuration):<br />
          <code style={{ fontSize: 12, wordBreak: "break-all" }}>{appUrl.replace(/\/$/, "")}/api/whatsapp/webhook</code>
          <div style={{ marginTop: 10 }}>
            Opening that URL in a browser should show <em>“WhatsApp webhook endpoint is active”</em> — not an error.
            Meta verifies with a signed GET (<code>hub.mode=subscribe</code>). Events arrive via POST signed with your App Secret.
          </div>
          <ol style={{ margin: "10px 0 0", paddingLeft: 18 }}>
            <li>Paste the callback URL above → click <strong>Verify and save</strong></li>
            <li>Verify token below must match Meta <strong>exactly</strong> (save here first, then Meta)</li>
            <li>Click <strong>Manage</strong> webhook fields → subscribe to <strong>messages</strong> (includes delivery statuses)</li>
            <li>Save <strong>Meta App Secret</strong> below — required for secure POST in production</li>
          </ol>
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

      <form action={sendWhatsAppTestMessage} className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Send test message</div>
        <div style={{ fontSize: 13, color: "#7A8696", marginTop: 4, lineHeight: 1.55 }}>
          Sends Meta&apos;s pre-approved <code>hello_world</code> template. Use a <strong>personal</strong> mobile — not +44 7915 357177.
        </div>
        <div style={{ marginTop: 14 }}>
          <label className="label">Recipient mobile</label>
          <input className="input" name="phone" placeholder="03186615562 or +923186615562" required />
        </div>
        <FormSubmitButton
          className="btn btn-teal"
          style={{ marginTop: 14, padding: "11px 16px", width: "100%" }}
          label="Send hello_world test"
          pendingLabel="Sending…"
        />
      </form>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Recreate message templates in Meta</div>
        <div style={{ fontSize: 13, color: "#7A8696", marginTop: 6, lineHeight: 1.6 }}>
          WhatsApp Manager → <strong>Message templates</strong> → Create. Language: <strong>English (UK)</strong> (<code>en_GB</code>).
          Variables cannot be at the very start or end of the body.
        </div>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12, fontSize: 13, lineHeight: 1.55 }}>
          <div style={{ padding: 12, borderRadius: 10, background: "#F6F9FA", border: "1px solid #EEF2F6" }}>
            <strong>payment_reminder</strong> (Utility) — proposal send<br />
            <span style={{ color: "#5C6B7A" }}>
              Hello {"{{1}}"}, your personalised treatment plan from Dental Scotland is ready. Open your secure proposal here: {"{{2}}"} Thanks, Dental Scotland.
            </span>
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: "#F6F9FA", border: "1px solid #EEF2F6" }}>
            <strong>porposal_ready</strong> (Utility) — reminder<br />
            <span style={{ color: "#5C6B7A" }}>
              Hello {"{{1}}"}, a reminder that your Dental Scotland treatment proposal is waiting. View it here: {"{{2}}"} Thanks, Dental Scotland.
            </span>
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: "#F6F9FA", border: "1px solid #EEF2F6" }}>
            <strong>login_code</strong> (Authentication) — OTP<br />
            <span style={{ color: "#5C6B7A" }}>
              {"{{1}}"} is your verification code. For your security, do not share this code.
            </span>
            <div style={{ marginTop: 6, fontSize: 12, color: "#7A8696" }}>Add a URL button with dynamic suffix for copy-code flow if required by Meta.</div>
          </div>
        </div>
      </div>

      <form action={registerWhatsAppPhone} className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Register phone with Cloud API</div>
        <div style={{ fontSize: 13, color: "#7A8696", marginTop: 4, lineHeight: 1.55 }}>
          If Meta shows WABA status <strong>Onboarding</strong> or error <code>141008</code>, complete registration
          for Phone Number ID <strong>{cfg.phoneNumberId || "1240334725831342"}</strong> (not WABA <code>2294276881326866</code>). Uses Meta&apos;s{" "}
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
