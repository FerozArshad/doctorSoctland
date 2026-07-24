import Link from "next/link";
import { redirect } from "next/navigation";
import TopBar from "@/components/TopBar";
import EmailSettingsForm from "@/components/EmailSettingsForm";
import { requireAdmin } from "@/lib/auth";
import { getEmailSettings } from "@/lib/email-settings";
import { emailConfigured } from "@/lib/notify";
import { gmailConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

export default async function EmailSettingsPage() {
  const me = await requireAdmin();
  if (!me.isSuperAdmin) redirect("/admin");

  const cfg = await getEmailSettings();

  return (
    <>
      <TopBar
        title="Email alerts"
        sub="Configure who receives delivery failure notifications"
        actions={
          <Link href="/admin/email" className="btn btn-outline" style={{ padding: "9px 16px", textDecoration: "none", fontSize: 13.5 }}>
            View logs
          </Link>
        }
      />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
          <div className="card" style={{ padding: 20, fontSize: 13, lineHeight: 1.65, color: "#5A6A7E" }}>
            <strong style={{ color: "#16202E" }}>Delivery status note:</strong> Gmail and Resend confirm when an email is
            accepted for sending (<em>sent</em>). True <em>delivered</em> and <em>bounced</em> statuses require provider
            webhooks — all sends are logged here with full API responses for troubleshooting.
            <div style={{ marginTop: 10 }}>
              Provider: {gmailConfigured() ? "Gmail OAuth" : emailConfigured() ? "Resend" : "Not configured"}
            </div>
          </div>
          <EmailSettingsForm
            alertEmails={cfg.alertEmails}
            failureThreshold={cfg.failureThreshold}
            failureWindowMinutes={cfg.failureWindowMinutes}
          />
        </div>
      </div>
    </>
  );
}
