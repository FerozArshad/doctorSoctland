"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { log } from "@/lib/log";

const MAX_KEYS = 200;

function appendKey(existing: string[], key: string): string[] {
  return [key, ...existing.filter((k) => k !== key)].slice(0, MAX_KEYS);
}

export async function markNotificationRead(key: string) {
  if (!key || key.length > 120) return;
  const admin = await requireAdmin();
  await db.admin.update({
    where: { id: admin.id },
    data: { notifReadKeys: appendKey(admin.notifReadKeys || [], key) },
  });
  log.info("notif.read", { adminId: admin.id, key });
  revalidatePath("/admin", "layout");
}

export async function dismissNotification(key: string) {
  if (!key || key.length > 120) return;
  const admin = await requireAdmin();
  await db.admin.update({
    where: { id: admin.id },
    data: { notifDismissedKeys: appendKey(admin.notifDismissedKeys || [], key) },
  });
  log.info("notif.dismiss", { adminId: admin.id, key });
  revalidatePath("/admin", "layout");
}
