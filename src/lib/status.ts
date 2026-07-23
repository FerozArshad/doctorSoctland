// Status palette & helpers — mirrors the approved design exactly.
export type StatusKey =
  | "draft"
  | "sent"
  | "interested"
  | "awaiting"
  | "deposit"
  | "paid"
  | "overdue";

export const STATUS: Record<
  StatusKey,
  { label: string; order: number; fg: string; bg: string; dot: string }
> = {
  draft: { label: "Draft", order: 0, fg: "#5B6472", bg: "#EEF1F5", dot: "#8A94A6" },
  sent: { label: "Proposal Sent", order: 1, fg: "#1D4FD8", bg: "#EAF0FE", dot: "#2E6BFF" },
  interested: { label: "Interested", order: 2, fg: "#7A3EC0", bg: "#F3EBFC", dot: "#9B51E0" },
  awaiting: { label: "Awaiting Payment", order: 3, fg: "#B7791F", bg: "#FBF3E2", dot: "#E0A429" },
  deposit: { label: "Deposit Paid", order: 4, fg: "#1B7F6B", bg: "#E3F6F0", dot: "#12A88A" },
  paid: { label: "Paid in Full", order: 5, fg: "#1C7C3A", bg: "#E6F6EA", dot: "#22B34D" },
  overdue: { label: "Overdue", order: 3, fg: "#C23B34", bg: "#FBE9E8", dot: "#E5544B" },
};

const AVATARS = [
  "#0E9384",
  "#2E6BFF",
  "#9B51E0",
  "#E0872A",
  "#D6455E",
  "#1B9E77",
  "#5B6472",
  "#3B7DD8",
];

export function statusOf(key: string) {
  return STATUS[(key as StatusKey) in STATUS ? (key as StatusKey) : "draft"];
}

export function initials(first: string, last: string): string {
  return (((first || "?")[0] || "?") + ((last || "")[0] || "")).toUpperCase().slice(0, 2);
}

/** First name from a full name, ignoring a "Dr." prefix ("Dr. Rhona Sinclair" → "Rhona"). */
export function firstNameOf(name: string): string {
  const cleaned = name.replace(/^Dr\.?\s+/i, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0] || name;
  // Initials like "M." → keep a fuller label (e.g. "M. Arfan")
  if (first.length <= 2 || /\.$/.test(first)) {
    return parts.slice(0, 2).join(" ") || cleaned;
  }
  return first;
}

export function avatarBg(id: string): string {
  let h = 0;
  for (const ch of id || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length];
}

export function timeAgo(date: Date | string): string {
  const ts = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  if (d < 7) return d + "d ago";
  return Math.floor(d / 7) + "w ago";
}
