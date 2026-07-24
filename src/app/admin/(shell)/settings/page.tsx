import Link from "next/link";
import TopBar from "@/components/TopBar";
import AdminPasswordForm from "@/components/AdminPasswordForm";
import AdminProfileForm from "@/components/AdminProfileForm";
import EmailDiagnosticsCard from "@/components/EmailDiagnosticsCard";
import { requireAdmin } from "@/lib/auth";
import { emailConfigured } from "@/lib/notify";
import { gmailConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireAdmin();
  const configured = emailConfigured();
  const via = gmailConfigured() ? ("gmail" as const) : process.env.RESEND_API_KEY ? ("resend" as const) : ("none" as const);
  const fromAddress = process.env.EMAIL_FROM || "Dental Scotland <concierge@dentalscotland.com>";
  return (
    <>
      <TopBar title="Settings" sub="Your profile and password" />
      <div className="ds-scroll" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 480px))", gap: 18 }}>
          <AdminProfileForm name={me.name} email={me.email} role={me.role} isSuperAdmin={me.isSuperAdmin} />
          <AdminPasswordForm adminName={me.name} adminEmail={me.email} />
          <EmailDiagnosticsCard email={me.email} configured={configured} via={via} fromAddress={fromAddress} />
          {me.isSuperAdmin && (
            <div className="card" style={{ padding: 26, maxWidth: 480 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Email delivery logs</div>
              <p style={{ fontSize: 13, color: "#7A8696", marginTop: 6, lineHeight: 1.6 }}>
                View every outbound email, filter failures, retry sends, and configure alert recipients.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                <Link href="/admin/email" className="btn btn-teal" style={{ padding: "11px 18px", textDecoration: "none", fontSize: 14 }}>
                  Open email logs
                </Link>
                <Link href="/admin/email/settings" className="btn btn-outline" style={{ padding: "11px 18px", textDecoration: "none", fontSize: 14 }}>
                  Alert settings
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
