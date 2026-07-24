import Link from "next/link";
import AdminFileUpload from "@/components/AdminFileUpload";

export type AdminPatientFile = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

/** Admin upload + list — files appear on the patient pay link (view only). */
export default function AdminPatientFiles({
  patientId,
  proposalToken,
  files,
  compact = false,
  returnTo,
}: {
  patientId: string;
  proposalToken: string;
  files: AdminPatientFile[];
  compact?: boolean;
  returnTo?: string;
}) {
  return (
    <div className="card" style={{ padding: compact ? 18 : 24 }}>
      <div style={{ fontSize: compact ? 14 : 15, fontWeight: 800, marginBottom: 4 }}>Files &amp; documents</div>
      <div style={{ fontSize: 12.5, color: "#7A8696", marginBottom: 14, lineHeight: 1.55 }}>
        Upload consent forms, photos or PDFs — patients can <strong>view</strong> these on their proposal and when signing (up to 5 files).
        {files.length > 0 && (
          <>
            {" "}
            <Link href={`/p/${proposalToken}?preview=admin`} style={{ color: "#0E9384", fontWeight: 700 }}>
              Preview on proposal →
            </Link>
          </>
        )}
      </div>
      <AdminFileUpload patientId={patientId} returnTo={returnTo} />
      {files.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 13.5, color: "#9AA6B4" }}>No files yet — upload before sending the proposal.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {files.map((u) => (
            <a
              key={u.id}
              href={`/api/admin/patients/${patientId}/files/${u.id}`}
              download={u.fileName}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 11,
                border: "1px solid #EEF2F6",
                background: "#FBFCFD",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  📎 {u.fileName}
                </div>
                <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 2 }}>
                  {Math.round(u.sizeBytes / 1024)} KB · {u.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0E9384", flex: "none" }}>Download</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
