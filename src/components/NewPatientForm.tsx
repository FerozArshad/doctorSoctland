"use client";
// Add-patient form with live proposal preview — mirrors the design exactly.
// Pricing tiers come from the editable config (admin → Settings), passed in by the page.
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createPatient } from "@/app/admin/actions";
import { estMonths, fmt, priceForPence, type PricingConfig } from "@/lib/pricing";
import SentByPicker from "./SentByPicker";

function NewPatientActions() {
  const { pending } = useFormStatus();
  const [intent, setIntent] = useState<"draft" | "send" | null>(null);

  useEffect(() => {
    if (!pending) setIntent(null);
  }, [pending]);

  const spinner = (dark: boolean) => (
    <span className={dark ? "ds-spinner ds-spinner-dark" : "ds-spinner"} aria-hidden="true" />
  );

  return (
    <div style={{ display: "flex", gap: 12, marginTop: 26 }}>
      <button
        type="submit"
        className="btn btn-outline"
        name="intent"
        value="draft"
        disabled={pending}
        aria-busy={pending && intent === "draft"}
        onClick={() => setIntent("draft")}
        style={{ flex: 1 }}
      >
        {pending && intent === "draft" ? (
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            {spinner(true)}
            Saving…
          </span>
        ) : (
          "Save as draft"
        )}
      </button>
      <button
        type="submit"
        className="btn btn-teal"
        name="intent"
        value="send"
        disabled={pending}
        aria-busy={pending && intent === "send"}
        onClick={() => setIntent("send")}
        style={{ flex: 1.3 }}
      >
        {pending && intent === "send" ? (
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            {spinner(false)}
            Sending…
          </span>
        ) : pending ? (
          "Please wait…"
        ) : (
          "Create & send proposal"
        )}
      </button>
    </div>
  );
}

export default function NewPatientForm({ cfg }: { cfg: PricingConfig }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [alignerCount, setAlignerCount] = useState(14);
  const [pkg, setPkg] = useState<"Express" | "Go">("Go");
  const [video, setVideo] = useState("");
  const [notes, setNotes] = useState("");
  const [errs, setErrs] = useState({ first: false, email: false });

  const validate = (e: React.FormEvent<HTMLFormElement>) => {
    const first = !firstName.trim();
    const em = !/.+@.+\..+/.test(email);
    if (first || em) {
      e.preventDefault();
      setErrs({ first, email: em });
    }
  };

  const price = priceForPence(alignerCount, cfg);
  const net = Math.max(0, price - cfg.upfrontPence);

  const pkgBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: 12, borderRadius: 11, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
    display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start",
    background: active ? "#0E9384" : "#fff",
    color: active ? "#fff" : "#3C4a59",
    border: active ? "1.5px solid #0E9384" : "1.5px solid #E1E7EE",
  });

  return (
    <form action={createPatient} onSubmit={validate} className="ds-view" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18, alignItems: "start" }}>
      <div className="card" style={{ padding: 26 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Patient details</div>
        <div style={{ fontSize: 13, color: "#7A8696", marginTop: 2 }}>Enter details from the ClinCheck assessment.</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 22 }}>
          <div>
            <label className="label">First name *</label>
            <input className={"input" + (errs.first ? " err" : "")} name="firstName" value={firstName} onChange={(e) => { setFirstName(e.target.value); setErrs((s) => ({ ...s, first: false })); }} placeholder="First name" />
          </div>
          <div>
            <label className="label">Last name</label>
            <input className="input" name="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className={"input" + (errs.email ? " err" : "")} name="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrs((s) => ({ ...s, email: false })); }} placeholder="name@email.com" />
          </div>
          <div>
            <label className="label">Phone (WhatsApp)</label>
            <input className="input" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" />
          </div>
        </div>

        <div style={{ height: 1, background: "#EEF2F6", margin: "24px 0" }} />
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>Treatment plan</div>

        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label className="label">Number of aligners</label>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#0E9384" }}>{alignerCount}</span>
          </div>
          <input type="range" name="alignerCount" min={1} max={40} value={alignerCount} onChange={(e) => setAlignerCount(parseInt(e.target.value) || 1)} style={{ width: "100%", marginTop: 10, accentColor: "#0E9384" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9AA6B4", marginTop: 2 }}>
            <span>1</span><span>20</span><span>40</span>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <label className="label">Package</label>
          <input type="hidden" name="pkg" value={pkg} />
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={() => setPkg("Express")} style={pkgBtn(pkg === "Express")}>
              Express <span style={{ fontWeight: 500, opacity: 0.7 }}>≤ 7 aligners</span>
            </button>
            <button type="button" onClick={() => setPkg("Go")} style={pkgBtn(pkg === "Go")}>
              Go <span style={{ fontWeight: 500, opacity: 0.7 }}>up to 20+</span>
            </button>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <label className="label">ClinCheck video link</label>
          <input className="input" name="videoUrl" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="Paste ClinCheck video URL" />
        </div>
        <div style={{ marginTop: 16 }}>
          <label className="label">Notes</label>
          <textarea className="input" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for the team…" rows={3} style={{ resize: "vertical" }} />
        </div>

        <div style={{ height: 1, background: "#EEF2F6", margin: "24px 0" }} />
        <SentByPicker />

        <NewPatientActions />
        <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 12, lineHeight: 1.6 }}>
          “Create &amp; send” emails the secure proposal link and sends a WhatsApp message if a phone number is provided.
        </div>
      </div>

      {/* live preview */}
      <div className="card" style={{ padding: 24, position: "sticky", top: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#0E9384" }}>Live proposal preview</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 12, letterSpacing: "-.01em" }}>{(firstName || "New") + " " + (lastName || "patient")}</div>
        <div style={{ fontSize: 13, color: "#8A96A5" }}>{email || "Email will appear here"}</div>

        <div style={{ marginTop: 20, border: "1px solid #EEF2F6", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>Aligners</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{alignerCount}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>Est. treatment</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>≈ {estMonths(alignerCount)} months</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>Package</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>Invisalign {pkg}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>Treatment total</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{fmt(price)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>Booking already paid</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#B4530A" }}>− {fmt(cfg.upfrontPence)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", background: "#F0FBF8" }}>
            <span style={{ fontSize: 13, color: "#0B7A6E", fontWeight: 600 }}>Amount to pay</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#0B7A6E" }}>{fmt(net)}</span>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 12, background: "#FBFCFD", border: "1px solid #EEF2F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#5C6a79", fontWeight: 600 }}>Complimentary value included</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#0B7A6E" }}>£875</span>
        </div>
        <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 14, lineHeight: 1.6 }}>
          Every patient has already paid the {fmt(cfg.upfrontPence)} booking — proposals always show the reduced balance.
        </div>
      </div>
    </form>
  );
}
