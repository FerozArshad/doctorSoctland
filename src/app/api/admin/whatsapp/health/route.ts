import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getWhatsAppConfig, getWhatsAppHealth } from "@/lib/whatsapp-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const cfg = await getWhatsAppConfig();
  if (!cfg.token || !cfg.phoneNumberId) {
    return NextResponse.json(null);
  }
  const health = await getWhatsAppHealth();
  return NextResponse.json(health);
}
