// Treatment Coordinators who can send proposals. The chosen one becomes the
// email's From + signature, so patients get a reply from a real person.
// NOTE: each address must be a verified send-as alias on the Gmail account that
// authorised us (concierge@), or Gmail rewrites the From to concierge@.

export type Coordinator = {
  key: string;
  name: string;
  email: string;
  title: string;
  /** LeadConnector virtual Invisalign follow-up booking widget for this TCO. */
  bookingUrl?: string;
};

const MILLIE_BOOKING =
  "https://api.leadconnectorhq.com/widget/bookings/virtual-invisalign-follow-up-consult-millie";
const ROCHELLE_BOOKING =
  "https://api.leadconnectorhq.com/widget/bookings/virtual-invisalign-follow-up-consult-rochelle";

export const COORDINATORS: Coordinator[] = [
  {
    key: "millie",
    name: "Millie Buchanan",
    email: "millie@dentalscotland.com",
    title: "Treatment Coordinator",
    bookingUrl: MILLIE_BOOKING,
  },
  {
    key: "michelle",
    name: "Michelle",
    email: "michelle@dentalscotland.com",
    title: "Treatment Coordinator",
    // No dedicated widget yet — falls back to Millie.
  },
  {
    key: "rochelle",
    name: "Rochelle Copland",
    email: "rochelle@dentalscotland.com",
    title: "Treatment Coordinator",
    bookingUrl: ROCHELLE_BOOKING,
  },
];

/** Default follow-up booking link (Millie) when sender has no dedicated widget. */
export const FOLLOW_UP_BOOKING_URL = MILLIE_BOOKING;

export const FALLBACK_COORDINATOR: Coordinator = {
  key: "practice",
  name: "Dental Scotland",
  email: "concierge@dentalscotland.com",
  title: "Dental Scotland",
  bookingUrl: MILLIE_BOOKING,
};

/** Resolve the sender stored on a patient, falling back to the practice. */
export function coordinatorFor(sentByName: string, sentByEmail: string): Coordinator {
  if (!sentByName && !sentByEmail) return FALLBACK_COORDINATOR;
  const known = COORDINATORS.find((c) => c.email === sentByEmail);
  if (known) return known;
  // Match by first name when email was custom / changed.
  const byName = COORDINATORS.find(
    (c) => sentByName && c.name.toLowerCase().split(" ")[0] === sentByName.toLowerCase().split(" ")[0]
  );
  if (byName) return byName;
  return {
    key: "other",
    name: sentByName || FALLBACK_COORDINATOR.name,
    email: sentByEmail || FALLBACK_COORDINATOR.email,
    title: "Treatment Coordinator",
    bookingUrl: MILLIE_BOOKING,
  };
}

/** Virtual follow-up consult link for whoever sent the proposal. */
export function followUpBookingUrl(c: Coordinator | { key?: string; bookingUrl?: string } | null | undefined): string {
  if (c?.bookingUrl) return c.bookingUrl;
  if (c?.key === "rochelle") return ROCHELLE_BOOKING;
  if (c?.key === "millie") return MILLIE_BOOKING;
  return FOLLOW_UP_BOOKING_URL;
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
