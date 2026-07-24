"use client";

import { useState } from "react";
import { resetAdminPasswordAndEmail, updateAdminBySuperAdmin } from "@/app/admin/actions";
import DeleteAdminButton from "@/components/DeleteAdminButton";
import FormSubmitButton from "@/components/FormSubmitButton";

type AdminRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
  patientCount: number;
  addedLabel: string;
};

export default function AdminTeamMemberCard({ admin, isSelf }: { admin: AdminRow; isSelf: boolean }) {
  const [open, setOpen] = useState(false);

  if (isSelf) {
    return (
      <div style={{ padding: "10px 14px", borderRadius: 10, background: "#F4F6F9", fontSize: 12.5, color: "#5C6a79" }}>
        Edit your profile or password in <strong>Settings</strong>.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", minWidth: 200 }}>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => setOpen((v) => !v)}
        style={{ padding: "7px 12px", fontSize: 12, whiteSpace: "nowrap" }}
      >
        {open ? "Close" : "Manage"}
      </button>

      {open && (
        <div
          style={{
            width: 280,
            padding: 14,
            borderRadius: 12,
            border: "1px solid #E7ECF2",
            background: "#FAFBFC",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <form action={updateAdminBySuperAdmin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="hidden" name="adminId" value={admin.id} />
            <div>
              <label className="label" style={{ fontSize: 11 }}>
                Full name
              </label>
              <input className="input" name="name" defaultValue={admin.name} required style={{ padding: "8px 10px", fontSize: 13 }} />
            </div>
            <div>
              <label className="label" style={{ fontSize: 11 }}>
                Email (login)
              </label>
              <input className="input" name="email" type="email" defaultValue={admin.email} required style={{ padding: "8px 10px", fontSize: 13 }} />
            </div>
            <div>
              <label className="label" style={{ fontSize: 11 }}>
                Job title
              </label>
              <input className="input" name="role" defaultValue={admin.role} style={{ padding: "8px 10px", fontSize: 13 }} />
            </div>
            <FormSubmitButton className="btn btn-teal" style={{ padding: "9px 12px", fontSize: 12.5, width: "100%" }} label="Save profile" pendingLabel="Saving…" />
          </form>

          <div style={{ borderTop: "1px solid #EEF2F6", paddingTop: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#5C6a79", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".04em" }}>
              Password reset
            </div>
            <p style={{ fontSize: 12, color: "#7A8696", margin: "0 0 10px", lineHeight: 1.45 }}>
              Generates a secure temporary password and emails login details. Limited to 5 resets per hour per admin.
            </p>
            <form action={resetAdminPasswordAndEmail} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input type="hidden" name="adminId" value={admin.id} />
              <input
                className="input"
                name="password"
                type="password"
                minLength={8}
                placeholder="Leave blank to auto-generate"
                autoComplete="new-password"
                style={{ padding: "8px 10px", fontSize: 12 }}
              />
              <FormSubmitButton
                className="btn btn-outline"
                style={{ padding: "9px 12px", fontSize: 12.5, width: "100%" }}
                label="Reset password & email login"
                pendingLabel="Sending…"
              />
            </form>
          </div>

          <div style={{ borderTop: "1px solid #EEF2F6", paddingTop: 10 }}>
            <DeleteAdminButton adminId={admin.id} adminName={admin.name} />
          </div>
        </div>
      )}
    </div>
  );
}
