"use client";
// Edit an existing patient — mirrors the New-patient form, pre-filled, plus the
// booking-credit toggle. Editable at any status (even after paid/done).
// Pricing tiers come from the editable config (admin → Settings), passed in by the page.
import { useState } from "react";
import { updatePatient } from "@/app/admin/actions";
import { estMonths, fmt, priceForPence, type PricingConfig } from "@/lib/pricing";

export type EditPatientInitial = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  alignerCount: number;
  pkg: "Express" | "Go";
  videoUrl: string;
  notes: string;
  paidUpfront: boolean;
  ownerId: string | null;
};

export default function EditPatientForm({
  patient,
  cfg,
  owners, // only passed for Super Admins — enables reassigning the patient to an admin
}: {
  patient: EditPatientInitial;
  cfg: PricingConfig;
  owners?: Array<{ id: string; name: string }>;
}) {
  const [firstName, setFirstName] = useState(patient.firstName);
  const [lastName, setLastName] = useState(patient.lastName);
  const [email, setEmail] = useState(patient.email);
  const [phone, setPhone] = useState(patient.phone);
  const [alignerCount, setAlignerCount] = useState(patient.alignerCount);
  const [pkg, setPkg] = useState<"Express" | "Go">(patient.pkg);
  const [video, setVideo] = useState(patient.videoUrl);
  const [notes, setNotes] = useState(patient.notes);
  const [paidUpfront, setPaidUpfront] = useState(patient.paidUpfront);
  const [errs, setErrs] = useState({ first: false, email: false });
  const [submitting, setSubmitting] = useState(false);

  const price = priceForPence(alignerCount, cfg);
  const net = Math.max(0, price - (paidUpfront ? cfg.upfrontPence : 0));

  const validate = (e: React.FormEvent<HTMLFormElement>) => {
    const first = !firstName.trim();
    const em = !/.+@.+\..+/.test(email);
    if (first || em) {
      e.preventDefault();
      setErrs({ first, email: em });
      return;
    }
    setSubmitting(true);
  };

  const pkgBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: 12, borderRadius: 11, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
    display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start",
    background: active ? "#0E9384" : "#fff",
    color: active ? "#fff" : "#3C4a59",
    border: active ? "1.5px solid #0E9384" : "1.5px solid #E1E7EE",
  });

  return (
    <form action={updatePatient} onSubmit={validate} className="ds-view" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18, alignItems: "start" }}>
      <input type="hidden" name="patientId" value={patient.id} />
      <div className="card" style={{ padding: 26 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Edit patient details</div>
        <div style={{ fontSize: 13, color: "#7A8696", marginTop: 2 }}>Changes are saved immediately — the proposal updates for the patient too.</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 22 }}>
          <div>
            <label className="label">First name *</label>
            <input className={"input" + (errs.first ? " err" : "")} name="firstName" value={firstName} onChange={(e) => { setFirstName(e.target.value); setErrs((s) => ({ ...s, first: false })); }} placeholder="Emma" />
          </div>
          <div>
            <label className="label">Last name</label>
            <input className="input" name="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="MacLeod" />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className={"input" + (errs.email ? " err" : "")} name="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrs((s) => ({ ...s, email: false })); }} placeholder="emma@example.com" />
          </div>
          <div>
            <label className="label">Phone (WhatsApp)</label>
            <input className="input" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07700 900123" />
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

        {/* £250 upfront toggle */}
        <label style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 20, padding: "14px 16px", borderRadius: 12, border: "1.5px solid " + (paidUpfront ? "#0E9384" : "#E1E7EE"), background: paidUpfront ? "#F0FBF8" : "#fff", cursor: "pointer" }}>
          <input type="checkbox" name="paidUpfront" checked={paidUpfront} onChange={(e) => setPaidUpfront(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#0E9384", marginTop: 1 }} />
          <span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "#16202E" }}>{fmt(cfg.upfrontPence)} booking paid upfront</span>
            <span style={{ display: "block", fontSize: 12.5, color: "#7A8696", marginTop: 2 }}>Deducts {fmt(cfg.upfrontPence)} from the total. All payment options recalculate for the patient.</span>
          </span>
        </label>

        {owners && (
          <div style={{ marginTop: 20 }}>
            <label className="label">Belongs to admin</label>
            <select className="input" name="ownerId" defaultValue={patient.ownerId ?? ""}>
              <option value="">— Unassigned (Super Admins only) —</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: "#8A96A5", marginTop: 4 }}>
              The assigned admin sees this patient in their own dashboard, list and reports.
            </div>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <label className="label">ClinCheck video link</label>
          <input className="input" name="videoUrl" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://clincheck.invisalign.com/…" />
        </div>
        <div style={{ marginTop: 16 }}>
          <label className="label">Notes</label>
          <textarea className="input" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the coordinator should know…" rows={3} style={{ resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 26 }}>
          <a className="btn btn-outline" href={`/admin/patients/${patient.id}`} style={{ flex: 1, textAlign: "center", textDecoration: "none" }}>Cancel</a>
          <button className="btn btn-teal" disabled={submitting} style={{ flex: 1.3 }}>{submitting ? "Saving…" : "Save changes"}</button>
        </div>
      </div>

      {/* summary */}
      <div className="card" style={{ padding: 24, position: "sticky", top: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#0E9384" }}>Pricing summary</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 12 }}>{(firstName || "New") + " " + (lastName || "patient")}</div>
        <div style={{ fontSize: 13, color: "#8A96A5" }}>{email || "email@example.com"}</div>

        <div style={{ marginTop: 20, border: "1px solid #EEF2F6", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>Aligners</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{alignerCount} · ≈{estMonths(alignerCount)} mo</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>Treatment total</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{fmt(price)}</span>
          </div>
          {paidUpfront && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
              <span style={{ fontSize: 13, color: "#7A8696" }}>Less {fmt(cfg.upfrontPence)} upfront</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#B4530A" }}>− {fmt(cfg.upfrontPence)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", background: "#F0FBF8" }}>
            <span style={{ fontSize: 13, color: "#0B7A6E", fontWeight: 600 }}>Balance remaining</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#0B7A6E" }}>{fmt(net)}</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 14, lineHeight: 1.6 }}>
          Pay-in-full also applies a {cfg.discountPct}% discount on the balance at checkout.
        </div>
      </div>
    </form>
  );
}
