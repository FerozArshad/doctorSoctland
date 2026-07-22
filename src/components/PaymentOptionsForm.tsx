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
  compact = false,
}: {
  token: string;
  options: PayOption[];
  applicant: Applicant;
  initialUploads?: Uploaded[];
  compact?: boolean;
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

      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
        {options.map((o) => {
          const active = o.key === choice;
          return (
            <label
              key={o.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: compact ? 10 : 14,
                padding: compact ? "12px 12px" : "16px 18px",
                borderRadius: 13,
                cursor: "pointer",
                position: "relative",
                border: active ? "2px solid #3CC7F7" : "1px solid #E1E7EE",
                background: active ? "#F3FBFE" : "#fff",
                boxShadow: active ? "0 6px 16px -10px rgba(60,199,247,.55)" : "none",
                margin: active && o.tag ? "6px 0 0" : 0,
              }}
            >
              {o.tag && (
                <span style={{ position: "absolute", top: -9, left: 12, background: "#3CC7F7", color: "#06101C", fontSize: 10, fontWeight: 800, letterSpacing: ".04em", padding: "2px 8px", borderRadius: 20, textTransform: "uppercase" }}>
                  {o.tag}
                </span>
              )}
              <input
                type="radio"
                name="choiceRadio"
                checked={active}
                onChange={() => setChoice(o.key)}
                style={{ accentColor: "#3CC7F7", width: 16, height: 16, flex: "none", cursor: "pointer" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: compact ? 13.5 : 15 }}>{o.title}</div>
                <div style={{ fontSize: compact ? 11.5 : 12.5, color: "#5C6a79", marginTop: 2, lineHeight: 1.4 }}>{o.desc}</div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                {o.strike && <div style={{ fontSize: 11, color: "#9AA6B4", textDecoration: "line-through" }}>{o.strike}</div>}
                {o.priceTop && <div style={{ fontSize: 10.5, color: "#9AA6B4" }}>{o.priceTop}</div>}
                <div style={{ fontSize: compact ? 17 : 19, fontWeight: 800, color: active ? "#1EA8D8" : "#16202E" }}>
                  {o.price}
                  {o.priceSub && <span style={{ fontSize: 11.5, color: "#7A8696", fontWeight: 600 }}>{o.priceSub}</span>}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Optional message for our team…"
          className="input"
          style={{ marginTop: 0, resize: "vertical", fontSize: 13 }}
        />
      </div>

      <div style={{ marginTop: 12, padding: "12px 12px", borderRadius: 12, border: "1px dashed #C5D0DB", background: "#fff" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#16202E" }}>Upload documents</div>
        <div style={{ fontSize: 11.5, color: "#7A8696", marginTop: 3, lineHeight: 1.45 }}>
          Optional — photos, ID or PDF (max 2&nbsp;MB each).
        </div>
        <label
          style={{
            marginTop: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 9,
            border: "1px solid #D5DCE5",
            background: "#F4F6F9",
            fontSize: 12.5,
            fontWeight: 700,
            color: "#3C4a59",
            cursor: pending || uploads.length >= 5 ? "not-allowed" : "pointer",
            opacity: pending || uploads.length >= 5 ? 0.55 : 1,
          }}
        >
          Choose file
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={pending || uploads.length >= 5}
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            style={{ display: "none" }}
          />
        </label>
        {uploadError && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#C23B34", fontWeight: 600 }}>{uploadError}</div>
        )}
        {pending && <div style={{ marginTop: 8, fontSize: 12, color: "#0E9384", fontWeight: 600 }}>Uploading…</div>}
        {uploads.length > 0 && (
          <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
            {uploads.map((u) => (
              <li key={u.id} style={{ fontSize: 12.5, color: "#2C3847", display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {u.fileName}</span>
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
        style={{ marginTop: 14, width: "100%", padding: 13, fontSize: 14.5 }}
      >
        {selected.cta}
      </button>
      <div style={{ fontSize: 11.5, color: "#8A96A5", marginTop: 8, textAlign: "center", lineHeight: 1.5 }}>
        Next: agree &amp; e-sign, then continue to payment.
      </div>
    </>
  );
}
