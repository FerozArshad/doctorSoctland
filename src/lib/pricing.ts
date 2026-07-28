// Pure pricing maths. Values come from a PricingConfig (editable by admins and
// stored in the Pricing table) — never import the DB here, this file is safe to
// use from client components. Load the config with getPricing() (server-only).

export type PricingConfig = {
  tier1MaxAligners: number;
  tier1Pence: number;
  tier2MaxAligners: number;
  tier2Pence: number;
  tier3Pence: number;
  depositPence: number;
  upfrontPence: number;
  discountPct: number;
};

/// Fallbacks if the Pricing row is missing: ≤7 → £1,500 · 8–15 → £2,250 · 16+ → £2,750
export const PRICING_DEFAULTS: PricingConfig = {
  tier1MaxAligners: 7,
  tier1Pence: 150_000,
  tier2MaxAligners: 15,
  tier2Pence: 225_000,
  tier3Pence: 275_000,
  depositPence: 70_000, // £700
  upfrontPence: 25_000, // £250 consultation/booking paid before the proposal (Invisalign)
  discountPct: 5,
};

/** £30 booking credit for veneers and composite bonding. */
export const REDUCED_BOOKING_CREDIT_PENCE = 3_000;

// Total the patient still owes: treatment price minus any upfront already paid.
// All payment options (full / deposit / instalments / finance) are computed on this.
export function netPricePence(pricePence: number, upfrontPaidPence: number): number {
  return Math.max(0, pricePence - (upfrontPaidPence || 0));
}

/** Assessment booking fee — credited for every patient by default (Invisalign). */
export function bookingCreditPence(cfg: PricingConfig = PRICING_DEFAULTS): number {
  return cfg.upfrontPence;
}

/** Treatment-aware booking credit — £30 for veneers & composite bonding; config value for Invisalign etc. */
export function treatmentBookingCreditPence(
  treatmentType: string | null | undefined,
  cfg: PricingConfig = PRICING_DEFAULTS
): number {
  const t = (treatmentType || "invisalign").trim();
  if (t === "veneers" || t === "composite_bonding") return REDUCED_BOOKING_CREDIT_PENCE;
  return cfg.upfrontPence;
}

export function patientBalancePence(
  pricePence: number,
  cfgOrUpfront: PricingConfig | number = PRICING_DEFAULTS,
  treatmentType?: string | null
): number {
  const upfront =
    typeof cfgOrUpfront === "number"
      ? cfgOrUpfront
      : treatmentBookingCreditPence(treatmentType, cfgOrUpfront);
  return netPricePence(pricePence, upfront);
}

export function priceForPence(alignerCount: number, cfg: PricingConfig = PRICING_DEFAULTS): number {
  if (alignerCount <= cfg.tier1MaxAligners) return cfg.tier1Pence;
  if (alignerCount <= cfg.tier2MaxAligners) return cfg.tier2Pence;
  return cfg.tier3Pence;
}

// Estimated treatment time by tier: ≤7 → 6 months · 8–15 → 10 · 16+ → 12.
export function estMonths(alignerCount: number): number {
  if (alignerCount <= 7) return 6;
  if (alignerCount <= 15) return 10;
  return 12;
}

// Pay-in-full price after discount
export function fullPricePence(pricePence: number, discountPct: number): number {
  return Math.round(pricePence * (1 - discountPct / 100));
}

// Each of the 3 monthly instalments after the deposit. depositPence is required
// on purpose — a default would silently use £700 after an admin changes it.
export function instalmentPence(netPence: number, depositPence: number): number {
  return Math.round((netPence - depositPence) / 3);
}

// Illustrative "from £x/mo" for 36-month 0% finance
export function finance36Pence(pricePence: number): number {
  return Math.round(pricePence / 36);
}

export function fmt(pence: number): string {
  return "£" + Math.round(pence / 100).toLocaleString("en-GB");
}

// ── Veneers (sliding per-unit pricing) & composite bonding ───────────────
export const COMPOSITE_PRICE_PER_TOOTH_PENCE = 24_900; // £249
export const WHITENING_ADDON_PENCE = 35_000; // £350

/** Minimum veneer units on a proposal. */
export const VENEER_MIN_UNITS = 6;

export const VENEER_UNIT_TIERS = [
  { min: 6, max: 9, pricePerUnitPence: 41_500, label: "6–9 units · £415 per unit" },
  { min: 10, max: 19, pricePerUnitPence: 35_000, label: "10–19 units · £350 per unit" },
  { min: 20, max: 99, pricePerUnitPence: 30_000, label: "20+ units · £300 per unit" },
] as const;

/** Per-unit rate in pence for the given veneer count (tier applied to total units). */
export function veneerUnitPricePence(units: number): number {
  const u = Math.round(units);
  if (u >= 20) return 30_000;
  if (u >= 10) return 35_000;
  if (u >= 6) return 41_500;
  return 41_500;
}

/** Human-readable tier label for the current unit count. */
export function veneerPriceTierLabel(units: number): string {
  const u = Math.round(units);
  if (u >= 20) return VENEER_UNIT_TIERS[2].label;
  if (u >= 10) return VENEER_UNIT_TIERS[1].label;
  return VENEER_UNIT_TIERS[0].label;
}

/** Total veneers treatment price = per-unit rate × unit count. */
export function veneerPricePence(units: number): number {
  const u = Math.round(units);
  if (u < VENEER_MIN_UNITS) return veneerUnitPricePence(VENEER_MIN_UNITS) * VENEER_MIN_UNITS;
  return veneerUnitPricePence(u) * u;
}

export function compositeBondingPricePence(teeth: number, includeWhitening = false): number {
  const base = Math.max(0, teeth) * COMPOSITE_PRICE_PER_TOOTH_PENCE;
  return base + (includeWhitening ? WHITENING_ADDON_PENCE : 0);
}

/** Total treatment price before booking credit — treatment-type aware. */
export function treatmentPricePence(
  treatmentType: string,
  count: number,
  cfg: PricingConfig = PRICING_DEFAULTS,
  opts?: { includeWhitening?: boolean }
): number {
  const t = (treatmentType || "invisalign").trim();
  if (t === "veneers") return veneerPricePence(count);
  if (t === "composite_bonding") return compositeBondingPricePence(count, !!opts?.includeWhitening);
  return priceForPence(count, cfg);
}

/** Human-readable label for a stored paymentPreference (admin profile view). */
export function paymentPreferenceLabel(preference: string, depositPence: number): string {
  const deposit = `${fmt(depositPence)} deposit + 3 instalments`;
  const labels: Record<string, string> = {
    full: "Pay in full",
    deposit,
    finance: "0% finance — application sent",
    // Legacy — monthly route removed; same as deposit plan.
    monthly: deposit,
  };
  return labels[preference] ?? preference;
}
