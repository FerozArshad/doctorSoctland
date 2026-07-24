"use client";

import { useState } from "react";
import FormSubmitButton from "@/components/FormSubmitButton";
import { createAdminAccount } from "@/app/admin/actions";

export default function CreateAdminForm() {
  const [autoPassword, setAutoPassword] = useState(true);

  return (
    <form action={createAdminAccount} className="card" style={{ padding: 24 }} autoComplete="off">
      <div style={{ fontSize: 16, fontWeight: 800 }}>Add team member</div>
      <div style={{ fontSize: 13, color: "#7A8696", marginTop: 2, lineHeight: 1.6 }}>
        New accounts are always <strong>Admin</strong> (not Super Admin). Login details are emailed automatically.
      </div>
      <div style={{ marginTop: 18 }}>
        <label className="label">Full name *</label>
        <input className="input" name="name" placeholder="Millie Buchanan" required />
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="label">Email *</label>
        <input className="input" name="email" type="email" placeholder="name@example.com" required />
      </div>
      <div style={{ marginTop: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#3C4a59", cursor: "pointer" }}>
          <input type="checkbox" checked={autoPassword} onChange={(e) => setAutoPassword(e.target.checked)} />
          Auto-generate secure password &amp; email it
        </label>
      </div>
      {!autoPassword && (
        <div style={{ marginTop: 10 }}>
          <label className="label">Password * (min 8 characters)</label>
          <input className="input" name="password" type="password" minLength={8} required autoComplete="new-password" />
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <label className="label">Job title</label>
        <input className="input" name="role" placeholder="Treatment Coordinator" />
      </div>
      <div style={{ marginTop: 14, padding: "11px 13px", borderRadius: 11, background: "#F4F6F9", fontSize: 12.5, color: "#5C6a79", lineHeight: 1.5 }}>
        Access level: <strong>Admin</strong> only. There is no option to create additional Super Admins.
      </div>
      <FormSubmitButton className="btn btn-teal" style={{ marginTop: 20, width: "100%", padding: 13 }} label="Create admin user" pendingLabel="Creating…" />
    </form>
  );
}
