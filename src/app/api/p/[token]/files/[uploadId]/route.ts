import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin, getPatientSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Serve an admin-uploaded patient file to the verified patient (or admin preview). */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string; uploadId: string } }
) {
  const patient = await db.patient.findUnique({
    where: { proposalToken: params.token },
    select: { id: true },
  });
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getPatientSession();
  const admin = await getAdmin();
  const allowed = admin || session?.id === patient.id;
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const upload = await db.patientUpload.findFirst({
    where: { id: params.uploadId, patientId: patient.id },
  });
  if (!upload) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bytes = Buffer.from(upload.dataBase64, "base64");
  const disposition = upload.mimeType.startsWith("image/") || upload.mimeType === "application/pdf"
    ? "inline"
    : "attachment";

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": upload.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${disposition}; filename="${upload.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
