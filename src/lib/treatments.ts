export const TREATMENT_TYPES = [
  { key: "invisalign", label: "Invisalign" },
  { key: "veneers", label: "Veneers" },
  { key: "implants", label: "Implants" },
  { key: "composite_bonding", label: "Composite bonding" },
  { key: "other", label: "Other" },
] as const;

export type TreatmentType = (typeof TREATMENT_TYPES)[number]["key"];

const KEYS = new Set<string>(TREATMENT_TYPES.map((t) => t.key));

export type TreatmentCopy = {
  label: string;
  proposalTitle: string;
  proposalHeading: string;
  portalBadge: string;
  planSectionTitle: string;
  followUpPlanName: string;
  usesAligners: boolean;
  usesTeethCount: boolean;
  usesVeneerPackages: boolean;
  offersWhitening: boolean;
  usesClinCheckVideo: boolean;
  /** AI smile simulator link (non-Invisalign treatments). */
  usesAiSimulation: boolean;
  emailIntro: string;
  whatsAppProposalLead: string;
  orderedMessage: (firstName: string) => string;
  orderedTemplateTitle: string;
  paidConfirmationNote: string;
  receiptNextSteps: string;
  otpProposalLabel: string;
};

const COPY: Record<TreatmentType, TreatmentCopy> = {
  invisalign: {
    label: "Invisalign",
    proposalTitle: "Your Invisalign Treatment Proposal",
    proposalHeading: "Your Invisalign Treatment Proposal",
    portalBadge: "Invisalign Proposal",
    planSectionTitle: "Your Invisalign plan",
    followUpPlanName: "Invisalign plan",
    usesAligners: true,
    usesTeethCount: false,
    usesVeneerPackages: false,
    offersWhitening: false,
    usesClinCheckVideo: true,
    usesAiSimulation: false,
    emailIntro:
      "Thank you for attending your Invisalign assessment with Dental Scotland. Your personalised ClinCheck treatment plan is now complete — view it, watch your smile transformation video, and choose how you'd like to pay.",
    whatsAppProposalLead: "Your personalised Invisalign treatment proposal from Dental Scotland is ready.",
    orderedMessage: (name) =>
      `Hi ${name}, Thanks so much for choosing Dental Scotland 😊 Your Invisalign has now been ordered and will take 2–3 weeks for delivery. Once it arrives, we'll be in touch to arrange your 1-hour fit appointment. Congratulations on starting your smile journey!`,
    orderedTemplateTitle: "Invisalign ordered",
    paidConfirmationNote: "we'll arrange your aligner fitting",
    receiptNextSteps: "Our Treatment Coordinator will be in touch shortly about your aligner fitting.",
    otpProposalLabel: "Invisalign proposal",
  },
  veneers: {
    label: "Veneers",
    proposalTitle: "Your Veneers Treatment Proposal",
    proposalHeading: "Your Veneers Treatment Proposal",
    portalBadge: "Veneers Proposal",
    planSectionTitle: "Your veneers plan",
    followUpPlanName: "veneers treatment plan",
    usesAligners: false,
    usesTeethCount: true,
    usesVeneerPackages: true,
    offersWhitening: false,
    usesClinCheckVideo: false,
    usesAiSimulation: true,
    emailIntro:
      "Thank you for attending your veneers consultation with Dental Scotland. Your personalised treatment plan is ready — review the details and choose how you'd like to pay.",
    whatsAppProposalLead: "Your personalised veneers treatment proposal from Dental Scotland is ready.",
    orderedMessage: (name) =>
      `Hi ${name}, Thanks so much for choosing Dental Scotland 😊 Your veneers treatment has been confirmed. Our team will be in touch shortly to arrange your next appointment. Congratulations on starting your smile journey!`,
    orderedTemplateTitle: "Veneers confirmed",
    paidConfirmationNote: "we'll arrange your next appointment",
    receiptNextSteps: "Our Treatment Coordinator will be in touch shortly to arrange your veneers appointment.",
    otpProposalLabel: "veneers proposal",
  },
  implants: {
    label: "Implants",
    proposalTitle: "Your Dental Implants Proposal",
    proposalHeading: "Your Dental Implants Proposal",
    portalBadge: "Implants Proposal",
    planSectionTitle: "Your implants plan",
    followUpPlanName: "dental implants plan",
    usesAligners: false,
    usesTeethCount: false,
    usesVeneerPackages: false,
    offersWhitening: false,
    usesClinCheckVideo: false,
    usesAiSimulation: true,
    emailIntro:
      "Thank you for attending your dental implants consultation with Dental Scotland. Your personalised treatment plan is ready — review the details and choose how you'd like to pay.",
    whatsAppProposalLead: "Your personalised dental implants proposal from Dental Scotland is ready.",
    orderedMessage: (name) =>
      `Hi ${name}, Thanks so much for choosing Dental Scotland 😊 Your implants treatment has been confirmed. Our team will be in touch shortly to arrange your next appointment.`,
    orderedTemplateTitle: "Implants confirmed",
    paidConfirmationNote: "we'll arrange your next appointment",
    receiptNextSteps: "Our Treatment Coordinator will be in touch shortly to arrange your implants appointment.",
    otpProposalLabel: "dental implants proposal",
  },
  composite_bonding: {
    label: "Composite bonding",
    proposalTitle: "Your Composite Bonding Proposal",
    proposalHeading: "Your Composite Bonding Proposal",
    portalBadge: "Composite Bonding Proposal",
    planSectionTitle: "Your composite bonding plan",
    followUpPlanName: "composite bonding plan",
    usesAligners: false,
    usesTeethCount: true,
    usesVeneerPackages: false,
    offersWhitening: true,
    usesClinCheckVideo: false,
    usesAiSimulation: true,
    emailIntro:
      "Thank you for attending your composite bonding consultation with Dental Scotland. Your personalised treatment plan is ready — review the details and choose how you'd like to pay.",
    whatsAppProposalLead: "Your personalised composite bonding proposal from Dental Scotland is ready.",
    orderedMessage: (name) =>
      `Hi ${name}, Thanks so much for choosing Dental Scotland 😊 Your composite bonding treatment has been confirmed. Our team will be in touch shortly to arrange your appointment.`,
    orderedTemplateTitle: "Composite bonding confirmed",
    paidConfirmationNote: "we'll arrange your appointment",
    receiptNextSteps: "Our Treatment Coordinator will be in touch shortly to arrange your composite bonding appointment.",
    otpProposalLabel: "composite bonding proposal",
  },
  other: {
    label: "Other",
    proposalTitle: "Your Treatment Proposal",
    proposalHeading: "Your Treatment Proposal",
    portalBadge: "Treatment Proposal",
    planSectionTitle: "Your treatment plan",
    followUpPlanName: "treatment plan",
    usesAligners: false,
    usesTeethCount: false,
    usesVeneerPackages: false,
    offersWhitening: false,
    usesClinCheckVideo: false,
    usesAiSimulation: true,
    emailIntro:
      "Thank you for visiting Dental Scotland. Your personalised treatment plan is ready — review the details and choose how you'd like to pay.",
    whatsAppProposalLead: "Your personalised treatment proposal from Dental Scotland is ready.",
    orderedMessage: (name) =>
      `Hi ${name}, Thanks so much for choosing Dental Scotland 😊 Your treatment has been confirmed. Our team will be in touch shortly with next steps.`,
    orderedTemplateTitle: "Treatment confirmed",
    paidConfirmationNote: "we'll be in touch with next steps",
    receiptNextSteps: "Our Treatment Coordinator will be in touch shortly with next steps for your treatment.",
    otpProposalLabel: "treatment proposal",
  },
};

