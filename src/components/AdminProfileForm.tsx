"use client";

import FormSubmitButton from "@/components/FormSubmitButton";
import { updateAdminProfile } from "@/app/admin/actions";

export default function AdminProfileForm({
  name,
  email,
  role,
  isSuperAdmin,
}: {
  name: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
}) {
  return (
    <form action={updateAdminProfile} className="card" style={{ padding: 26, maxWidth: 480 }}>
      <div style={{ fontSize: 16, fontWeight: 800 }}>Your profile</div>
      <div style={{ fontSize: 13, color: "#7A8696", marginTop: 4, lineHeight: 1.55 }}>
        Update how your name appears across the dashboard
        {isSuperAdmin ? " (Super Admin)" : " (Admin)"}.
      </div>

      <div style={{ marginTop: 18 }}>
        <label className="label">Full name</label>
        <input className="input" name="name" defaultValue={name} required placeholder="M. Arfan" />
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="label">Email (login)</label>
        <input className="input" name="email" type="email" defaultValue={email} required />
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="label">Job title</label>
        <input className="input" name="role" defaultValue={role} placeholder="Treatment Coordinator" />
      </div>

      <FormSubmitButton
        className="btn btn-teal"
        style={{ marginTop: 18, width: "100%", padding: 13 }}
        label="Save profile"
        pendingLabel="Saving…"
      />
    </form>
  );
}
