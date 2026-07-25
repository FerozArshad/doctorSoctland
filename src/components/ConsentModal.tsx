"use client";
// Consent + e-signature modal. Opens for EVERY payment route (full / deposit /
// finance) and for "I'm interested". Patient must tick consent and sign before
// anything continues.
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { completePaymentConsent } from "@/app/p/actions";
import { CONSENT_TITLE, CONSENT_PARAGRAPHS, CONSENT_CHECKBOX_LABEL } from "@/lib/consent";
import ProposalDocuments, { type ProposalDoc } from "@/components/ProposalDocuments";
import SuccessModal from "@/components/SuccessModal";

export type Applicant = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
};

export type ConsentChoice = "full" | "deposit" | "finance" | "interested";

export default function ConsentModal({
  open,
  onClose,
  token,
  choice,
  note,
  applicant,
  previewMode = false,
  financeRedirectUrl = null,
  docs = [],
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  choice: ConsentChoice;
  note?: string;
  applicant: Applicant;
  previewMode?: boolean;
  financeRedirectUrl?: string | null;
  docs?: ProposalDoc[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasSig, setHasSig] = useState(false);
  const [sigData, setSigData] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ title: string; body: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, pending, onClose]);

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
    setSigData("");
    setConsent(false);
    setError("");
    setSuccess(null);
  }, [open]);

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
    const data = canvasRef.current!.toDataURL("image/png");
    setSigData(data);
    setHasSig(true);
  };
  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setSigData("");
    setHasSig(false);
  };

  const heading =
    choice === "finance"
      ? "Apply for 0% finance"
      : choice === "interested"
        ? "Register your interest"
        : "Agree & sign to pay";

  const subheading =
    choice === "finance"
      ? "Read the consent, sign below, then submit your finance application."
      : "Quick e-sign — usually under a minute.";

  const cta =
    choice === "finance"
      ? "Sign & submit finance application"
      : choice === "full"
        ? "Sign & pay securely →"
        : choice === "deposit"
          ? "Sign & pay deposit →"
          : "Confirm & submit";

  const submit = () => {
    if (previewMode) {
      setError("Preview mode — patient actions are disabled. Open the patient link from their email to pay or apply for finance.");
      return;
    }
    if (!consent || !hasSig) {
      setError("Please tick the consent box and add your e-signature.");
      return;
    }
    setError("");
    const fd = new FormData();
    fd.set("token", token);
    fd.set("choice", choice);
    fd.set("note", note || "");
    fd.set("signature", sigData);
    fd.set("firstName", (document.getElementById("consent-firstName") as HTMLInputElement)?.value || applicant.firstName);
    fd.set("lastName", (document.getElementById("consent-lastName") as HTMLInputElement)?.value || applicant.lastName);
    fd.set("phone", (document.getElementById("consent-phone") as HTMLInputElement)?.value || applicant.phone);
    fd.set("dob", (document.getElementById("consent-dob") as HTMLInputElement)?.value || applicant.dateOfBirth);
    fd.set("consent", "on");

    startTransition(async () => {
      const opensExternalTab =
        choice === "full" || choice === "deposit" || (choice === "finance" && !!financeRedirectUrl);
      const popup = opensExternalTab ? window.open("about:blank", "_blank") : null;
      try {
        const result = await completePaymentConsent(fd);
        if (!result?.ok) {
          popup?.close();
          return;
        }
        onClose();
        if ("inline" in result && result.inline) {
          router.refresh();
          if ("openUrl" in result && result.openUrl) {
            if (popup) popup.location.href = result.openUrl;
            else window.open(result.openUrl, "_blank", "noopener,noreferrer");
          } else {
            popup?.close();
          }
          return;
        }
        if ("openUrl" in result && result.openUrl) {
          if (popup) popup.location.href = result.openUrl;
          else window.open(result.openUrl, "_blank", "noopener,noreferrer");
        } else {
          popup?.close();
        }
        if ("title" in result && "body" in result) {
          setSuccess({ title: result.title, body: result.body });
        }
      } catch (e) {
        popup?.close();
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === "NEXT_REDIRECT" || (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).includes("NEXT_REDIRECT"))) {
          throw e;
        }
        setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
      }
    });
  };

  const modal = open ? (
    <div
      className="ds-consent-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="ds-consent-sheet">
        <div style={{ background: "#0E1A2B", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flex: "none" }}>
          <div style={{ minWidth: 0 }}>
            <div id="consent-modal-title" style={{ color: "#fff", fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>
              {heading}
            </div>
            <div style={{ color: "#9FB2C8", fontSize: 12.5, marginTop: 4, lineHeight: 1.45 }}>{subheading}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
            style={{ background: "transparent", border: "none", color: "#9FB2C8", fontSize: 24, cursor: "pointer", lineHeight: 1, flex: "none", opacity: pending ? 0.4 : 1 }}
          >
            ×
          </button>
        </div>

        <div className="ds-consent-scroll ds-scroll">
          <details
            style={{
              border: "1px solid #E7ECF2",
              borderRadius: 12,
              background: "#FBFCFD",
              padding: "10px 12px",
            }}
          >
            <summary style={{ fontSize: 13, fontWeight: 800, color: "#16202E", cursor: "pointer", listStyle: "none" }}>
              {CONSENT_TITLE} <span style={{ color: "#0E9384", fontWeight: 700 }}>— tap to read</span>
            </summary>
            <div style={{ marginTop: 10, maxHeight: 160, overflowY: "auto" }}>
              {CONSENT_PARAGRAPHS.map((p, i) => (
                <p key={i} style={{ fontSize: 12.5, lineHeight: 1.65, color: "#3C4a59", margin: i === 0 ? 0 : "10px 0 0" }}>
                  {p}
                </p>
              ))}
            </div>
          </details>

          {docs.length > 0 && <ProposalDocuments token={token} docs={docs} embedded />}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#16202E", marginBottom: 10 }}>Your details</div>
            <div className="ds-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="label">First name</label>
                <input className="input" id="consent-firstName" name="firstName" defaultValue={applicant.firstName} required />
              </div>
              <div>
                <label className="label">Last name</label>
                <input className="input" id="consent-lastName" name="lastName" defaultValue={applicant.lastName} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="label">Email</label>
                <input className="input" defaultValue={applicant.email} readOnly style={{ background: "#F4F6F9", color: "#7A8696" }} />
              </div>
              <div>
                <label className="label">Phone / WhatsApp</label>
                <input className="input" id="consent-phone" name="phone" type="tel" defaultValue={applicant.phone} placeholder="+44 mobile" />
              </div>
              <div>
                <label className="label">Date of birth</label>
                <input className="input" id="consent-dob" name="dob" type="date" defaultValue={applicant.dateOfBirth} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="label" style={{ margin: 0 }}>
                E-signature
              </label>
              <button type="button" onClick={clear} style={{ background: "transparent", border: "none", color: "#0E9384", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                Clear
              </button>
            </div>
            <canvas
              ref={canvasRef}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
              style={{
                width: "100%",
                height: 110,
                marginTop: 6,
                border: "1.5px dashed " + (hasSig ? "#0E9384" : "#CBD4DE"),
                borderRadius: 12,
                background: "#fff",
                touchAction: "none",
                cursor: "crosshair",
                display: "block",
              }}
            />
            <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 4 }}>Sign with your finger or mouse.</div>
          </div>

          {error && (
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "#FBE9E8", color: "#C23B34", fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}
        </div>

        <div className="ds-consent-footer">
          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              marginBottom: 12,
              padding: "11px 12px",
              borderRadius: 11,
              border: "1.5px solid " + (consent ? "#0E9384" : "#E1E7EE"),
              background: consent ? "#F4FCFA" : "#FBFCFD",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name="consent"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#0E9384", marginTop: 1, flex: "none" }}
            />
            <span style={{ fontSize: 12.5, color: "#3C4a59", lineHeight: 1.5 }}>{CONSENT_CHECKBOX_LABEL}</span>
          </label>

          <button
            type="button"
            className="btn btn-teal"
            disabled={pending || !consent || !hasSig}
            onClick={submit}
            style={{ width: "100%", padding: 14, fontSize: 15, opacity: pending || !consent || !hasSig ? 0.55 : 1 }}
          >
            {pending ? (
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <span className="ds-spinner" aria-hidden="true" />
                One moment…
              </span>
            ) : (
              cta
            )}
          </button>
          <div style={{ fontSize: 11, color: "#9AA6B4", marginTop: 8, textAlign: "center", lineHeight: 1.5 }}>
            Your signed consent is stored securely with your patient record.
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <SuccessModal
        open={!!success}
        title={success?.title || ""}
        body={success?.body || ""}
        onClose={() => setSuccess(null)}
      />
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
