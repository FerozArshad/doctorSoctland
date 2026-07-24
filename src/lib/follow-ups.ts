import type { Patient } from "@prisma/client";
import { TOUCHES } from "./sequence";

/** Patients who should not receive automated proposal follow-up emails/WhatsApp. */
export function receivesProposalFollowUps(
  p: Pick<Patient, "status" | "financeStatus" | "paymentPreference" | "priceLockExpired" | "sequenceTouch">
): boolean {
  if (p.priceLockExpired) return false;
  if (p.sequenceTouch >= TOUCHES.length) return false;
  // Converted or paying — no more sales follow-ups.
  if (p.status === "paid" || p.status === "deposit" || p.status === "overdue") return false;
  // Finance funnel — team handles manually.
  if (p.status === "awaiting") return false;
  if (p.financeStatus && p.financeStatus !== "none") return false;
  if (p.paymentPreference === "finance") return false;
  return ["sent", "interested"].includes(p.status);
}

/** Mark follow-up sequence complete (e.g. after payment or finance application). */
export const FOLLOW_UPS_COMPLETE_TOUCH = TOUCHES.length;
