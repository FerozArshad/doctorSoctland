import { COORDINATORS } from "@/lib/coordinators";
import {
  buildReportPaymentLines,
  orderDateForPatient,
  parseFinanceNetMap,
  toReportRow,
  totalReportIncomePence,
  type ReportPatientSlice,
  type ReportRow,
} from "@/lib/report-metrics";

export type MonthlyReportData = {
  monthName: string;
  year: number;
  month: number;
  scopeLabel: string;
  defaultCreditPence: number;
  proposals: ReportRow[];
  orders: ReportRow[];
  financePatients: Array<{ id: string; name: string; email: string }>;
  paymentLines: ReturnType<typeof buildReportPaymentLines>;
  proposalCount: number;
  orderCount: number;
  conversionPct: number | null;
  avgOrderPence: number;
  cashCollectedPence: number;
  bookingCreditPence: number;
  financeIncomePence: number;
  totalIncomePence: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

function staffOf(email: string) {
  return COORDINATORS.find((c) => c.email === email)?.key ?? "other";
}

export function staffLabel(key: string) {
  if (key === "all") return "All staff";
  if (key === "other") return "Other";
  return COORDINATORS.find((c) => c.key === key)?.name || key;
}

type PatientDb = ReportPatientSlice & {
  proposalSentAt: Date | null;
};

type PaymentDb = {
  patientId: string;
  amountPence: number;
  paidAt: Date | null;
  type: string;
  patient: { firstName: string; lastName: string; email: string; sentByEmail: string };
};

export function buildMonthlyReportData(opts: {
  patients: PatientDb[];
  payments: PaymentDb[];
  year: number;
  month: number;
  staffKey: string;
  scopeLabel: string;
  defaultCreditPence: number;
  financeNetRaw?: string | null;
  isSuperAdmin: boolean;
  adminEmail: string;
  adminId: string;
}): MonthlyReportData {
  const { patients, payments, year, month, staffKey, scopeLabel, defaultCreditPence, financeNetRaw } = opts;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const monthName = start.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const inMonth = (d: Date | null | undefined) => !!d && d >= start && d < end;

  const matchStaff = (email: string) => {
    if (staffKey === "all") return true;
    return staffOf(email) === staffKey;
  };

  const financeNetByPatient = parseFinanceNetMap(financeNetRaw ?? null);
  const scoped = patients.filter((p) => matchStaff(p.sentByEmail || ""));

  const proposals = scoped
    .filter((p) => inMonth(p.proposalSentAt))
    .sort((a, b) => (a.proposalSentAt!.getTime() - b.proposalSentAt!.getTime()))
    .map((p) => toReportRow(p, staffLabel(staffOf(p.sentByEmail || "")), defaultCreditPence));

  const paidByPatient = new Map<string, PaymentDb[]>();
  for (const p of payments) {
    if (!matchStaff(p.patient.sentByEmail || "")) continue;
    const list = paidByPatient.get(p.patientId) || [];
    list.push(p);
    paidByPatient.set(p.patientId, list);
  }

  const patientById = new Map(patients.map((p) => [p.id, p]));
  const orderIds = new Set<string>();

  for (const p of scoped) {
    const pays = paidByPatient.get(p.id) || [];
    const orderDate = orderDateForPatient(p, pays);
    if (orderDate && inMonth(orderDate)) orderIds.add(p.id);
  }

  const orders = Array.from(orderIds)
    .map((id) => {
      const p = patientById.get(id)!;
      return toReportRow(p, staffLabel(staffOf(p.sentByEmail || "")), defaultCreditPence);
    })
    .sort((a, b) => a.patientName.localeCompare(b.patientName));

  const monthPayments = payments.filter(
    (p) => inMonth(p.paidAt) && matchStaff(p.patient.sentByEmail || "")
  );

  const stamp = (d: Date) =>
    d.toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const paymentLines = buildReportPaymentLines(
    monthPayments,
    orders,
    financeNetByPatient,
    defaultCreditPence,
    stamp
  );

  const cashCollectedPence = monthPayments.reduce((a, p) => a + p.amountPence, 0);
  const bookingCreditPence = paymentLines
    .filter((l) => l.type === "booking_credit")
    .reduce((a, l) => a + l.amountPence, 0);
  const financeIncomePence = paymentLines
    .filter((l) => l.type === "finance")
    .reduce((a, l) => a + l.amountPence, 0);
  const totalIncomePence = totalReportIncomePence(paymentLines);

  const orderValueSum = orders.reduce((a, o) => {
    if (o.paymentType === "Finance" && financeNetByPatient[o.id]) {
      return a + financeNetByPatient[o.id] + o.bookingCreditPence;
    }
    return a + o.grossPence;
  }, 0);

  const proposalCount = proposals.length;
  const orderCount = orders.length;
  const conversionPct = proposalCount > 0 ? Math.round((100 * orderCount) / proposalCount) : null;
  const avgOrderPence = orderCount > 0 ? Math.round(orderValueSum / orderCount) : 0;

  const financePatients = orders
    .filter((o) => o.paymentType === "Finance")
    .map((o) => ({ id: o.id, name: o.patientName, email: o.email }));

  return {
    monthName,
    year,
    month,
    scopeLabel,
    defaultCreditPence,
    proposals,
    orders,
    financePatients,
    paymentLines,
    proposalCount,
    orderCount,
    conversionPct,
    avgOrderPence,
    cashCollectedPence,
    bookingCreditPence,
    financeIncomePence,
    totalIncomePence,
  };
}

export { pad };
