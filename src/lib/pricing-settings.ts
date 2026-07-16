// Server-only: loads the practice's editable pricing from the DB.
// Kept out of pricing.ts so that file stays pure and client-safe.
import { db } from "./db";
import { PRICING_DEFAULTS, type PricingConfig } from "./pricing";

/** Reads the singleton Pricing row, falling back to defaults if it's missing. */
export async function getPricing(): Promise<PricingConfig> {
  try {
    const row = await db.pricing.findUnique({ where: { id: "default" } });
    if (!row) return PRICING_DEFAULTS;
    return {
      tier1MaxAligners: row.tier1MaxAligners,
      tier1Pence: row.tier1Pence,
      tier2MaxAligners: row.tier2MaxAligners,
      tier2Pence: row.tier2Pence,
      tier3Pence: row.tier3Pence,
      depositPence: row.depositPence,
      upfrontPence: row.upfrontPence,
      discountPct: row.discountPct,
    };
  } catch {
    // Never let a settings read break a proposal or a charge.
    return PRICING_DEFAULTS;
  }
}
