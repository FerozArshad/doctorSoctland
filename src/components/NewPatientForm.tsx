"use client";
// Quick intake — creates a draft patient then opens the full proposal screen.
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createPatient } from "@/app/admin/actions";

function ContinueButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-teal" disabled={pending} style={{ marginTop: 26, width: "100%", padding: 13 }}>
      {pending ? "Opening proposal…" : "Continue to proposal"}
    </button>
  );
}

export default function NewPatientForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errs, setErrs] = useState({ first: false, email: false });

  const validate = (e: React.FormEvent<HTMLFormElement>) => {
    const first = !firstName.trim();
    const em = !/.+@.+\..+/.test(email);
    if (first || em) {
      e.preventDefault();
      setErrs({ first, email: em });
    }
  };

  return (
    <form action={createPatient} onSubmit={validate} className="ds-view" style={{ maxWidth: 520 }}>
      <input type="hidden" name="intent" value="draft" />
      <div className="card" style={{ padding: 26 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>New patient</div>
        <div style={{ fontSize: 13, color: "#7A8696", marginTop: 4, lineHeight: 1.55 }}>
          Enter the patient&apos;s contact details, then build the full treatment proposal on the next screen — including save draft and send.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 22 }}>
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

        <ContinueButton />

        <div style={{ fontSize: 12, color: "#9AA6B4", marginTop: 14, lineHeight: 1.6 }}>
          Aligners, package, video link, booking credit, <strong>Save draft</strong> and <strong>Send proposal</strong> are on the proposal screen.
        </div>
      </div>
    </form>
  );
}
