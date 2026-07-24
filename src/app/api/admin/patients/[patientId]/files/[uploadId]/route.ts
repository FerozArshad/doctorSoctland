import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canAccessPatient, requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { patientId: string; uploadId: string } }
) {
  const admin = await requireAdmin();
  const patient = await db.patient.findUnique({
    where: { id: params.patientId },
    select: { id: true, ownerId: true, sentByEmail: true },
  });
  if (!patient || !canAccessPatient(admin, patient)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const upload = await db.patientUpload.findFirst({
    where: { id: params.uploadId, patientId: patient.id },
  });
  if (!upload) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bytes = Buffer.from(upload.dataBase64, "base64");
  const disposition =
    upload.mimeType.startsWith("image/") || upload.mimeType === "application/pdf" ? "inline" : "attachment";

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": upload.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${disposition}; filename="${upload.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
