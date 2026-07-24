import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { loadAdminNotifications } from "@/lib/admin-notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  const data = await loadAdminNotifications(admin);
  return NextResponse.json(data);
}
