import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/auth";
import { netPricePence } from "@/lib/pricing";
import { BRAND } from "@/lib/brand";
import { COORDINATORS } from "@/lib/coordinators";
import {
  reportExportRows,
  reportToPdfHtml,
  rowsToCsv,
  rowsToExcelXml,
  type ReportExportInput,
} from "@/lib/report-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");

function staffOf(email: string) {
  return COORDINATORS.find((c) => c.email === email)?.key ?? "other";
}
function staffLabel(key: string) {
  if (key === "all") return "All staff";
  if (key === "other") return "Other";
  return COORDINATORS.find((c) => c.key === key)?.name || key;
}

export async function GET(req: NextRequest) {
  const me = await getAdmin();
  if (!me) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  const format = (req.nextUrl.searchParams.get("format") || "csv").toLowerCase();
  if (!["csv", "xlsx", "xls", "pdf"].includes(format)) {
    return NextResponse.json({ error: "format must be csv, xlsx, or pdf" }, { status: 400 });
  }

  const now = new Date();
  const mMatch = /^(\d{4})-(\d{2})$/.exec(req.nextUrl.searchParams.get("m") || "");
  const year = mMatch ? parseInt(mMatch[1], 10) : now.getFullYear();
  const month = mMatch ? Math.min(12, Math.max(1, parseInt(mMatch[2], 10))) : now.getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const monthName = start.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const inMonth = (d: Date | null) => !!d && d >= start && d < end;

  const staffKey = req.nextUrl.searchParams.get("s") || "all";
  const baseWhere = me.isSuperAdmin
    ? {}
    : { OR: [{ ownerId: me.id }, { sentByEmail: me.email }] };

  const [patients, paidPayments] = await Promise.all([
    db.patient.findMany({
      where: baseWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        pricePence: true,
        upfrontPaidPence: true,
        proposalSentAt: true,
        sentByEmail: true,
      },
    }),
    db.payment.findMany({
      where: { status: "paid", patient: baseWhere },
      select: {
        patientId: true,
        amountPence: true,
        paidAt: true,
        type: true,
        patient: { select: { firstName: true, lastName: true, email: true, sentByEmail: true } },
      },
    }),
  ]);

  const matchStaff = (email: string) => {
    if (!me.isSuperAdmin) return true;
    if (staffKey === "all") return true;
    return staffOf(email) === staffKey;
  };

  const scoped = patients.filter((p) => matchStaff(p.sentByEmail || ""));
  const proposals = scoped
    .filter((p) => inMonth(p.proposalSentAt))
    .map((p) => ({
      patientName: `${p.firstName} ${p.lastName}`.trim(),
      email: p.email,
      amountPence: netPricePence(p.pricePence, p.upfrontPaidPence),
      staff: staffLabel(staffOf(p.sentByEmail || "")),
    }));

  const firstPay = new Map<string, Date>();
  for (const p of paidPayments) {
    if (!p.paidAt || !matchStaff(p.patient.sentByEmail || "")) continue;
    const cur = firstPay.get(p.patientId);
    if (!cur || p.paidAt < cur) firstPay.set(p.patientId, p.paidAt);
  }
  const orderIds = Array.from(firstPay.entries())
    .filter(([, d]) => inMonth(d))
    .map(([id]) => id);
  const byId = new Map(patients.map((p) => [p.id, p]));
  const orders = orderIds.map((id) => {
    const p = byId.get(id)!;
    return {
      patientName: `${p.firstName} ${p.lastName}`.trim(),
      email: p.email,
      amountPence: netPricePence(p.pricePence, p.upfrontPaidPence),
      staff: staffLabel(staffOf(p.sentByEmail || "")),
    };
  });

  const monthPayments = paidPayments.filter(
    (p) => inMonth(p.paidAt) && matchStaff(p.patient.sentByEmail || "")
  );
  const incomePence = monthPayments.reduce((a, p) => a + p.amountPence, 0);
  const orderValueSum = orders.reduce((a, o) => a + o.amountPence, 0);
  const conversionPct =
    proposals.length > 0 ? Math.round((100 * orders.length) / proposals.length) : null;

  const stamp = (d: Date) =>
    d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const scopeLabel = me.isSuperAdmin
    ? staffLabel(staffKey)
    : `${me.name} (${me.email})`;

  const data: ReportExportInput = {
    practiceName: BRAND.name,
    scopeLabel,
    monthName,
    year,
    month,
    proposalsSent: proposals.length,
    invisalignOrders: orders.length,
    conversionPct,
    avgOrderPence: orders.length ? Math.round(orderValueSum / orders.length) : 0,
    invisalignIncomePence: incomePence,
    proposals,
    orders,
    payments: monthPayments
      .sort((a, b) => (a.paidAt && b.paidAt ? a.paidAt.getTime() - b.paidAt.getTime() : 0))
      .map((p) => ({
        patientName: `${p.patient.firstName} ${p.patient.lastName}`.trim(),
        email: p.patient.email,
        type: p.type,
        amountPence: p.amountPence,
        paidAt: p.paidAt ? stamp(p.paidAt) : "",
      })),
  };

  const base = `Dental-Scotland-report-${scopeLabel.replace(/\s+/g, "-")}-${year}-${pad(month)}`;

  if (format === "pdf") {
    return new NextResponse(reportToPdfHtml(data), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const rows = reportExportRows(data);
  if (format === "csv") {
    return new NextResponse(rowsToCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const xml = rowsToExcelXml(rows, monthName);
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}.xls"`,
      "Cache-Control": "no-store",
    },
  });
}
