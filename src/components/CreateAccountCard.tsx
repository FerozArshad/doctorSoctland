"use client";
// First-visit password setup — turns the secure link into a patient account.
import { useState } from "react";
import { setPatientPassword } from "@/app/p/actions";

export default function CreateAccountCard({ token, email }: { token: string; email: string }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");

  return (
    <div style={{ margin: "28px 0 0", border: "1.5px solid #CFEDE5", background: "#F4FCFA", borderRadius: 16, padding: "20px 22px" }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>Create your patient account</div>
      <div style={{ fontSize: 13.5, color: "#5C6a79", marginTop: 3, lineHeight: 1.6 }}>
        Set a password so you can log back in any time at <strong>dentalscotland.com</strong> to watch your video, review your plan and pay — using <strong>{email}</strong>.
      </div>
      <form
        action={setPatientPassword}
        onSubmit={(e) => {
          if (pw.length < 8) { e.preventDefault(); setErr("Password must be at least 8 characters."); return; }
          if (pw !== pw2) { e.preventDefault(); setErr("Passwords don't match."); return; }
        }}
        style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}
      >
        <input type="hidden" name="token" value={token} />
        <input
          className="input" type="password" name="password" placeholder="Choose a password (8+ characters)"
          value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }}
          style={{ flex: 1, minWidth: 180, marginTop: 0 }}
        />
        <input
          className="input" type="password" placeholder="Repeat password"
          value={pw2} onChange={(e) => { setPw2(e.target.value); setErr(""); }}
          style={{ flex: 1, minWidth: 180, marginTop: 0 }}
        />
        <button className="btn btn-teal" style={{ padding: "11px 22px", fontSize: 14 }}>Create account</button>
      </form>
      {err && <div style={{ color: "#C23B34", fontSize: 13, fontWeight: 600, marginTop: 8 }}>{err}</div>}
    </div>
  );
}
