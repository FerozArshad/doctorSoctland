"use client";
// Edit an existing patient — mirrors the New-patient form, pre-filled, plus the
// booking-credit toggle. Draft proposals can be saved and resumed, or saved and sent.
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { updatePatient } from "@/app/admin/actions";
import { estMonths, fmt, priceForPence, type PricingConfig } from "@/lib/pricing";
import SentByPicker from "@/components/SentByPicker";

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
  status: string;
};

function EditPatientActions({ isDraft, patientId }: { isDraft: boolean; patientId: string }) {
  const { pending } = useFormStatus();
  const [intent, setIntent] = useState<"draft" | "send" | "save" | null>(null);

  useEffect(() => {
    if (!pending) setIntent(null);
  }, [pending]);

  const spinner = (dark: boolean) => (
    <span className={dark ? "ds-spinner ds-spinner-dark" : "ds-spinner"} aria-hidden="true" />
  );

  if (!isDraft) {
    return (
      <div style={{ display: "flex", gap: 12, marginTop: 26 }}>
        <a className="btn btn-outline" href={`/admin/patients/${patientId}`} style={{ flex: 1, textAlign: "center", textDecoration: "none" }}>
          Cancel
        </a>
        <button type="submit" className="btn btn-teal" name="intent" value="save" disabled={pending} style={{ flex: 1.3 }}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    );
  }

  return (
    <>
      <div style={{ height: 1, background: "#EEF2F6", margin: "24px 0" }} />
      <SentByPicker />
      <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
        <a className="btn btn-outline" href={`/admin/patients`} style={{ flex: "1 1 120px", textAlign: "center", textDecoration: "none" }}>
          Back to list
        </a>
        <button
          type="submit"
          className="btn btn-outline"
          name="intent"
          value="draft"
          disabled={pending}
          onClick={() => setIntent("draft")}
          style={{ flex: "1.2 1 140px" }}
        >
          {pending && intent === "draft" ? (
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              {spinner(true)}
              Saving…
            </span>
          ) : (
            "Save draft"
          )}
        </button>
        <button
          type="submit"
          className="btn btn-teal"
          name="intent"
          value="send"
          disabled={pending}
          onClick={() => setIntent("send")}
          style={{ flex: "1.4 1 160px" }}
        >
          {pending && intent === "send" ? (
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              {spinner(false)}
              Sending…
            </span>
          ) : (
            "Save & send proposal"
          )}
        </button>
      </div>
      <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 12, lineHeight: 1.6 }}>
        Save draft keeps this as a draft in your patient list — open it anytime from <strong>Patients → Draft</strong> to finish and send.
      </div>
    </>
  );
}

export default function EditPatientForm({
  patient,
  cfg,
  owners,
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
  const isDraft = patient.status === "draft";

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
        <div style={{ fontSize: 16, fontWeight: 800 }}>{isDraft ? "Draft proposal" : "Edit patient details"}</div>
        <div style={{ fontSize: 13, color: "#7A8696", marginTop: 2 }}>
          {isDraft
            ? "Save your progress as a draft and return later, or send when the proposal is ready."
            : "Changes are saved immediately — the proposal updates for the patient too."}
        </div>
        {isDraft && (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 11, background: "#FBF3E2", border: "1px solid #F0DCA8", fontSize: 13, color: "#8A5A12", lineHeight: 1.5 }}>
            This proposal is still a <strong>draft</strong> — the patient has not been emailed yet.
          </div>
        )}

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
          <input className="input" name="videoUrl" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="Paste ClinCheck video URL" />
        </div>
        <div style={{ marginTop: 16 }}>
          <label className="label">Notes</label>
          <textarea className="input" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the coordinator should know…" rows={3} style={{ resize: "vertical" }} />
        </div>

        <EditPatientActions isDraft={isDraft} patientId={patient.id} />
      </div>

      {/* summary */}
      <div className="card" style={{ padding: 24, position: "sticky", top: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#0E9384" }}>Pricing summary</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 12 }}>{(firstName || "New") + " " + (lastName || "patient")}</div>
        <div style={{ fontSize: 13, color: "#8A96A5" }}>{email || "Email will appear here"}</div>

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
