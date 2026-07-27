import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { buildMonthlyReportData, pad, staffLabel } from "@/lib/build-monthly-report";
import { getPricing } from "@/lib/pricing-settings";
import { parseFinanceNetMap } from "@/lib/report-metrics";
import {
  reportExportRows,
  reportToPdfHtml,
  rowsToCsv,
  rowsToExcelXml,
  type ReportExportInput,
} from "@/lib/report-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const staffKey = req.nextUrl.searchParams.get("s") || "all";
  const financeNetRaw = req.nextUrl.searchParams.get("financeNet");

  const baseWhere = me.isSuperAdmin
    ? {}
    : { OR: [{ ownerId: me.id }, { sentByEmail: me.email }] };

  const cfg = await getPricing();

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
        status: true,
        paymentPreference: true,
        financeStatus: true,
        financeApprovedAt: true,
        consentSignedAt: true,
        proposalSentAt: true,
        sentByEmail: true,
        treatmentType: true,
        payments: {
          where: { status: "paid" },
          select: { type: true, status: true, paidAt: true },
        },
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

  const scopeLabel = me.isSuperAdmin ? staffLabel(staffKey) : `${me.name} (${me.email})`;

  const report = buildMonthlyReportData({
    patients,
    payments: paidPayments,
    year,
    month,
    staffKey,
    scopeLabel,
    defaultCreditPence: cfg.upfrontPence,
    financeNetRaw,
    isSuperAdmin: me.isSuperAdmin,
    adminEmail: me.email,
    adminId: me.id,
  });

  const financeNetByPatient = parseFinanceNetMap(financeNetRaw);

  if (format === "pdf" && report.financePatients.length > 0) {
    const missing = report.financePatients.filter((p) => !financeNetByPatient[p.id]);
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: "Finance net values required",
          message: `Enter net value from finance for: ${missing.map((p) => p.name).join(", ")}`,
        },
        { status: 400 }
      );
    }
  }

  const data: ReportExportInput = {
    practiceName: BRAND.name,
    scopeLabel: report.scopeLabel,
    monthName: report.monthName,
    year: report.year,
    month: report.month,
    proposalsSent: report.proposalCount,
    treatmentOrders: report.orderCount,
    conversionPct: report.conversionPct,
    avgOrderPence: report.avgOrderPence,
    totalIncomePence: report.totalIncomePence,
    proposalsByTreatment: report.proposalsByTreatment,
    ordersByTreatment: report.ordersByTreatment,
    cashCollectedPence: report.cashCollectedPence,
    bookingCreditPence: report.bookingCreditPence,
    financeIncomePence: report.financeIncomePence,
    defaultCreditPence: report.defaultCreditPence,
    proposals: report.proposals,
    orders: report.orders.map((o) => ({
      ...o,
      financeNetPence: financeNetByPatient[o.id],
    })),
    payments: report.paymentLines,
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

  const xml = rowsToExcelXml(rows, report.monthName);
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}.xls"`,
      "Cache-Control": "no-store",
    },
  });
}