export function isTreatmentType(value: string): value is TreatmentType {
  return KEYS.has(value);
}

export function normalizeTreatmentType(key: string | null | undefined): TreatmentType {
  const k = key || "";
  return isTreatmentType(k) ? k : "invisalign";
}

export function treatmentLabel(key: string | null | undefined): string {
  return COPY[normalizeTreatmentType(key)].label;
}

export function treatmentCopy(key: string | null | undefined): TreatmentCopy {
  return COPY[normalizeTreatmentType(key)];
}

export function parseTreatmentType(raw: FormDataEntryValue | null): TreatmentType {
  return normalizeTreatmentType(String(raw || "").trim());
}

/** Max value for the plan count slider (aligners or teeth). */
export function planCountMax(key: string | null | undefined): number {
  const copy = treatmentCopy(key);
  if (copy.usesTeethCount) return 20;
  if (copy.usesAligners) return 40;
  return 20;
}

export function planCountLabel(key: string | null | undefined): string {
  const copy = treatmentCopy(key);
  if (copy.usesAligners) return "Number of aligners";
  if (copy.usesTeethCount) return "Number of teeth";
  return "";
}

export function planCountShortLabel(key: string | null | undefined): string {
  const copy = treatmentCopy(key);
  if (copy.usesAligners) return "Aligners";
  if (copy.usesTeethCount) return "Teeth";
  return "Treatment";
}

export function defaultPlanCount(key: string | null | undefined): number {
  const copy = treatmentCopy(key);
  if (copy.usesVeneerPackages) return 6;
  if (copy.usesTeethCount) return 6;
  if (copy.usesAligners) return 14;
  return 1;
}

export function isValidVeneerTeethCount(teeth: number): boolean {
  return teeth === 6 || teeth === 10 || teeth === 20;
}

export const TREATMENT_TAG_STYLE: Record<TreatmentType, { fg: string; bg: string }> = {
  invisalign: { fg: "#0B7A6E", bg: "#E3F6F0" },
  veneers: { fg: "#1B5E8C", bg: "#E8F2FA" },
  implants: { fg: "#5C3E8C", bg: "#F0EBFA" },
  composite_bonding: { fg: "#B7791F", bg: "#FBF3E2" },
  other: { fg: "#3C4a59", bg: "#EEF2F6" },
};

export function paymentReceiptLabel(
  paymentType: string,
  treatmentKey: string | null | undefined
): string {
  const t = treatmentLabel(treatmentKey);
  if (paymentType === "full") return `Pay in full — ${t} treatment`;
  if (paymentType === "deposit") return `Treatment deposit — ${t}`;
  if (paymentType === "instalment") return `Monthly instalment — ${t} treatment`;
  if (paymentType === "manual") return `Manual payment — ${t} treatment`;
  return `${t} treatment payment`;
}

export function paymentServiceDescription(
  treatmentKey: string | null | undefined,
  pkg: string,
  alignerCount: number,
  includeWhitening?: boolean
): string {
  const copy = treatmentCopy(treatmentKey);
  const t = normalizeTreatmentType(treatmentKey);
  if (copy.usesAligners) {
    return `Invisalign ${pkg} treatment (${alignerCount} aligners)`;
  }
  if (t === "veneers") {
    return `${copy.label} treatment (${alignerCount} teeth package)`;
  }
  if (t === "composite_bonding") {
    const base = `${copy.label} treatment (${alignerCount} teeth`;
    return includeWhitening ? `${base} + whitening)` : `${base})`;
  }
  if (copy.usesTeethCount) {
    return `${copy.label} treatment (${alignerCount} teeth)`;
  }
  return `${copy.label} treatment`;
}
