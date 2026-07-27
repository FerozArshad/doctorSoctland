"use client";
// Quick intake — creates a draft patient then opens the full proposal screen.
import { useState } from "react";
import { createPatient } from "@/app/admin/actions";
import FormSubmitButton from "@/components/FormSubmitButton";
import { TREATMENT_TYPES, type TreatmentType } from "@/lib/treatments";

type Tab = "treatment" | "details";

export default function NewPatientForm() {
  const [tab, setTab] = useState<Tab>("treatment");
  const [treatment, setTreatment] = useState<TreatmentType>("invisalign");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errs, setErrs] = useState({ first: false, email: false, treatment: false });

  const validate = (e: React.FormEvent<HTMLFormElement>) => {
    const first = !firstName.trim();
    const em = !/.+@.+\..+/.test(email);
    const tr = !treatment;
    if (first || em || tr) {
      e.preventDefault();
      setErrs({ first, email: em, treatment: tr });
      if (tr || tab === "treatment") setTab("treatment");
      else setTab("details");
    }
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "11px 14px",
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
    border: active ? "1.5px solid #0E9384" : "1.5px solid #E1E7EE",
    background: active ? "#E3F6F0" : "#fff",
    color: active ? "#0B7A6E" : "#5C6a79",
    textAlign: "center",
  });

  const treatmentBtn = (active: boolean): React.CSSProperties => ({
    padding: "14px 12px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
    border: active ? "2px solid #0E9384" : "1.5px solid #E1E7EE",
    background: active ? "#F0FBF8" : "#fff",
    color: active ? "#0B7A6E" : "#3C4a59",
    boxShadow: active ? "0 4px 14px -8px rgba(14,147,132,.45)" : "none",
  });

  return (
    <form action={createPatient} onSubmit={validate} className="ds-view" style={{ maxWidth: 560 }}>
      <input type="hidden" name="intent" value="draft" />
      <input type="hidden" name="treatmentType" value={treatment} />
      <div className="card" style={{ padding: 26 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>New patient</div>
        <div style={{ fontSize: 13, color: "#7A8696", marginTop: 4, lineHeight: 1.55 }}>
          Choose the treatment type, then enter contact details. The full proposal is built on the next screen.
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
          <button type="button" style={tabBtn(tab === "treatment")} onClick={() => setTab("treatment")}>
            1. Treatment
          </button>
          <button type="button" style={tabBtn(tab === "details")} onClick={() => setTab("details")}>
            2. Contact details
          </button>
        </div>

        {tab === "treatment" && (
          <div style={{ marginTop: 20 }}>
            <label className="label">Select treatment *</label>
            {errs.treatment && (
              <div style={{ fontSize: 12.5, color: "#C23B34", marginTop: 4 }}>Please select a treatment type.</div>
            )}
            <div className="ds-treatment-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              {TREATMENT_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setTreatment(t.key);
                    setErrs((s) => ({ ...s, treatment: false }));
                  }}
                  style={treatmentBtn(treatment === t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-teal"
              onClick={() => setTab("details")}
              style={{ marginTop: 22, width: "100%", padding: 13 }}
            >
              Continue to contact details
            </button>
          </div>
        )}

        {tab === "details" && (
          <div style={{ marginTop: 20 }}>
            <div style={{ marginBottom: 16, padding: "11px 14px", borderRadius: 11, background: "#F0FBF8", border: "1px solid #CFEDE5", fontSize: 13, color: "#0B7A6E", fontWeight: 600 }}>
              Treatment: {TREATMENT_TYPES.find((t) => t.key === treatment)?.label}
              <button type="button" onClick={() => setTab("treatment")} style={{ marginLeft: 10, background: "none", border: "none", color: "#0B7A6E", fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontSize: 13 }}>
                Change
              </button>
            </div>

            <div className="ds-form-2col">
              <div>
                <label className="label">First name *</label>
                <input
                  className={"input" + (errs.first ? " err" : "")}
                  name="firstName"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    setErrs((s) => ({ ...s, first: false }));
                  }}
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="label">Last name</label>
                <input className="input" name="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="label">Email *</label>
                <input
                  className={"input" + (errs.email ? " err" : "")}
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrs((s) => ({ ...s, email: false }));
                  }}
                  placeholder="name@email.com"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="label">Phone (WhatsApp)</label>
                <input className="input" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
              <button type="button" className="btn btn-outline" onClick={() => setTab("treatment")} style={{ flex: 1, padding: 13 }}>
                Back
              </button>
              <FormSubmitButton
                label="Continue to proposal"
                pendingLabel="Opening proposal…"
                style={{ flex: 1.4, padding: 13 }}
              />
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 14, lineHeight: 1.6 }}>
          Aligners, package, video link, booking credit, <strong>Save draft</strong> and <strong>Send proposal</strong> are on the proposal screen.
        </div>
      </div>
    </form>
  );
}
