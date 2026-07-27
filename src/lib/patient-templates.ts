/** Copy-paste / sendable patient message templates (email + WhatsApp). */

import { treatmentCopy } from "./treatments";

export type PatientTemplateId = "treatment_ordered" | "finance_received";

export function orderedTemplateText(treatmentType: string | null | undefined, firstName: string): string {
  return treatmentCopy(treatmentType).orderedMessage(firstName.trim() || "there");
}

export function orderedTemplateTitle(treatmentType: string | null | undefined): string {
  return treatmentCopy(treatmentType).orderedTemplateTitle;
}

export function patientTemplateText(
  id: PatientTemplateId,
  firstName: string,
  treatmentType?: string | null
): string {
  const name = firstName.trim() || "there";
  switch (id) {
    case "treatment_ordered":
      return orderedTemplateText(treatmentType, name);
    case "finance_received":
      return `Hi ${name}, Thanks so much for choosing Dental Scotland 😊 We've received your 0% finance application. Our team will email your secure application link shortly — keep an eye on your inbox. Congratulations on starting your smile journey!`;
  }
}

export function patientTemplateTitle(id: PatientTemplateId, treatmentType?: string | null): string {
  switch (id) {
    case "treatment_ordered":
      return orderedTemplateTitle(treatmentType);
    case "finance_received":
      return "Finance application received";
  }
}
