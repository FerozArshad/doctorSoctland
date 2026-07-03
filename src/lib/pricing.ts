// Pricing rules from the practice: 7 aligners → £1,500 · 8–20 → £2,250 · 20+ → £2,750
export const DEPOSIT_PENCE = 70_000; // £700

export function priceForPence(alignerCount: number): number {
  if (alignerCount <= 7) return 150_000;
  if (alignerCount <= 20) return 225_000;
  return 275_000;
}

export function estMonths(alignerCount: number): number {
  return Math.max(3, Math.round((alignerCount * 2) / 4.345));
}

export function defaultDiscountPct(): number {
  const n = parseInt(process.env.PAY_DISCOUNT_PCT || "5", 10);
  return Number.isFinite(n) ? n : 5;
}

// Pay-in-full price after discount
export function fullPricePence(pricePence: number, discountPct: number): number {
  return Math.round(pricePence * (1 - discountPct / 100));
}

// Each of the 3 monthly instalments after the £700 deposit
export function instalmentPence(pricePence: number): number {
  return Math.round((pricePence - DEPOSIT_PENCE) / 3);
}

// Monthly payment plan: full price spread over the treatment duration
// (minimum 6 months so instalments stay meaningful).
export function monthlyPlan(pricePence: number, alignerCount: number) {
  const months = Math.max(6, estMonths(alignerCount));
  return { months, perMonthPence: Math.ceil(pricePence / months) };
}

// Illustrative "from £x/mo" for 36-month 0% finance
export function finance36Pence(pricePence: number): number {
  return Math.round(pricePence / 36);
}

export function fmt(pence: number): string {
  return "£" + Math.round(pence / 100).toLocaleString("en-GB");
}
