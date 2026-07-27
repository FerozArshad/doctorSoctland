import { normalisePhone } from "./notify";

export type ProposalFields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  videoUrl: string;
  alignerCount: number;
  pkg: string;
};

/** Required before a proposal can be emailed to the patient. */
export function validateProposalForSend(fields: ProposalFields): { ok: true } | { ok: false; message: string } {
  if (!fields.firstName.trim()) {
    return { ok: false, message: "First name is required before sending" };
  }
  if (!fields.lastName.trim()) {
    return { ok: false, message: "Last name is required before sending" };
  }
  if (!/.+@.+\..+/.test(fields.email.trim())) {
    return { ok: false, message: "A valid email is required before sending" };
  }
  const phone = (fields.phone || "").trim();
  if (!phone || phone === "—" || !normalisePhone(phone)) {
    return { ok: false, message: "A valid mobile number (WhatsApp) is required before sending" };
  }
  const video = (fields.videoUrl || "").trim();
  if (!/^https?:\/\/.+/i.test(video)) {
    return { ok: false, message: "ClinCheck video link is required before sending" };
  }
  if (!fields.alignerCount || fields.alignerCount < 1) {
    return { ok: false, message: "Number of aligners is required before sending" };
  }
  if (fields.pkg !== "Express" && fields.pkg !== "Go") {
    return { ok: false, message: "Package (Express or Go) is required before sending" };
  }
  return { ok: true };
}
