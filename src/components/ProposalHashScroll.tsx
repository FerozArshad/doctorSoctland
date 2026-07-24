"use client";

import { useEffect } from "react";

/** Scroll to #book-call when patient arrives from a follow-up email/WhatsApp link. */
export default function ProposalHashScroll() {
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#book-call") return;
    const el = document.getElementById("book-call");
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
