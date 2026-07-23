"use client";

import { useRef, useState } from "react";
import { adminUploadPatientFile } from "@/app/admin/actions";
import FormSubmitButton from "@/components/FormSubmitButton";

export default function AdminFileUpload({ patientId }: { patientId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");

  return (
    <form
      action={adminUploadPatientFile}
      style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
    >
      <input type="hidden" name="patientId" value={patientId} />
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        required
        onChange={(e) => setName(e.target.files?.[0]?.name || "")}
        style={{ fontSize: 13, maxWidth: "100%" }}
      />
      <FormSubmitButton
        className="btn btn-outline"
        style={{ padding: "10px 14px", fontSize: 13 }}
        label={name ? `Upload ${name}` : "Upload file"}
        pendingLabel="Uploading…"
      />
      <span style={{ fontSize: 12, color: "#9AA6B4" }}>JPG, PNG, WebP or PDF · max 2 MB</span>
    </form>
  );
}
