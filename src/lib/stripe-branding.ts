import { BRAND } from "@/lib/brand";

/** Absolute URL for assets Stripe Checkout can fetch (must be HTTPS in production). */
export function checkoutAssetUrl(path: string): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Dental Scotland branding for Stripe Checkout.
 * Uses branding_settings when the account/API supports it; always safe to include
 * display name + colours from the live brand kit.
 */
export function stripeCheckoutBranding() {
  return {
    display_name: BRAND.name,
    background_color: BRAND.colors.offWhite,
    button_color: BRAND.colors.blue,
    font_family: "inter", // Stripe-supported family closest to DM Sans
    border_style: "rounded" as const,
  };
}

export function stripeCheckoutCustomText(kind: "full" | "deposit") {
  if (kind === "deposit") {
    return {
      submit: {
        message: "You'll pay the deposit today. Your card is saved securely for 3 monthly instalments — no extra sign-up.",
      },
      after_submit: {
        message: "Thank you — Dental Scotland will confirm your deposit by email shortly.",
      },
    };
  }
  return {
    submit: {
      message: `Paying in full includes your ${BRAND.name} treatment discount.`,
    },
    after_submit: {
      message: "Thank you — we'll email your receipt from Dental Scotland.",
    },
  };
}
