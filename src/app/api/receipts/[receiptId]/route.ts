import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin, getPatientSession } from "@/lib/auth";
import { canAccessPatient } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** View or download a stored payment receipt (admin or verified patient). */
export async function GET(req: NextRequest, { params }: { params: { receiptId: string } }) {
  const receipt = await db.paymentReceipt.findUnique({
    where: { id: params.receiptId },
    include: { patient: { select: { id: true, ownerId: true, sentByEmail: true } } },
  });
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = await getAdmin();
  const session = await getPatientSession();
  const patientOk = session?.id === receipt.patientId;
  const adminOk = admin && canAccessPatient(admin, receipt.patient);
  if (!patientOk && !adminOk) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  const filename = `${receipt.receiptNumber}.html`;

  return new NextResponse(receipt.htmlBody, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
