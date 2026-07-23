"use client";
// Bottom-centre toast, driven by ?toast=...&ticon=...&tbg=... query params
// (server actions redirect with these after mutations).
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const AUTO_DISMISS_MS = 4500;

export default function Toast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [toast, setToast] = useState<{ msg: string; icon: string; bg: string } | null>(null);

  const msg = params.get("toast");
  const icon = params.get("ticon") || "✓";
  const bg = params.get("tbg") || "#0E9384";

  // Pick up toast from the URL, then strip params so refresh doesn't re-show it.
  useEffect(() => {
    if (!msg) return;
    setToast({ msg, icon, bg });
    const rest = new URLSearchParams(params.toString());
    rest.delete("toast");
    rest.delete("ticon");
    rest.delete("tbg");
    router.replace(pathname + (rest.size ? "?" + rest.toString() : ""), { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg]);

  // Auto-dismiss is separate so stripping URL params can't cancel the timer.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 26,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1200,
        animation: "ds-toast .3s cubic-bezier(.2,.8,.3,1) both",
        maxWidth: "min(560px, calc(100vw - 32px))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#0E1A2B",
          color: "#fff",
          padding: "12px 14px 12px 18px",
          borderRadius: 12,
          boxShadow: "0 16px 40px -12px rgba(11,24,40,.55)",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: toast.bg,
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            flex: "none",
          }}
        >
          {toast.icon}
        </span>
        <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.msg}</span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setToast(null)}
          style={{
            flex: "none",
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "none",
            background: "rgba(255,255,255,.1)",
            color: "#C5D0DB",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            display: "grid",
            placeItems: "center",
            padding: 0,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
