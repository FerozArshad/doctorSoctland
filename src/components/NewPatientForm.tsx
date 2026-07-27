"use client";
// Quick intake — creates a draft patient then opens the full proposal screen.
import { useState } from "react";
import { createPatient } from "@/app/admin/actions";
import FormSubmitButton from "@/components/FormSubmitButton";
import TreatmentTabs from "@/components/TreatmentTabs";
import TreatmentBadge from "@/components/TreatmentBadge";
import { type TreatmentType } from "@/lib/treatments";

export default function NewPatientForm() {
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
    }
  };

  return (
    <form action={createPatient} onSubmit={validate} className="ds-view" style={{ maxWidth: 560 }}>
      <input type="hidden" name="intent" value="draft" />
      <input type="hidden" name="treatmentType" value={treatment} />
      <div className="card" style={{ padding: 26 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>New patient</div>
            <div style={{ fontSize: 13, color: "#7A8696", marginTop: 4, lineHeight: 1.55 }}>
              Select treatment and enter contact details. The proposal is built on the next screen.
            </div>
          </div>
          <TreatmentBadge treatmentType={treatment} />
        </div>

        <div style={{ marginTop: 22 }}>
          <TreatmentTabs
            value={treatment}
            onChange={(key) => {
              setTreatment(key);
              setErrs((s) => ({ ...s, treatment: false }));
            }}
            error={errs.treatment}
          />
        </div>

        <div style={{ height: 1, background: "#EEF2F6", margin: "24px 0" }} />

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

        <FormSubmitButton
          label="Continue to proposal"
          pendingLabel="Opening proposal…"
          style={{ marginTop: 26, width: "100%", padding: 13 }}
        />

        <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 14, lineHeight: 1.6 }}>
          Pricing, video link, booking credit, <strong>Save draft</strong> and <strong>Send proposal</strong> are on the next screen — tailored to the treatment you select.
        </div>
      </div>
    </form>
  );
}
