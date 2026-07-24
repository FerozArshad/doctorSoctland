"use client";

import { useRef, useState } from "react";
import { adminUploadPatientFile } from "@/app/admin/actions";
import FormSubmitButton from "@/components/FormSubmitButton";

export default function AdminFileUpload({ patientId }: { patientId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);

  return (
    <form
      action={adminUploadPatientFile}
      style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
    >
      <input type="hidden" name="patientId" value={patientId} />
      <input
        ref={inputRef}
        type="file"
        name="files"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        multiple
        required
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          setNames(list.map((f) => f.name));
        }}
        style={{ fontSize: 13, maxWidth: "100%" }}
      />
      <FormSubmitButton
        className="btn btn-outline"
        style={{ padding: "10px 14px", fontSize: 13 }}
        label={
          names.length === 0
            ? "Upload files"
            : names.length === 1
              ? `Upload ${names[0]}`
              : `Upload ${names.length} files`
        }
        pendingLabel="Uploading…"
      />
      <span style={{ fontSize: 12, color: "#9AA6B4" }}>JPG, PNG, WebP or PDF · max 2 MB each · up to 5 files total</span>
    </form>
  );
}
