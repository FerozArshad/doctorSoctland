"use client";

import { adminLogin } from "@/app/admin/actions";
import FormSubmitButton from "@/components/FormSubmitButton";

export default function AdminLoginForm() {
  return (
    <form action={adminLogin} style={{ marginTop: 20 }}>
      <label className="label">Email</label>
      <input className="input" name="email" type="email" required placeholder="concierge@dentalscotland.com" autoComplete="username" />
      <div style={{ marginTop: 14 }}>
        <label className="label">Password</label>
        <input className="input" name="password" type="password" required placeholder="••••••••" autoComplete="current-password" />
      </div>
      <FormSubmitButton label="Sign in →" pendingLabel="Signing in…" style={{ width: "100%", marginTop: 22 }} />
    </form>
  );
}
