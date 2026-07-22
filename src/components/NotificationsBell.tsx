"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import type { MessageNotifications } from "@/lib/messages";
import { channelLabel, formatMessageDate } from "@/lib/messages";
import { timeAgo } from "@/lib/status";

export default function NotificationsBell({ data }: { data: MessageNotifications }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Message notifications"
        style={{ width: 40, height: 40, borderRadius: 11, border: "1px solid #E7ECF2", background: open ? "#F4F6F9" : "#fff", display: "grid", placeItems: "center", cursor: "pointer", color: "#5C6a79", position: "relative" }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {data.alertCount > 0 && (
          <span style={{ position: "absolute", top: 8, right: 9, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 99, background: "#E5544B", border: "2px solid #fff", color: "#fff", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center" }}>
            {data.alertCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 360, maxHeight: 480, overflow: "auto", background: "#fff", border: "1px solid #E7ECF2", borderRadius: 14, boxShadow: "0 18px 40px -18px rgba(16,32,54,.35)", zIndex: 50 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Message notifications</div>
            <div style={{ fontSize: 12, color: "#7A8696", marginTop: 2 }}>Last sent and next scheduled per patient</div>
          </div>

          <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F4F8" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#8A96A5", marginBottom: 10 }}>Next to send</div>
            {data.upcoming.length === 0 ? (
              <div style={{ fontSize: 13, color: "#9AA6B4" }}>No follow-ups scheduled.</div>
            ) : (
              data.upcoming.map((u) => (
                <Link
                  key={u.patientId + u.touch}
                  href={`/admin/patients/${u.patientId}`}
                  onClick={() => setOpen(false)}
                  style={{ display: "block", padding: "9px 0", textDecoration: "none", borderTop: "1px solid #F7F9FB" }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#16202E" }}>{u.patientName}</div>
                  <div style={{ fontSize: 12.5, color: "#5C6a79", marginTop: 2 }}>
                    Follow-up {u.touch}/{u.total} · {formatMessageDate(u.dueDate)}
                    {(u.dueToday || u.overdue) && (
                      <span style={{ marginLeft: 6, color: u.overdue ? "#C23B34" : "#B7791F", fontWeight: 700 }}>
                        {u.overdue ? "Overdue" : "Due today"}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          <div style={{ padding: "12px 16px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#8A96A5", marginBottom: 10 }}>Recently sent</div>
            {data.recentSent.length === 0 ? (
              <div style={{ fontSize: 13, color: "#9AA6B4" }}>No messages sent yet.</div>
            ) : (
              data.recentSent.map((m) => (
                <Link
                  key={m.id}
                  href={`/admin/patients/${m.patientId}`}
                  onClick={() => setOpen(false)}
                  style={{ display: "block", padding: "9px 0", textDecoration: "none", borderTop: "1px solid #F7F9FB" }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#16202E" }}>{m.patientName}</div>
                  <div style={{ fontSize: 12.5, color: "#5C6a79", marginTop: 2, lineHeight: 1.4 }}>{m.summary}</div>
                  <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 3 }}>
                    {channelLabel(m.channel)} · {timeAgo(m.at)}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
