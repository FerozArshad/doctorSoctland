// Practice content shown on proposals — edit freely.
import { normalizeTreatmentType, treatmentCopy, type TreatmentType } from "./treatments";

export type InclusionItem = { label: string; value: string };

const INVISALIGN_ITEMS: InclusionItem[] = [
  { label: "Free consultation", value: "£200" },
  { label: "Comprehensive orthodontic assessment", value: "£75" },
  { label: "Digital iTero scan, OPG & X-rays", value: "£100" },
  { label: "Premium whitening kit", value: "£350" },
  { label: "Free set of retainers", value: "£150" },
];

const VENEERS_ITEMS: InclusionItem[] = [
  { label: "Free consultation", value: "£200" },
  { label: "Comprehensive dental assessment", value: "£75" },
  { label: "Digital iTero scan & imaging", value: "£100" },
  { label: "Bespoke smile design", value: "£200" },
  { label: "Aftercare review", value: "£100" },
];

const COMPOSITE_ITEMS: InclusionItem[] = [
  { label: "Free consultation", value: "£200" },
  { label: "Comprehensive dental assessment", value: "£75" },
  { label: "Digital scan & shade matching", value: "£100" },
  { label: "Polish & finish", value: "£75" },
  { label: "Aftercare kit", value: "£50" },
];

const IMPLANTS_ITEMS: InclusionItem[] = [
  { label: "Free consultation", value: "£200" },
  { label: "CBCT scan & diagnostics", value: "£150" },
  { label: "Comprehensive treatment planning", value: "£100" },
  { label: "Surgical guide", value: "£200" },
  { label: "Aftercare review", value: "£100" },
];

const GENERIC_ITEMS: InclusionItem[] = [
  { label: "Free consultation", value: "£200" },
  { label: "Comprehensive assessment", value: "£75" },
  { label: "Digital scan & imaging", value: "£100" },
  { label: "Personalised treatment planning", value: "£150" },
];

const INCLUSIONS: Record<TreatmentType, InclusionItem[]> = {
  invisalign: INVISALIGN_ITEMS,
  veneers: VENEERS_ITEMS,
  composite_bonding: COMPOSITE_ITEMS,
  implants: IMPLANTS_ITEMS,
  other: GENERIC_ITEMS,
};

const INCLUSION_TOTALS: Record<TreatmentType, string> = {
  invisalign: "£875",
  veneers: "£675",
  composite_bonding: "£500",
  implants: "£750",
  other: "£525",
};

/** @deprecated Use includedItemsFor() — Invisalign-only defaults. */
export const COMP_ITEMS = INVISALIGN_ITEMS;
/** @deprecated Use includedTotalFor() — Invisalign-only defaults. */
export const COMP_TOTAL = INCLUSION_TOTALS.invisalign;

export function includedItemsFor(treatmentType: string | null | undefined): InclusionItem[] {
  return INCLUSIONS[normalizeTreatmentType(treatmentType)];
}

export function includedTotalFor(treatmentType: string | null | undefined): string {
  return INCLUSION_TOTALS[normalizeTreatmentType(treatmentType)];
}

type WhyUsItem = { title: string; text: string };

const WHY_US_BASE: WhyUsItem[] = [
  { title: "Digital iTero scanning", text: "See your predicted result before you start — no messy impressions." },
  { title: "Flexible ways to pay", text: "Pay-in-full discount, simple instalments or 0% interest-free finance." },
  { title: "Local & convenient", text: "Appointments that fit around you, right here in Scotland." },
];

const WHY_US_TAIL: Record<TreatmentType, WhyUsItem> = {
  invisalign: {
    title: "Aftercare promise",
    text: "We look after your smile long after the aligners come off.",
  },
  veneers: {
    title: "Aftercare promise",
    text: "We look after your new smile with ongoing reviews and support.",
  },
  composite_bonding: {
    title: "Aftercare promise",
    text: "We look after your bonded smile with ongoing reviews and support.",
  },
  implants: {
    title: "Aftercare promise",
    text: "Long-term implant care and reviews included in your journey with us.",
  },
  other: {
    title: "Aftercare promise",
    text: "We look after your smile long after treatment is complete.",
  },
};

/** @deprecated Use whyUsFor() — Invisalign-only defaults. */
export const WHY_US: WhyUsItem[] = [
  { title: "Award-winning clinicians", text: "Experienced Invisalign providers who have transformed hundreds of Scottish smiles." },
  { title: "Everything included", text: "Whitening kit, retainers, scans and X-rays — £875 of extras at no additional cost." },
  ...WHY_US_BASE,
  WHY_US_TAIL.invisalign,
];

export function whyUsFor(treatmentType: string | null | undefined): WhyUsItem[] {
  const t = normalizeTreatmentType(treatmentType);
  const copy = treatmentCopy(t);
  const total = includedTotalFor(t);
  const lead = copy.usesAligners
    ? "Experienced Invisalign providers who have transformed hundreds of Scottish smiles."
    : `Experienced ${copy.label.toLowerCase()} specialists delivering beautiful results across Scotland.`;
  const included = copy.usesAligners
    ? `Whitening kit, retainers, scans and X-rays — ${total} of extras at no additional cost.`
    : `Consultation, scans and planning — ${total} of extras at no additional cost.`;
  return [
    { title: "Award-winning clinicians", text: lead },
    { title: "Everything included", text: included },
    ...WHY_US_BASE,
    WHY_US_TAIL[t],
  ];
}
