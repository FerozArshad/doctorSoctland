// Identity gate for the secure proposal link: the patient requests a
// one-time code by email or WhatsApp, enters it, and the proposal unlocks.
import BrandLogo from "@/components/BrandLogo";
import { Suspense } from "react";
import { sendOtp, verifyOtp } from "@/app/p/actions";
import Toast from "@/components/Toast";

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return (user.length <= 2 ? user[0] + "•" : user.slice(0, 2) + "•••") + "@" + domain;
}
function maskPhone(phone: string) {
  const d = phone.replace(/\s/g, "");
  return d.length > 4 ? "••••• •••" + d.slice(-3) : phone;
}

export default function OtpGate({
  token,
  firstName,
  email,
  phone,
  sent,
  channel,
  devCode,
}: {
  token: string;
  firstName: string;
  email: string;
  phone: string;
  sent: boolean;
  channel: string;
  devCode?: string;
}) {
  const hasPhone = !!phone && phone !== "—";

  return (
    <div style={{ minHeight: "100vh", background: "#EAF0F2", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="ds-view" style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 30px 60px -30px rgba(11,24,40,.4)" }}>
          <div style={{ background: "#0B1828", padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <BrandLogo width={150} height={40} priority />
            <div style={{ color: "#8FA6C0", fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>Secure access</div>
          </div>
          <div style={{ padding: "32px 34px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.01em" }}>Hi {firstName} 👋</div>
            <div style={{ fontSize: 14, color: "#5C6a79", marginTop: 6, lineHeight: 1.65 }}>
              Your Invisalign proposal is ready. To keep your details private, we&apos;ll send a one-time code to confirm it&apos;s you.
            </div>

            {!sent ? (
              <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
                <form action={sendOtp}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="channel" value="email" />
                  <button className="btn btn-teal" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
                    ✉ &nbsp;Email a code to {maskEmail(email)}
                  </button>
                </form>
                {hasPhone && (
                  <form action={sendOtp}>
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="channel" value="whatsapp" />
                    <button className="btn btn-outline" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
                      💬 &nbsp;WhatsApp a code to {maskPhone(phone)}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <>
                <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 11, background: "#F0FBF8", border: "1px solid #CFEDE5", fontSize: 13.5, color: "#0B7A6E", fontWeight: 600 }}>
                  ✓ Code sent by {channel === "whatsapp" ? `WhatsApp to ${maskPhone(phone)}` : `email to ${maskEmail(email)}`} — it expires in 10 minutes.
                </div>
                {devCode && (
                  <div style={{ marginTop: 10, padding: "12px 16px", borderRadius: 11, background: "#FBF3E2", border: "1px solid #F0DFB6", fontSize: 13, color: "#B7791F", lineHeight: 1.6 }}>
                    <strong>Test mode:</strong> sending isn&apos;t configured yet, so your code is <strong style={{ fontSize: 16, letterSpacing: ".15em" }}>{devCode}</strong>
                    <br />(This disappears once email/WhatsApp keys are added.)
                  </div>
                )}
                <form action={verifyOtp} style={{ marginTop: 18 }}>
                  <input type="hidden" name="token" value={token} />
                  <label className="label">Enter your 6-digit code</label>
                  <input
                    className="input"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="••••••"
                    style={{ fontSize: 22, letterSpacing: ".45em", textAlign: "center", fontWeight: 800, padding: "13px" }}
                  />
                  <button className="btn btn-teal" style={{ width: "100%", marginTop: 14 }}>Unlock my proposal →</button>
                </form>
                <form action={sendOtp} style={{ marginTop: 14, textAlign: "center" }}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="channel" value={channel} />
                  <button style={{ background: "none", border: "none", color: "#0E9384", fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
                    Didn&apos;t get it? Send a new code
                  </button>
                </form>
              </>
            )}

            <div style={{ fontSize: 12.5, color: "#9AA6B4", marginTop: 20, lineHeight: 1.6, textAlign: "center" }}>
              Already have an account? <a href="/login" style={{ color: "#0E9384", fontWeight: 700 }}>Log in with your password</a>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", color: "#7A8696", fontSize: 12.5, marginTop: 18 }}>
          Dental Scotland · It&apos;s time to smile · dentalscotland.com
        </div>
      </div>
      <Suspense>
        <Toast />
      </Suspense>
    </div>
  );
}
