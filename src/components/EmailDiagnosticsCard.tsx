"use client";

import FormSubmitButton from "@/components/FormSubmitButton";
import { sendAdminTestEmail } from "@/app/admin/actions";

export default function EmailDiagnosticsCard({
  email,
  configured,
  via,
  fromAddress,
}: {
  email: string;
  configured: boolean;
  via: "gmail" | "resend" | "none";
  fromAddress: string;
}) {
  return (
    <div className="card" style={{ padding: 26, maxWidth: 480 }}>
      <div style={{ fontSize: 16, fontWeight: 800 }}>Email delivery</div>
      <div style={{ fontSize: 13, color: "#7A8696", marginTop: 4, lineHeight: 1.55 }}>
        Outbound email status on this server. Use the test button to verify mail reaches your inbox.
      </div>

      <div
        style={{
          marginTop: 18,
          padding: "12px 14px",
          borderRadius: 12,
          background: configured ? "#F0FBF8" : "#FFF8ED",
          border: `1px solid ${configured ? "#B8E8DF" : "#F0D9A8"}`,
          fontSize: 13,
          lineHeight: 1.6,
          color: "#3C4a59",
        }}
      >
        <div>
          <strong>Status:</strong> {configured ? "Configured" : "Not configured"}
        </div>
        <div>
          <strong>Provider:</strong> {via === "gmail" ? "Gmail OAuth" : via === "resend" ? "Resend" : "—"}
        </div>
        <div>
          <strong>From:</strong> {fromAddress}
        </div>
        <div>
          <strong>Test recipient:</strong> {email}
        </div>
      </div>

      <form action={sendAdminTestEmail} style={{ marginTop: 18 }}>
        <FormSubmitButton
          className="btn btn-teal"
          style={{ width: "100%", padding: 13 }}
          label="Send test email to my inbox"
          pendingLabel="Sending…"
          disabled={!configured}
        />
      </form>

      {!configured ? (
        <p style={{ fontSize: 12.5, color: "#7A8696", marginTop: 12, lineHeight: 1.6 }}>
          Add <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, and <code>GMAIL_REFRESH_TOKEN</code> in
          Vercel → Production, then redeploy. Re-authorise at{" "}
          <a href="/api/auth/google" style={{ color: "#0E9384" }}>
            /api/auth/google
          </a>{" "}
          if sends fail.
        </p>
      ) : (
        <p style={{ fontSize: 12.5, color: "#7A8696", marginTop: 12, lineHeight: 1.6 }}>
          If the test succeeds but you still do not see mail, check spam/promotions and confirm you are signed in with{" "}
          <strong>{email}</strong>.
        </p>
      )}
    </div>
  );
}
