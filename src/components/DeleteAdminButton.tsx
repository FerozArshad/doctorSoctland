"use client";

import FormSubmitButton from "@/components/FormSubmitButton";
import { deleteAdminAccount } from "@/app/admin/actions";

export default function DeleteAdminButton({
  adminId,
  adminName,
}: {
  adminId: string;
  adminName: string;
}) {
  return (
    <form
      action={deleteAdminAccount}
      onSubmit={(e) => {
        if (
          !confirm(
            `Remove ${adminName} from the team?\n\nThey will lose login access immediately. Their patients stay in the system (owner cleared). This cannot be undone.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="adminId" value={adminId} />
      <FormSubmitButton
        className="btn btn-outline"
        style={{ padding: "7px 12px", fontSize: 12.5, color: "#C23B34", borderColor: "#F0C4C0" }}
        label="Remove"
        pendingLabel="Removing…"
      />
    </form>
  );
}
