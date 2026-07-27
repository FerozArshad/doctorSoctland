import { fmt, netPricePence } from "@/lib/pricing";

export type ReportPaymentType = "Deposit" | "Paid in Full" | "Finance";

export type ReportPatientSlice = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  pricePence: number;
  upfrontPaidPence: number;
  status: string;
  paymentPreference: string | null;
  financeStatus: string;
  financeApprovedAt: Date | null;
  consentSignedAt: Date | null;
  sentByEmail: string;
  payments?: Array<{ type: string; status: string; paidAt: Date | null }>;
};

export type ReportRow = {
  id: string;
  patientName: string;
  email: string;
  grossPence: number;
  bookingCreditPence: number;
  netPence: number;
  paymentType: ReportPaymentType;
  staff: string;
};

export type ReportPaymentLine = {
  patientName: string;
  email: string;
  type: string;
  paymentType: ReportPaymentType;
  amountPence: number;
  paidAt: string;
  note?: string;
};

export function isFinancePatient(p: Pick<ReportPatientSlice, "paymentPreference" | "financeStatus">): boolean {
  if (p.paymentPreference === "finance") return true;
  return p.financeStatus === "applied" || p.financeStatus === "accepted";
}

/** Deposit | Paid in Full | Finance — for monthly reports. */
export function reportPaymentType(p: ReportPatientSlice): ReportPaymentType {
  if (isFinancePatient(p)) return "Finance";
  if (p.status === "paid" || p.paymentPreference === "full") return "Paid in Full";
  if (
    p.status === "deposit" ||
    p.paymentPreference === "deposit" ||
    p.paymentPreference === "monthly"
  ) {
    return "Deposit";
  }
  const paid = (p.payments || []).filter((x) => x.status === "paid");
  if (paid.some((x) => x.type === "full")) return "Paid in Full";
  if (paid.some((x) => x.type === "deposit" || x.type === "instalment")) return "Deposit";
  return "Deposit";
}

export function bookingCreditForPatient(p: Pick<ReportPatientSlice, "upfrontPaidPence">, defaultCreditPence: number): number {
  return p.upfrontPaidPence > 0 ? p.upfrontPaidPence : defaultCreditPence;
}

export function reportAmounts(
  p: Pick<ReportPatientSlice, "pricePence" | "upfrontPaidPence">,
  defaultCreditPence: number
) {
  const bookingCreditPence = bookingCreditForPatient(p, defaultCreditPence);
  const grossPence = p.pricePence;
  const netPence = netPricePence(p.pricePence, bookingCreditPence);
  return { grossPence, bookingCreditPence, netPence };
}

/** When the patient became an order (first card payment or finance acceptance). */
export function orderDateForPatient(
  p: Pick<ReportPatientSlice, "financeApprovedAt" | "consentSignedAt" | "paymentPreference" | "financeStatus">,
  paidPayments: Array<{ paidAt: Date | null }>
): Date | null {
  let first: Date | null = null;
  for (const pay of paidPayments) {
    if (!pay.paidAt) continue;
    if (!first || pay.paidAt < first) first = pay.paidAt;
  }
  if (first) return first;
  if (isFinancePatient(p)) {
    if (p.financeApprovedAt) return p.financeApprovedAt;
    if (p.consentSignedAt && p.paymentPreference === "finance") return p.consentSignedAt;
  }
  return null;
}

export function toReportRow(
  p: ReportPatientSlice,
  staff: string,
  defaultCreditPence: number
): ReportRow {
  const { grossPence, bookingCreditPence, netPence } = reportAmounts(p, defaultCreditPence);
  return {
    id: p.id,
    patientName: `${p.firstName} ${p.lastName}`.trim(),
    email: p.email,
    grossPence,
    bookingCreditPence,
    netPence,
    paymentType: reportPaymentType(p),
    staff,
  };
}

export function paymentTypeExportLabel(t: ReportPaymentType): string {
  return t;
}

export function parseFinanceNetMap(raw: string | null): Record<string, number> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [id, val] of Object.entries(parsed)) {
      const n = typeof val === "number" ? val : parseInt(String(val), 10);
      if (Number.isFinite(n) && n > 0) out[id] = Math.round(n);
    }
    return out;
  } catch {
    return {};
  }
}

/** Stripe + booking credit + finance net values for reporting totals. */
export function buildReportPaymentLines(
  monthPayments: Array<{
    patientId: string;
    amountPence: number;
    paidAt: Date | null;
    type: string;
    patient: { firstName: string; lastName: string; email: string };
  }>,
  orders: ReportRow[],
  financeNetByPatient: Record<string, number>,
  defaultCreditPence: number,
  stamp: (d: Date) => string
): ReportPaymentLine[] {
  const lines: ReportPaymentLine[] = [];
  const orderById = new Map(orders.map((o) => [o.id, o]));

  for (const p of monthPayments) {
    if (!p.paidAt) continue;
    const order = orderById.get(p.patientId);
    lines.push({
      patientName: `${p.patient.firstName} ${p.patient.lastName}`.trim(),
      email: p.patient.email,
      type: p.type,
      paymentType: order?.paymentType ?? "Deposit",
      amountPence: p.amountPence,
      paidAt: stamp(p.paidAt),
    });
  }

  for (const o of orders) {
    const credit = o.bookingCreditPence || defaultCreditPence;
    if (credit <= 0) continue;
    const alreadyHasCredit = lines.some(
      (l) => l.email === o.email && l.type === "booking_credit"
    );
    if (alreadyHasCredit) continue;
    lines.push({
      patientName: o.patientName,
      email: o.email,
      type: "booking_credit",
      paymentType: o.paymentType,
      amountPence: credit,
      paidAt: "Booking (credited)",
      note: `${fmt(credit)} assessment fee included in treatment total`,
    });
  }

  for (const o of orders) {
    if (o.paymentType !== "Finance") continue;
    const net = financeNetByPatient[o.id];
    if (!net || net <= 0) continue;
    lines.push({
      patientName: o.patientName,
      email: o.email,
      type: "finance",
      paymentType: "Finance",
      amountPence: net,
      paidAt: "Finance net value",
      note: "Net value from finance provider",
    });
  }

  return lines;
}

export function totalReportIncomePence(lines: ReportPaymentLine[]): number {
  return lines.reduce((a, l) => a + l.amountPence, 0);
}

export const PAYMENT_LINE_TYPE_LABELS: Record<string, string> = {
  full: "Pay in full",
  deposit: "Deposit",
  instalment: "Instalment",
  manual: "Manual (admin)",
  booking_credit: "Booking credit",
  finance: "Finance (net)",
};
