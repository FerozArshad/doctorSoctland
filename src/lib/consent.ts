// Treatment-specific informed consent shown in the consent modal. The patient
// ticks agreement and signs; we store the signature + timestamp on their record.
import { normalizeTreatmentType, type TreatmentType } from "./treatments";

export type ConsentCopy = {
  title: string;
  paragraphs: string[];
  checkboxLabel: string;
};

const COPY: Record<TreatmentType, ConsentCopy> = {
  invisalign: {
    title: "Informed consent — Invisalign orthodontic treatment",
    paragraphs: [
      "Your clinician has recommended the Invisalign system for your orthodontic treatment. While orthodontic treatment can lead to a healthier, more attractive smile, all orthodontic treatment has limitations and potential risks you should consider before starting.",
      "Device & procedure: Invisalign aligners are a series of clear, removable appliances that move your teeth in small increments, produced from your clinician's diagnosis, scans/impressions and prescription. You may undergo a routine pre-treatment examination including radiographs and photographs.",
      "Risks & inconveniences may include: longer treatment if aligners are not worn as directed; temporary tooth tenderness when changing aligners; irritation of gums, cheeks or lips; teeth shifting after treatment (retainers reduce this); tooth decay or gum problems with poor oral hygiene; a temporary lisp or change in speech; and increased salivation or mouth dryness.",
      "By signing below, I confirm that I have read and understood this information, have had the opportunity to ask questions, and give my informed consent to proceed with Invisalign orthodontic treatment with Dental Scotland.",
    ],
    checkboxLabel:
      "I have read, consent and agree to all documents attached — Terms & Conditions, informed consent, and proceeding with Invisalign treatment with Dental Scotland.",
  },
  veneers: {
    title: "Informed consent — dental veneers treatment",
    paragraphs: [
      "Your clinician has recommended dental veneers as part of your cosmetic treatment plan. Veneers can improve the appearance of your smile, but like all dental procedures they have limitations and potential risks you should understand before proceeding.",
      "Device & procedure: Veneers are thin, custom-made shells bonded to the front surface of teeth. Treatment typically involves enamel preparation, digital scans or impressions, a try-in stage, and final bonding. You may undergo radiographs and photographs as part of assessment.",
      "Risks & inconveniences may include: temporary sensitivity; irreversible removal of a small amount of enamel; veneers chipping, debonding or wear over time; colour mismatch or need for replacement in future; gum irritation during adjustment; and the need for night-time protection in some cases.",
      "By signing below, I confirm that I have read and understood this information, have had the opportunity to ask questions, and give my informed consent to proceed with veneers treatment with Dental Scotland.",
    ],
    checkboxLabel:
      "I have read, consent and agree to all documents attached — Terms & Conditions, informed consent, and proceeding with veneers treatment with Dental Scotland.",
  },
  implants: {
    title: "Informed consent — dental implants treatment",
    paragraphs: [
      "Your clinician has recommended dental implants to replace missing teeth or support a restoration. Implant treatment can restore function and appearance, but surgical and restorative dentistry carries risks you should consider before starting.",
      "Device & procedure: A dental implant is a titanium fixture placed in the jawbone, usually followed by a healing period before a crown, bridge or denture is attached. You may require CBCT imaging, surgical guide planning, bone grafting, or temporary restorations.",
      "Risks & inconveniences may include: swelling, bruising or discomfort after surgery; infection; implant failure or delayed healing; nerve injury causing numbness (usually temporary); sinus complications for upper implants; and the need for further surgery or alternative treatment if integration is unsuccessful.",
      "By signing below, I confirm that I have read and understood this information, have had the opportunity to ask questions, and give my informed consent to proceed with dental implants treatment with Dental Scotland.",
    ],
    checkboxLabel:
      "I have read, consent and agree to all documents attached — Terms & Conditions, informed consent, and proceeding with dental implants treatment with Dental Scotland.",
  },
  composite_bonding: {
    title: "Informed consent — composite bonding treatment",
    paragraphs: [
      "Your clinician has recommended composite bonding to improve the shape, shade or symmetry of your teeth. Bonding is a minimally invasive cosmetic option, but you should understand the procedure and its limitations before proceeding.",
      "Device & procedure: Composite resin is applied directly to the tooth surface, shaped and polished to improve appearance. Treatment may include shade matching, minor enamel preparation, and optional whitening as part of your plan.",
      "Risks & inconveniences may include: temporary sensitivity; staining or discolouration over time; chipping or wear requiring repair or replacement; slight change in bite feel after treatment; and results that may differ from digital previews or photographs.",
      "By signing below, I confirm that I have read and understood this information, have had the opportunity to ask questions, and give my informed consent to proceed with composite bonding treatment with Dental Scotland.",
    ],
    checkboxLabel:
      "I have read, consent and agree to all documents attached — Terms & Conditions, informed consent, and proceeding with composite bonding treatment with Dental Scotland.",
  },
  other: {
    title: "Informed consent — dental treatment",
    paragraphs: [
      "Your clinician has recommended a personalised dental treatment plan. All dental care has benefits, limitations and potential risks you should consider before proceeding.",
      "Procedure: Your treatment may include examination, imaging, restorative or cosmetic care as outlined in your proposal. Specific steps will be explained by your clinician before treatment begins.",
      "Risks & inconveniences may include: temporary sensitivity or discomfort; need for further appointments; changes to bite or appearance; and outcomes that may differ from estimates discussed at consultation.",
      "By signing below, I confirm that I have read and understood this information, have had the opportunity to ask questions, and give my informed consent to proceed with the recommended treatment with Dental Scotland.",
    ],
    checkboxLabel:
      "I have read, consent and agree to all documents attached — Terms & Conditions, informed consent, and proceeding with my treatment with Dental Scotland.",
  },
};

export function consentCopy(treatmentType: string | null | undefined): ConsentCopy {
  return COPY[normalizeTreatmentType(treatmentType)];
}

export function consentTitle(treatmentType: string | null | undefined): string {
  return consentCopy(treatmentType).title;
}

export function consentParagraphs(treatmentType: string | null | undefined): string[] {
  return consentCopy(treatmentType).paragraphs;
}

export function consentCheckboxLabel(treatmentType: string | null | undefined): string {
  return consentCopy(treatmentType).checkboxLabel;
}

/** @deprecated Use consentTitle() — Invisalign default for legacy imports. */
export const CONSENT_TITLE = COPY.invisalign.title;
/** @deprecated Use consentParagraphs() — Invisalign default for legacy imports. */
export const CONSENT_PARAGRAPHS = COPY.invisalign.paragraphs;
/** @deprecated Use consentCheckboxLabel() — Invisalign default for legacy imports. */
export const CONSENT_CHECKBOX_LABEL = COPY.invisalign.checkboxLabel;
