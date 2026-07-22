"use client";
// Patient proposal: pick a payment route → optional note + uploads → consent
// popup with e-signature (required for full / deposit / finance).
import { useRef, useState, useTransition } from "react";
import ConsentModal, { Applicant, ConsentChoice } from "./ConsentModal";
import { uploadPatientFile } from "@/app/p/actions";

export type PayOption = {
  key: "full" | "deposit" | "finance";
  title: string;
  desc: string;
  priceTop?: string;
  price: string;
  priceSub?: string;
  strike?: string;
  tag?: string;
  cta: string;
};

type Uploaded = { id: string; fileName: string; sizeBytes: number };

export default function PaymentOptionsForm({
  token,
  options,
  applicant,
  initialUploads = [],
}: {
  token: string;
  options: PayOption[];
  applicant: Applicant;
  initialUploads?: Uploaded[];
}) {
  const [choice, setChoice] = useState<PayOption["key"]>(options[0]?.key ?? "full");
  const [note, setNote] = useState("");
  const [showConsent, setShowConsent] = useState(false);
  const [uploads, setUploads] = useState<Uploaded[]>(initialUploads);
  const [uploadError, setUploadError] = useState("");
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const selected = options.find((o) => o.key === choice)!;

  const onPickFile = (file: File | null) => {
    if (!file) return;
    setUploadError("");
    const fd = new FormData();
    fd.set("token", token);
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadPatientFile(fd);
      if (res.error) {
        setUploadError(res.error);
        return;
      }
      if (res.upload) setUploads((u) => [...u, res.upload!]);
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  return (
    <>
      <ConsentModal
        open={showConsent}
        onClose={() => setShowConsent(false)}
        token={token}
        choice={choice as ConsentChoice}
        note={note}
        applicant={applicant}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map((o) => {
          const active = o.key === choice;
          return (
            <label
              key={o.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 18px",
                borderRadius: 14,
                cursor: "pointer",
                position: "relative",
                border: active ? "2px solid #0E9384" : "1px solid #E7ECF2",
                background: active ? "#F4FCFA" : "#fff",
                margin: active && o.tag ? "6px 0 0" : 0,
              }}
            >
              {o.tag && (
                <span style={{ position: "absolute", top: -10, left: 16, background: "#0E9384", color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", padding: "3px 9px", borderRadius: 20, textTransform: "uppercase" }}>
                  {o.tag}
                </span>
              )}
              <input
                type="radio"
                name="choiceRadio"
                checked={active}
                onChange={() => setChoice(o.key)}
                style={{ accentColor: "#0E9384", width: 17, height: 17, flex: "none", cursor: "pointer" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{o.title}</div>
                <div style={{ fontSize: 12.5, color: "#5C6a79", marginTop: 2, lineHeight: 1.5 }}>{o.desc}</div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                {o.strike && <div style={{ fontSize: 12, color: "#9AA6B4", textDecoration: "line-through" }}>{o.strike}</div>}
                {o.priceTop && <div style={{ fontSize: 11, color: "#9AA6B4" }}>{o.priceTop}</div>}
                <div style={{ fontSize: 19, fontWeight: 800, color: active ? "#0B7A6E" : "#16202E" }}>
                  {o.price}
                  {o.priceSub && <span style={{ fontSize: 12, color: "#7A8696", fontWeight: 600 }}>{o.priceSub}</span>}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Optional message for our team — questions, preferred start date, anything…"
          className="input"
          style={{ marginTop: 0, resize: "vertical", fontSize: 13.5 }}
        />
      </div>

      {/* Uploads */}
      <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 12, border: "1px dashed #CBD4DE", background: "#FBFCFD" }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: "#16202E" }}>Upload documents (optional)</div>
        <div style={{ fontSize: 12.5, color: "#7A8696", marginTop: 4, lineHeight: 1.5 }}>
          Photos, ID, or a PDF (max 2&nbsp;MB each). Your Treatment Coordinator can see these on your record.
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={pending || uploads.length >= 5}
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          style={{ marginTop: 12, fontSize: 13, width: "100%" }}
        />
        {uploadError && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: "#C23B34", fontWeight: 600 }}>{uploadError}</div>
        )}
        {pending && <div style={{ marginTop: 8, fontSize: 12.5, color: "#0E9384", fontWeight: 600 }}>Uploading…</div>}
        {uploads.length > 0 && (
          <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {uploads.map((u) => (
              <li key={u.id} style={{ fontSize: 13, color: "#2C3847", display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontWeight: 600 }}>📎 {u.fileName}</span>
                <span style={{ color: "#9AA6B4", flex: "none" }}>{Math.round(u.sizeBytes / 1024)} KB</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        className="btn btn-teal"
        onClick={() => setShowConsent(true)}
        style={{ marginTop: 14, width: "100%", padding: 14, fontSize: 15 }}
      >
        {selected.cta}
      </button>
      <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 10, textAlign: "center", lineHeight: 1.6 }}>
        Next step: agree &amp; e-sign — then we continue to payment. Your Treatment Coordinator is notified.
      </div>
    </>
  );
}
