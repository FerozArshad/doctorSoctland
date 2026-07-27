"use client";
// Full proposal builder — save draft, send, and live pricing preview.
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { updatePatient } from "@/app/admin/actions";
import { estMonths, fmt, netPricePence, treatmentPricePence, treatmentBookingCreditPence, VENEER_PACKAGES, WHITENING_ADDON_PENCE, COMPOSITE_PRICE_PER_TOOTH_PENCE, veneerPricePence, type PricingConfig } from "@/lib/pricing";
import { validateProposalForSend } from "@/lib/proposal-validation";
import SentByPicker from "@/components/SentByPicker";
import TreatmentTabs from "@/components/TreatmentTabs";
import TreatmentBadge from "@/components/TreatmentBadge";
import DeletePatientButton from "@/components/DeletePatientButton";
import { defaultPlanCount, normalizeTreatmentType, planCountLabel, planCountMax, planCountShortLabel, treatmentCopy, type TreatmentType } from "@/lib/treatments";

export type ProposalPatient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  alignerCount: number;
  pkg: "Express" | "Go";
  videoUrl: string;
  notes: string;
  ownerId: string | null;
  status: string;
  treatmentType: string;
  includeWhitening: boolean;
};

function ProposalActions({
  isDraft,
  patientId,
  usesClinCheckVideo,
  usesAiSimulation,
  canDelete,
  patientName,
}: {
  isDraft: boolean;
  patientId: string;
  usesClinCheckVideo: boolean;
  usesAiSimulation: boolean;
  canDelete?: boolean;
  patientName: string;
}) {
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
      <div className="ds-proposal-form-actions" style={{ flexWrap: "wrap" }}>
        <a className="btn btn-outline" href={`/admin/patients/${patientId}`} style={{ textAlign: "center", textDecoration: "none" }}>
          Back to patient
        </a>
        <button type="submit" className="btn btn-teal" name="intent" value="save" disabled={pending}>
          {pending ? "Saving…" : "Save proposal changes"}
        </button>
        {canDelete && (
          <DeletePatientButton
            patientId={patientId}
            patientName={patientName}
            label="Delete proposal"
            confirmMessage={`Permanently delete the proposal for ${patientName}? This cannot be undone.`}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <div style={{ height: 1, background: "#EEF2F6", margin: "24px 0" }} />
      <SentByPicker />
      <div className="ds-proposal-form-actions" style={{ flexWrap: "wrap" }}>
        <a className="btn btn-outline" href="/admin/patients" style={{ flex: "1 1 120px", textAlign: "center", textDecoration: "none" }}>
          Back to list
        </a>
        {canDelete && (
          <DeletePatientButton
            patientId={patientId}
            patientName={patientName}
            label="Delete proposal"
            confirmMessage={`Permanently delete the draft proposal for ${patientName}? This cannot be undone.`}
          />
        )}
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
        <strong>Save draft</strong> stores your progress — resume anytime from <strong>Patients → Draft</strong>.{" "}
        <strong>Save &amp; send</strong> emails the patient (requires name, email, phone
        {usesClinCheckVideo ? ", and ClinCheck video" : usesAiSimulation ? ", and AI simulation link" : ""}).
      </div>
    </>
  );
}

export default function ProposalForm({
  patient,
  cfg,
  owners,
  canDelete = false,
}: {
  patient: ProposalPatient;
  cfg: PricingConfig;
  owners?: Array<{ id: string; name: string }>;
  canDelete?: boolean;
}) {
  const [treatment, setTreatment] = useState<TreatmentType>(normalizeTreatmentType(patient.treatmentType));
  const [firstName, setFirstName] = useState(patient.firstName);
  const [lastName, setLastName] = useState(patient.lastName);
  const [email, setEmail] = useState(patient.email);
  const [phone, setPhone] = useState(patient.phone);
  const [alignerCount, setAlignerCount] = useState(patient.alignerCount);
  const [pkg, setPkg] = useState<"Express" | "Go">(patient.pkg);
  const [includeWhitening, setIncludeWhitening] = useState(patient.includeWhitening);
  const [video, setVideo] = useState(patient.videoUrl);
  const [notes, setNotes] = useState(patient.notes);
  const [errs, setErrs] = useState({ first: false, last: false, email: false, phone: false, video: false });
  const isDraft = patient.status === "draft";
  const copy = treatmentCopy(treatment);
  const patientName = `${firstName} ${lastName}`.trim() || "patient";

  const price = treatmentPricePence(treatment, alignerCount, cfg, { includeWhitening });
  const bookingCredit = treatmentBookingCreditPence(treatment, cfg);
  const net = netPricePence(price, bookingCredit);

  const handleTreatmentChange = (next: TreatmentType) => {
    setTreatment(next);
    const nextCopy = treatmentCopy(next);
    setAlignerCount(defaultPlanCount(next));
    if (!nextCopy.offersWhitening) setIncludeWhitening(false);
    if (!nextCopy.usesAligners) setPkg("Go");
  };

  const validate = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget);
    const intent = String(fd.get("intent") || "");
    const first = !firstName.trim();
    const last = !lastName.trim();
    const em = !/.+@.+\..+/.test(email);
    const ph = !phone.trim() || phone.trim() === "—";
    const vid =
      (copy.usesClinCheckVideo || copy.usesAiSimulation) && !/^https?:\/\/.+/i.test(video.trim());
    if (first || em) {
      e.preventDefault();
      setErrs({ first, last, email: em, phone: ph, video: vid });
      return;
    }
    if (intent === "send") {
      const check = validateProposalForSend({
        firstName,
        lastName,
        email,
        phone,
        videoUrl: video,
        alignerCount,
        pkg,
        treatmentType: treatment,
      });
      if (!check.ok) {
        e.preventDefault();
        const msg = check.message.toLowerCase();
        setErrs({
          first: !firstName.trim(),
          last: !lastName.trim(),
          email: !/.+@.+\..+/.test(email),
          phone: ph || msg.includes("mobile") || msg.includes("phone"),
          video: vid || msg.includes("video"),
        });
        alert(check.message);
        return;
      }
      if (!String(fd.get("sentByKey") || "").trim()) {
        e.preventDefault();
        alert("Choose who the proposal is sent from.");
      }
    }
  };

  const pkgBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: 12,
    borderRadius: 11,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    alignItems: "flex-start",
    background: active ? "#0E9384" : "#fff",
    color: active ? "#fff" : "#3C4a59",
    border: active ? "1.5px solid #0E9384" : "1.5px solid #E1E7EE",
  });

  return (
    <form action={updatePatient} onSubmit={validate} className="ds-view ds-form-split">
      <input type="hidden" name="patientId" value={patient.id} />
      <input type="hidden" name="treatmentType" value={treatment} />
      <div className="card" style={{ padding: 26 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Proposal</div>
            <div style={{ fontSize: 13, color: "#7A8696", marginTop: 2 }}>
              {isDraft
                ? "Build the treatment plan, save as a draft, or send when ready."
                : "Update the proposal — changes apply on the patient pay link immediately."}
            </div>
          </div>
          <TreatmentBadge treatmentType={treatment} />
        </div>
        {isDraft && (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 11, background: "#FBF3E2", border: "1px solid #F0DCA8", fontSize: 13, color: "#8A5A12", lineHeight: 1.5 }}>
            Draft — not sent to the patient yet. Use the buttons below when you are ready.
          </div>
        )}

        <div style={{ marginTop: 20 }} id="choose-treatment">
          <div style={{ fontSize: 13, color: "#7A8696", marginBottom: 10, lineHeight: 1.5 }}>
            <strong style={{ color: "#3C4a59" }}>Choose a different treatment</strong> — patient details are kept; only the plan and pricing below update.
          </div>
          <TreatmentTabs value={treatment} onChange={handleTreatmentChange} />
        </div>

        <div className="ds-form-2col" style={{ marginTop: 22 }}>
          <div>
            <label className="label">First name *</label>
            <input className={"input" + (errs.first ? " err" : "")} name="firstName" value={firstName} onChange={(e) => { setFirstName(e.target.value); setErrs((s) => ({ ...s, first: false })); }} placeholder="First name" />
          </div>
          <div>
            <label className="label">Last name *</label>
            <input className={"input" + (errs.last ? " err" : "")} name="lastName" value={lastName} onChange={(e) => { setLastName(e.target.value); setErrs((s) => ({ ...s, last: false })); }} placeholder="Last name" />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className={"input" + (errs.email ? " err" : "")} name="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrs((s) => ({ ...s, email: false })); }} placeholder="name@email.com" />
          </div>
          <div>
            <label className="label">Phone (WhatsApp) *</label>
            <input className={"input" + (errs.phone ? " err" : "")} name="phone" value={phone} onChange={(e) => { setPhone(e.target.value); setErrs((s) => ({ ...s, phone: false })); }} placeholder="Mobile number" />
          </div>
        </div>

        <div style={{ height: 1, background: "#EEF2F6", margin: "24px 0" }} />
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>{copy.planSectionTitle}</div>

        {copy.usesAligners && (
          <>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label className="label">{planCountLabel(treatment)}</label>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#0E9384" }}>{alignerCount}</span>
          </div>
          <input type="range" name="alignerCount" min={1} max={planCountMax(treatment)} value={alignerCount} onChange={(e) => setAlignerCount(parseInt(e.target.value) || 1)} style={{ width: "100%", marginTop: 10, accentColor: "#0E9384" }} />
        </div>

        <div style={{ marginTop: 20 }}>
          <label className="label">Package</label>
          <input type="hidden" name="pkg" value={pkg} />
          <div className="ds-pkg-btns" style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={() => setPkg("Express")} style={pkgBtn(pkg === "Express")}>
              Express <span style={{ fontWeight: 500, opacity: 0.7 }}>≤ 7 aligners</span>
            </button>
            <button type="button" onClick={() => setPkg("Go")} style={pkgBtn(pkg === "Go")}>
              Go <span style={{ fontWeight: 500, opacity: 0.7 }}>up to 20+</span>
            </button>
          </div>
        </div>
          </>
        )}
        {copy.usesVeneerPackages && (
          <div style={{ marginTop: 12 }}>
            <label className="label">Veneers package</label>
            <input type="hidden" name="alignerCount" value={alignerCount} />
            <input type="hidden" name="pkg" value={pkg} />
            <div className="ds-pkg-btns" style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              {VENEER_PACKAGES.map((vp) => (
                <button
                  key={vp.teeth}
                  type="button"
                  onClick={() => setAlignerCount(vp.teeth)}
                  style={pkgBtn(alignerCount === vp.teeth)}
                >
                  {vp.teeth} teeth <span style={{ fontWeight: 500, opacity: 0.85 }}>{fmt(vp.pricePence)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {copy.usesTeethCount && !copy.usesVeneerPackages && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="label">{planCountLabel(treatment)}</label>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#0E9384" }}>{alignerCount}</span>
            </div>
            <input type="range" name="alignerCount" min={1} max={planCountMax(treatment)} value={alignerCount} onChange={(e) => setAlignerCount(parseInt(e.target.value) || 1)} style={{ width: "100%", marginTop: 10, accentColor: "#0E9384" }} />
            <div style={{ fontSize: 12, color: "#7A8696", marginTop: 6 }}>
              {fmt(COMPOSITE_PRICE_PER_TOOTH_PENCE)} per tooth
            </div>
            <input type="hidden" name="pkg" value={pkg} />
            {copy.offersWhitening && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 16, cursor: "pointer", fontSize: 14, color: "#3C4a59" }}>
                <input
                  type="checkbox"
                  name="includeWhitening"
                  checked={includeWhitening}
                  onChange={(e) => setIncludeWhitening(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2, accentColor: "#0E9384" }}
                />
                <span>
                  <strong>Add whitening</strong> (+{fmt(WHITENING_ADDON_PENCE)})
                  <span style={{ display: "block", fontSize: 12.5, color: "#7A8696", marginTop: 2 }}>Optional professional whitening alongside composite bonding.</span>
                </span>
              </label>
            )}
          </div>
        )}
        {!copy.usesAligners && !copy.usesTeethCount && (
          <>
            <input type="hidden" name="alignerCount" value={alignerCount} />
            <input type="hidden" name="pkg" value={pkg} />
          </>
        )}

        {owners && (
          <div style={{ marginTop: 20 }}>
            <label className="label">Belongs to admin</label>
            <select className="input" name="ownerId" defaultValue={patient.ownerId ?? ""}>
              <option value="">— Unassigned (Super Admins only) —</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}

        {copy.usesClinCheckVideo && (
        <div style={{ marginTop: 20 }}>
          <label className="label">ClinCheck video link *</label>
          <input className={"input" + (errs.video ? " err" : "")} name="videoUrl" value={video} onChange={(e) => { setVideo(e.target.value); setErrs((s) => ({ ...s, video: false })); }} placeholder="Paste ClinCheck video URL (https://…)" />
        </div>
        )}
        {copy.usesAiSimulation && (
        <div style={{ marginTop: 20 }}>
          <label className="label">AI simulation link *</label>
          <input className={"input" + (errs.video ? " err" : "")} name="videoUrl" value={video} onChange={(e) => { setVideo(e.target.value); setErrs((s) => ({ ...s, video: false })); }} placeholder="Paste AI Simulator URL (https://…)" />
          <div style={{ fontSize: 12, color: "#7A8696", marginTop: 6 }}>Patients see: &ldquo;See your future smile via our AI Simulator tool.&rdquo;</div>
        </div>
        )}
        {!copy.usesClinCheckVideo && !copy.usesAiSimulation && <input type="hidden" name="videoUrl" value={video} />}
        <div style={{ marginTop: 16 }}>
          <label className="label">Notes</label>
          <textarea className="input" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the coordinator should know…" rows={3} style={{ resize: "vertical" }} />
        </div>

        <ProposalActions
          isDraft={isDraft}
          patientId={patient.id}
          usesClinCheckVideo={copy.usesClinCheckVideo}
          usesAiSimulation={copy.usesAiSimulation}
          canDelete={canDelete}
          patientName={patientName}
        />
      </div>

      <div className="card ds-sticky-preview" style={{ padding: 24, position: "sticky", top: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#0E9384" }}>Live proposal preview</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 12 }}>{(firstName || "New") + " " + (lastName || "patient")}</div>
        <div style={{ fontSize: 13, color: "#8A96A5" }}>{email || "Email will appear here"}</div>

        <div style={{ marginTop: 20, border: "1px solid #EEF2F6", borderRadius: 14, overflow: "hidden" }}>
          {copy.usesAligners ? (
            <>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>{planCountShortLabel(treatment)}</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{alignerCount} · ≈{estMonths(alignerCount)} mo</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>Package</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{copy.label} {pkg}</span>
          </div>
            </>
          ) : copy.usesTeethCount ? (
          <>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>{planCountShortLabel(treatment)}</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{alignerCount}</span>
          </div>
          {copy.offersWhitening && includeWhitening && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>Whitening</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>+{fmt(WHITENING_ADDON_PENCE)}</span>
          </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>Treatment</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{copy.label}</span>
          </div>
          </>
          ) : copy.usesVeneerPackages ? (
          <>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>Package</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{alignerCount} teeth</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>Treatment</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{copy.label}</span>
          </div>
          </>
          ) : (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>Treatment</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{copy.label}</span>
          </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>Treatment total</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{fmt(price)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <span style={{ fontSize: 13, color: "#7A8696" }}>Less booking paid</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#B4530A" }}>− {fmt(bookingCredit)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 16px", background: "#F0FBF8" }}>
            <span style={{ fontSize: 13, color: "#0B7A6E", fontWeight: 600 }}>Balance remaining</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#0B7A6E" }}>{fmt(net)}</span>
          </div>
        </div>
      </div>
    </form>
  );
}
