import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/auth";
import { netPricePence } from "@/lib/pricing";
import { BRAND } from "@/lib/brand";
import { reportExportRows, rowsToCsv, rowsToExcelXml, type ReportExportInput } from "@/lib/report-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");

export async function GET(req: NextRequest) {
  const me = await getAdmin();
  if (!me) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  const format = (req.nextUrl.searchParams.get("format") || "csv").toLowerCase();
  if (format !== "csv" && format !== "xlsx" && format !== "xls") {
    return NextResponse.json({ error: "format must be csv or xlsx" }, { status: 400 });
  }

  let target = me;
  const a = req.nextUrl.searchParams.get("a");
  if (a && a !== me.id) {
    if (!me.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    target = (await db.admin.findUnique({ where: { id: a } })) ?? me;
  }

  const now = new Date();
  const mMatch = /^(\d{4})-(\d{2})$/.exec(req.nextUrl.searchParams.get("m") || "");
  const year = mMatch ? parseInt(mMatch[1], 10) : now.getFullYear();
  const month = mMatch ? Math.min(12, Math.max(1, parseInt(mMatch[2], 10))) : now.getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const monthName = start.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const inMonth = (d: Date | null) => !!d && d >= start && d < end;

  const attribution = { OR: [{ ownerId: target.id }, { sentByEmail: target.email }] };
  const [attributedPatients, paidPayments, report] = await Promise.all([
    db.patient.findMany({
      where: attribution,
      select: { id: true, firstName: true, lastName: true, email: true, pricePence: true, upfrontPaidPence: true },
    }),
    db.payment.findMany({
      where: { status: "paid", patient: attribution },
      select: {
        patientId: true,
        amountPence: true,
        paidAt: true,
        type: true,
        patient: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    db.monthlyReport.findUnique({
      where: { adminId_year_month: { adminId: target.id, year, month } },
    }),
  ]);

  const incomePence = paidPayments.filter((p) => inMonth(p.paidAt)).reduce((a, p) => a + p.amountPence, 0);
  const firstPay = new Map<string, Date>();
  for (const p of paidPayments) {
    if (!p.paidAt) continue;
    const cur = firstPay.get(p.patientId);
    if (!cur || p.paidAt < cur) firstPay.set(p.patientId, p.paidAt);
  }
  const orderIds = Array.from(firstPay.entries())
    .filter(([, d]) => inMonth(d))
    .map(([id]) => id);
  const orderValueSum = attributedPatients
    .filter((p) => orderIds.includes(p.id))
    .reduce((a, p) => a + netPricePence(p.pricePence, p.upfrontPaidPence), 0);
  const avgAligner = orderIds.length ? Math.round(orderValueSum / orderIds.length) : 0;

  const stamp = (d: Date) =>
    d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const data: ReportExportInput = {
    practiceName: BRAND.name,
    adminName: target.name,
    adminEmail: target.email,
    monthName,
    year,
    month,
    invisalignOrders: orderIds.length,
    invisalignIncomePence: incomePence,
    avgOrderPence: avgAligner,
    consultsSeen: report?.consultsSeen ?? 0,
    consultsProceeded: report?.consultsProceeded ?? 0,
    bondingConsults: report?.bondingConsults ?? 0,
    bondingProceeded: report?.bondingProceeded ?? 0,
    bondingIncomePence: report?.bondingIncomePence ?? 0,
    veneerConsults: report?.veneerConsults ?? 0,
    veneerProceeded: report?.veneerProceeded ?? 0,
    veneerIncomePence: report?.veneerIncomePence ?? 0,
    notes: report?.notes ?? "",
    filedAt: report ? stamp(report.updatedAt) : null,
    payments: paidPayments
      .filter((p) => inMonth(p.paidAt))
      .sort((a, b) => (a.paidAt && b.paidAt ? a.paidAt.getTime() - b.paidAt.getTime() : 0))
      .map((p) => ({
        patientName: `${p.patient.firstName} ${p.patient.lastName}`.trim(),
        email: p.patient.email,
        type: p.type,
        amountPence: p.amountPence,
        paidAt: p.paidAt ? stamp(p.paidAt) : "",
      })),
  };

  const rows = reportExportRows(data);
  const base = `Dental-Scotland-report-${target.name.replace(/\s+/g, "-")}-${year}-${pad(month)}`;

  if (format === "csv") {
    return new NextResponse(rowsToCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // SpreadsheetML — Excel opens as a formatted workbook (extension .xls).
  const xml = rowsToExcelXml(rows, monthName);
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}.xls"`,
      "Cache-Control": "no-store",
    },
  });
}
