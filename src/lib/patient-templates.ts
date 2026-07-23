/** Copy-paste / sendable patient message templates (email + WhatsApp). */

export type PatientTemplateId = "invisalign_ordered" | "finance_received";

export function patientTemplateText(id: PatientTemplateId, firstName: string): string {
  const name = firstName.trim() || "there";
  switch (id) {
    case "invisalign_ordered":
      return `Hi ${name}, Thanks so much for choosing Dental Scotland 😊 Your Invisalign has now been ordered and will take 2–3 weeks for delivery. Once it arrives, we'll be in touch to arrange your 1-hour fit appointment. Congratulations on starting your smile journey!`;
    case "finance_received":
      return `Hi ${name}, Thanks so much for choosing Dental Scotland 😊 We've received your 0% finance application. Our team will email your secure application link shortly — keep an eye on your inbox. Congratulations on starting your smile journey!`;
  }
}

export function patientTemplateTitle(id: PatientTemplateId): string {
  switch (id) {
    case "invisalign_ordered":
      return "Invisalign ordered";
    case "finance_received":
      return "Finance application received";
  }
}
