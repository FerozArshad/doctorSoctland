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

/// Fallbacks if the Pricing row is missing: 7 → £1,500 · 8–20 → £2,250 · 20+ → £2,750
export const PRICING_DEFAULTS: PricingConfig = {
  tier1MaxAligners: 7,
  tier1Pence: 150_000,
  tier2MaxAligners: 20,
  tier2Pence: 225_000,
  tier3Pence: 275_000,
  depositPence: 70_000, // £700
  upfrontPence: 25_000, // £250 consultation/booking paid before the proposal
  discountPct: 5,
};

// Total the patient still owes: treatment price minus any upfront already paid.
// All payment options (full / deposit / instalments / finance) are computed on this.
export function netPricePence(pricePence: number, upfrontPaidPence: number): number {
  return Math.max(0, pricePence - (upfrontPaidPence || 0));
}

export function priceForPence(alignerCount: number, cfg: PricingConfig = PRICING_DEFAULTS): number {
  if (alignerCount <= cfg.tier1MaxAligners) return cfg.tier1Pence;
  if (alignerCount <= cfg.tier2MaxAligners) return cfg.tier2Pence;
  return cfg.tier3Pence;
}

export function estMonths(alignerCount: number): number {
  return Math.max(3, Math.round((alignerCount * 2) / 4.345));
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
