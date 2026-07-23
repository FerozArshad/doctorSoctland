// Treatment Coordinators who can send proposals. The chosen one becomes the
// email's From + signature, so patients get a reply from a real person.
// NOTE: each address must be a verified send-as alias on the Gmail account that
// authorised us (concierge@), or Gmail rewrites the From to concierge@.

export type Coordinator = { key: string; name: string; email: string; title: string };

export const COORDINATORS: Coordinator[] = [
  { key: "millie", name: "Millie Buchanan", email: "millie@dentalscotland.com", title: "Treatment Coordinator" },
  { key: "michelle", name: "Michelle", email: "michelle@dentalscotland.com", title: "Treatment Coordinator" },
  { key: "rochelle", name: "Rochelle Copland", email: "rochelle@dentalscotland.com", title: "Treatment Coordinator" },
];

/** LeadConnector booking widget — virtual Invisalign follow-up with Millie. */
export const FOLLOW_UP_BOOKING_URL =
  "https://api.leadconnectorhq.com/widget/bookings/virtual-invisalign-follow-up-consult-millie";

export const FALLBACK_COORDINATOR: Coordinator = {
  key: "practice",
  name: "Dental Scotland",
  email: "concierge@dentalscotland.com",
  title: "Dental Scotland",
};

/** Resolve the sender stored on a patient, falling back to the practice. */
export function coordinatorFor(sentByName: string, sentByEmail: string): Coordinator {
  if (!sentByName && !sentByEmail) return FALLBACK_COORDINATOR;
  const known = COORDINATORS.find((c) => c.email === sentByEmail);
  if (known) return known;
  return {
    key: "other",
    name: sentByName || FALLBACK_COORDINATOR.name,
    email: sentByEmail || FALLBACK_COORDINATOR.email,
    title: "Treatment Coordinator",
  };
}

/** "Millie Buchanan <millie@dentalscotland.com>" for the email From header. */
export function fromHeader(c: Coordinator): string {
  return `${c.name} <${c.email}>`;
}

/** Sign-off used at the bottom of every sequence email. */
export function signOff(c: Coordinator): string {
  if (c.key === "practice") return `Warmly,<br/>The team at Dental Scotland`;
  return `Warmly,<br/><strong>${c.name}</strong><br/>${c.title}, Dental Scotland<br/><a href="mailto:${c.email}" style="color:#0E9384;">${c.email}</a>`;
}
