export const TREATMENT_TYPES = [
  { key: "invisalign", label: "Invisalign" },
  { key: "veneers", label: "Veneers" },
  { key: "implants", label: "Implants" },
  { key: "composite_bonding", label: "Composite bonding" },
  { key: "other", label: "Other" },
] as const;

export type TreatmentType = (typeof TREATMENT_TYPES)[number]["key"];

const KEYS = new Set<string>(TREATMENT_TYPES.map((t) => t.key));

export function isTreatmentType(value: string): value is TreatmentType {
  return KEYS.has(value);
}

export function treatmentLabel(key: string | null | undefined): string {
  return TREATMENT_TYPES.find((t) => t.key === key)?.label ?? "Invisalign";
}

export function parseTreatmentType(raw: FormDataEntryValue | null): TreatmentType {
  const v = String(raw || "").trim();
  return isTreatmentType(v) ? v : "invisalign";
}
