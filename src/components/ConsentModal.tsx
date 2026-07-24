"use client";
// Consent + e-signature modal. Opens for EVERY payment route (full / deposit /
// finance) and for "I'm interested". Patient must tick consent and sign before
// anything continues — this was previously finance-only, which is why the
// popup looked "missing" on pay-in-full / deposit.
import { useEffect, useRef, useState, useTransition } from "react";
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
  const router = useRouter();

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
      ? "Agree, sign & apply for finance"
      : choice === "interested"
        ? "Agree & register your interest"
        : "Agree & sign to continue";

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
      // Pre-open a tab only when we will navigate it to Stripe or an external finance portal.
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

  return (
    <>
      <SuccessModal
        open={!!success}
        title={success?.title || ""}
        body={success?.body || ""}
        onClose={() => setSuccess(null)}
      />

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(11,24,40,.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 16px", overflowY: "auto" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !pending) onClose();
          }}
        >
          <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 560, boxShadow: "0 30px 60px -20px rgba(11,24,40,.5)", overflow: "hidden" }}>
            <div style={{ background: "#0E1A2B", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>{heading}</div>
              <button type="button" onClick={onClose} disabled={pending} aria-label="Close" style={{ background: "transparent", border: "none", color: "#9FB2C8", fontSize: 22, cursor: "pointer", lineHeight: 1, opacity: pending ? 0.4 : 1 }}>
                ×
              </button>
            </div>

            <div style={{ padding: "22px 24px" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#16202E", marginBottom: 8 }}>{CONSENT_TITLE}</div>
              <div style={{ maxHeight: 148, overflowY: "auto", border: "1px solid #E7ECF2", borderRadius: 12, padding: "12px 14px", background: "#FBFCFD" }}>
                {CONSENT_PARAGRAPHS.map((p, i) => (
                  <p key={i} style={{ fontSize: 12.5, lineHeight: 1.65, color: "#3C4a59", margin: i === 0 ? 0 : "10px 0 0" }}>
                    {p}
                  </p>
                ))}
              </div>

              {docs.length > 0 && <ProposalDocuments token={token} docs={docs} compact />}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
                <div>
                  <label className="label">First name</label>
                  <input className="input" id="consent-firstName" name="firstName" defaultValue={applicant.firstName} required />
                </div>
                <div>
                  <label className="label">Last name</label>
                  <input className="input" id="consent-lastName" name="lastName" defaultValue={applicant.lastName} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" defaultValue={applicant.email} readOnly style={{ background: "#F4F6F9", color: "#7A8696" }} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" id="consent-phone" name="phone" defaultValue={applicant.phone} placeholder="Mobile number" />
                </div>
                <div>
                  <label className="label">Date of birth</label>
                  <input className="input" id="consent-dob" name="dob" type="date" defaultValue={applicant.dateOfBirth} />
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
                    height: 130,
                    marginTop: 6,
                    border: "1.5px dashed " + (hasSig ? "#0E9384" : "#CBD4DE"),
                    borderRadius: 12,
                    background: "#fff",
                    touchAction: "none",
                    cursor: "crosshair",
                    display: "block",
                  }}
                />
                <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 4 }}>Sign above with your mouse or finger.</div>
              </div>

              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, padding: "12px 14px", borderRadius: 11, border: "1.5px solid " + (consent ? "#0E9384" : "#E1E7EE"), background: consent ? "#F4FCFA" : "#FBFCFD", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="consent"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#0E9384", marginTop: 1, flex: "none" }}
                />
                <span style={{ fontSize: 13, color: "#3C4a59", lineHeight: 1.55 }}>{CONSENT_CHECKBOX_LABEL}</span>
              </label>

              {error && (
                <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "#FBE9E8", color: "#C23B34", fontSize: 13, fontWeight: 600 }}>
                  {error}
                </div>
              )}

              <button
                type="button"
                className="btn btn-teal"
                disabled={pending || !consent || !hasSig}
                onClick={submit}
                style={{ marginTop: 16, width: "100%", padding: 14, fontSize: 15, opacity: pending || !consent || !hasSig ? 0.55 : 1 }}
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
              <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 10, textAlign: "center", lineHeight: 1.6 }}>
                Your signed consent is stored securely with your patient record.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
