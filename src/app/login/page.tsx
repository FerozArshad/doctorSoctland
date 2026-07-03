import Image from "next/image";
import { patientLogin } from "../p/actions";

export const dynamic = "force-dynamic";

export default function PatientLoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div style={{ minHeight: "100vh", background: "#EAF0F2", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="ds-view" style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 30px 60px -30px rgba(11,24,40,.4)" }}>
          <div style={{ background: "#0E1A2B", padding: "26px 34px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Image src="/logo.webp" alt="Dental Scotland" width={150} height={40} style={{ height: 40, width: "auto" }} />
            <div style={{ color: "#8FA6C0", fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase" }}>Patient login</div>
          </div>
          <div style={{ padding: "32px 34px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.01em" }}>Welcome back</div>
            <div style={{ fontSize: 13.5, color: "#7A8696", marginTop: 4, lineHeight: 1.6 }}>
              Log in to view your Invisalign proposal, watch your smile video and manage payments.
            </div>
            {searchParams.error && (
              <div style={{ marginTop: 16, padding: "11px 14px", borderRadius: 10, background: "#FBE9E8", color: "#C23B34", fontSize: 13.5, fontWeight: 600 }}>
                Incorrect email or password. If you haven&apos;t created an account yet, use the secure link we emailed you.
              </div>
            )}
            <form action={patientLogin} style={{ marginTop: 20 }}>
              <label className="label">Email</label>
              <input className="input" name="email" type="email" required placeholder="you@example.com" />
              <div style={{ marginTop: 14 }}>
                <label className="label">Password</label>
                <input className="input" name="password" type="password" required placeholder="••••••••" />
              </div>
              <button className="btn btn-teal" style={{ width: "100%", marginTop: 22 }}>Log in →</button>
            </form>
            <div style={{ fontSize: 12.5, color: "#9AA6B4", marginTop: 18, lineHeight: 1.6, textAlign: "center" }}>
              First time here? Open the secure proposal link from your email or WhatsApp — you&apos;ll be invited to create your password there.
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", color: "#7A8696", fontSize: 12.5, marginTop: 18 }}>
          Dental Scotland · It&apos;s time to smile · dentalscotland.com
        </div>
      </div>
    </div>
  );
}
