import Image from "next/image";
import AdminLoginForm from "@/components/AdminLoginForm";

export const dynamic = "force-dynamic";

export default function AdminLogin({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0E1A2B", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="ds-view" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <Image src="/logo.webp" alt="Dental Scotland" width={190} height={52} style={{ height: 52, width: "auto" }} />
        </div>
        <div style={{ background: "#fff", borderRadius: 20, padding: "34px 32px", boxShadow: "0 30px 60px -30px rgba(0,0,0,.6)" }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.01em" }}>Practice login</div>
          <div style={{ fontSize: 13.5, color: "#7A8696", marginTop: 4 }}>Invisalign proposals & payments dashboard</div>
          {searchParams.error === "locked" ? (
            <div style={{ marginTop: 16, padding: "11px 14px", borderRadius: 10, background: "#FBF3E2", color: "#B7791F", fontSize: 13.5, fontWeight: 600, lineHeight: 1.5 }}>
              Too many attempts — this account is temporarily locked. Please wait 15 minutes and try again.
            </div>
          ) : searchParams.error ? (
            <div style={{ marginTop: 16, padding: "11px 14px", borderRadius: 10, background: "#FBE9E8", color: "#C23B34", fontSize: 13.5, fontWeight: 600 }}>
              Incorrect email or password — please try again.
            </div>
          ) : null}
          <AdminLoginForm />
        </div>
        <div style={{ textAlign: "center", color: "#4E6178", fontSize: 12.5, marginTop: 18 }}>
          Dental Scotland · It&apos;s time to smile
        </div>
      </div>
    </div>
  );
}
