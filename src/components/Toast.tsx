"use client";
// Bottom-centre toast, driven by ?toast=...&ticon=...&tbg=... query params
// (server actions redirect with these after mutations).
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function Toast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [toast, setToast] = useState<{ msg: string; icon: string; bg: string } | null>(null);

  const msg = params.get("toast");
  const icon = params.get("ticon") || "✓";
  const bg = params.get("tbg") || "#0E9384";

  useEffect(() => {
    if (!msg) return;
    setToast({ msg, icon, bg });
    // strip the toast params from the URL without a nav
    const rest = new URLSearchParams(params.toString());
    rest.delete("toast");
    rest.delete("ticon");
    rest.delete("tbg");
    router.replace(pathname + (rest.size ? "?" + rest.toString() : ""), { scroll: false });
    const t = setTimeout(() => setToast(null), 3400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg]);

  if (!toast) return null;
  return (
    <div style={{ position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", zIndex: 100, animation: "ds-toast .3s cubic-bezier(.2,.8,.3,1) both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#0E1A2B", color: "#fff", padding: "13px 20px", borderRadius: 12, boxShadow: "0 16px 40px -12px rgba(11,24,40,.55)", fontSize: 14, fontWeight: 600 }}>
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: toast.bg, display: "grid", placeItems: "center", fontSize: 12, flex: "none" }}>{toast.icon}</span>
        {toast.msg}
      </div>
    </div>
  );
}
