"use client";

import FormSubmitButton from "@/components/FormSubmitButton";
import { changeAdminPassword } from "@/app/admin/actions";

export default function AdminPasswordForm({
  adminName,
  adminEmail,
}: {
  adminName: string;
  adminEmail: string;
}) {
  return (
    <form action={changeAdminPassword} className="card" style={{ padding: 26, maxWidth: 480 }}>
      <div style={{ fontSize: 16, fontWeight: 800 }}>Reset your password</div>
      <div style={{ fontSize: 13, color: "#7A8696", marginTop: 4, lineHeight: 1.55 }}>
        Signed in as <strong>{adminName}</strong> ({adminEmail}). Available to Admin and Super Admin.
      </div>

      <div style={{ marginTop: 18 }}>
        <label className="label">Current password</label>
        <input className="input" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="label">New password (min 8 characters)</label>
        <input className="input" name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="label">Confirm new password</label>
        <input className="input" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
      </div>

      <FormSubmitButton
        className="btn btn-teal"
        style={{ marginTop: 18, width: "100%", padding: 13 }}
        label="Update password"
        pendingLabel="Updating…"
      />
    </form>
  );
}
