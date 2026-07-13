"use client";
// Consent + application modal. Opens when a patient chooses 0% finance or
// "I'm interested". Shows the Invisalign informed-consent summary, collects
// basic details, and captures a drawn signature before submitting.
import { useEffect, useRef, useState } from "react";
import { submitApplication } from "@/app/p/actions";
import { CONSENT_TITLE, CONSENT_PARAGRAPHS, CONSENT_CHECKBOX_LABEL } from "@/lib/consent";

export type Applicant = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
};

export default function ConsentModal({
  open,
  onClose,
  token,
  intent,
  applicant,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  intent: "finance" | "interested";
  applicant: Applicant;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sigInput = useRef<HTMLInputElement | null>(null);
  const drawing = useRef(false);
  const [hasSig, setHasSig] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Prepare the canvas (crisp on hi-dpi) whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#16202E";
    }
    setHasSig(false);
    setConsent(false);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (sigInput.current) sigInput.current.value = canvasRef.current!.toDataURL("image/png");
    setHasSig(true);
  };
  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    if (sigInput.current) sigInput.current.value = "";
    setHasSig(false);
  };

  const heading = intent === "finance" ? "Apply for 0% interest-free finance" : "Register your interest";
  const cta = intent === "finance" ? "Submit finance application" : "Confirm & submit";

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(11,24,40,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 560, boxShadow: "0 30px 60px -20px rgba(11,24,40,.5)", overflow: "hidden" }}>
        <div style={{ background: "#0E1A2B", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>{heading}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "#9FB2C8", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <form
          action={submitApplication}
          onSubmit={(e) => {
            if (!consent || !hasSig) { e.preventDefault(); return; }
            setSubmitting(true);
          }}
          style={{ padding: "22px 24px" }}
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="intent" value={intent} />
          <input type="hidden" name="signature" ref={sigInput} />

          {/* Consent text */}
          <div style={{ fontSize: 14, fontWeight: 800, color: "#16202E", marginBottom: 8 }}>{CONSENT_TITLE}</div>
          <div style={{ maxHeight: 168, overflowY: "auto", border: "1px solid #E7ECF2", borderRadius: 12, padding: "12px 14px", background: "#FBFCFD" }}>
            {CONSENT_PARAGRAPHS.map((p, i) => (
              <p key={i} style={{ fontSize: 12.5, lineHeight: 1.65, color: "#3C4a59", margin: i === 0 ? 0 : "10px 0 0" }}>{p}</p>
            ))}
          </div>

          {/* Basic info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
            <div>
              <label className="label">First name</label>
              <input className="input" name="firstName" defaultValue={applicant.firstName} required />
            </div>
            <div>
              <label className="label">Last name</label>
              <input className="input" name="lastName" defaultValue={applicant.lastName} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" defaultValue={applicant.email} readOnly style={{ background: "#F4F6F9", color: "#7A8696" }} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" name="phone" defaultValue={applicant.phone} placeholder="07700 900123" />
            </div>
            <div>
              <label className="label">Date of birth</label>
              <input className="input" name="dob" type="date" defaultValue={applicant.dateOfBirth} />
            </div>
          </div>

          {/* Signature */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="label" style={{ margin: 0 }}>Signature</label>
              <button type="button" onClick={clear} style={{ background: "transparent", border: "none", color: "#0E9384", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Clear</button>
            </div>
            <canvas
              ref={canvasRef}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
              style={{ width: "100%", height: 130, marginTop: 6, border: "1.5px dashed " + (hasSig ? "#0E9384" : "#CBD4DE"), borderRadius: 12, background: "#fff", touchAction: "none", cursor: "crosshair", display: "block" }}
            />
            <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 4 }}>Sign above with your mouse or finger.</div>
          </div>

          {/* Consent checkbox */}
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, cursor: "pointer" }}>
            <input type="checkbox" name="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#0E9384", marginTop: 1, flex: "none" }} />
            <span style={{ fontSize: 12.8, color: "#3C4a59", lineHeight: 1.55 }}>{CONSENT_CHECKBOX_LABEL}</span>
          </label>

          <textarea name="note" rows={2} placeholder="Anything you'd like us to know? (optional)" className="input" style={{ marginTop: 12, resize: "vertical", fontSize: 13.5 }} />

          <button className="btn btn-teal" disabled={submitting || !consent || !hasSig} style={{ marginTop: 16, width: "100%", padding: 14, fontSize: 15, opacity: submitting || !consent || !hasSig ? 0.55 : 1 }}>
            {submitting ? "Submitting…" : cta}
          </button>
          <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 10, textAlign: "center", lineHeight: 1.6 }}>
            Your signed consent is stored securely with your record.
          </div>
        </form>
      </div>
    </div>
  );
}
