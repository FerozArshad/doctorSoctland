"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useTransition } from "react";
import type { MessageNotifications } from "@/lib/messages";
import { channelLabel } from "@/lib/messages";
import { timeAgo } from "@/lib/status";
import { dismissNotification, markNotificationRead } from "@/app/admin/notification-actions";

export default function NotificationsBell({ data }: { data: MessageNotifications }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(data.items);
  const [alertCount, setAlertCount] = useState(data.alertCount);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(data.items);
    setAlertCount(data.alertCount);
  }, [data]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const markRead = (key: string) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, unread: false } : i)));
    setAlertCount((c) => Math.max(0, c - 1));
    startTransition(() => {
      void markNotificationRead(key);
    });
  };

  const remove = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
    setAlertCount((c) => Math.max(0, c - 1));
    startTransition(() => {
      void dismissNotification(key);
    });
  };

  const upcoming = items.filter((i) => i.kind === "upcoming");
  const recent = items.filter((i) => i.kind === "sent");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        style={{ width: 40, height: 40, borderRadius: 11, border: "1px solid #E7ECF2", background: open ? "#F4F6F9" : "#fff", display: "grid", placeItems: "center", cursor: "pointer", color: "#5C6a79", position: "relative" }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {alertCount > 0 && (
          <span style={{ position: "absolute", top: 8, right: 9, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 99, background: "#E5544B", border: "2px solid #fff", color: "#fff", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center" }}>
            {alertCount > 99 ? "99+" : alertCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 380, maxHeight: 520, overflow: "auto", background: "#fff", border: "1px solid #E7ECF2", borderRadius: 14, boxShadow: "0 18px 40px -18px rgba(16,32,54,.35)", zIndex: 50 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F4F8", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Notifications</div>
              <div style={{ fontSize: 12, color: "#7A8696", marginTop: 2 }}>Live from patients — follow-ups &amp; sends</div>
            </div>
            {pending && <span style={{ fontSize: 11, color: "#9AA6B4" }}>Saving…</span>}
          </div>

          <Section title="Next to send" empty="No follow-ups scheduled." hasItems={upcoming.length > 0}>
            {upcoming.map((u) => (
              <Row
                key={u.key}
                href={`/admin/patients/${u.patientId}`}
                title={u.title}
                detail={u.detail}
                meta={u.channel ? channelLabel(u.channel) : undefined}
                unread={!!u.unread}
                failed={false}
                accent={u.overdue ? "#C23B34" : u.dueToday ? "#B7791F" : undefined}
                onOpen={() => setOpen(false)}
                onRead={() => markRead(u.key)}
                onRemove={() => remove(u.key)}
              />
            ))}
          </Section>

          <Section title="Recently sent" empty="No messages sent yet." hasItems={recent.length > 0} last>
            {recent.map((m) => (
              <Row
                key={m.key}
                href={`/admin/patients/${m.patientId}`}
                title={m.title}
                detail={m.detail}
                meta={`${m.channel ? channelLabel(m.channel) : "Message"}${m.at ? ` · ${timeAgo(m.at)}` : ""}`}
                unread={!!m.unread}
                failed={!!m.failed}
                onOpen={() => setOpen(false)}
                onRead={() => markRead(m.key)}
                onRemove={() => remove(m.key)}
              />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  empty,
  children,
  last,
  hasItems,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
  last?: boolean;
  hasItems: boolean;
}) {
  return (
    <div style={{ padding: "12px 16px", borderBottom: last ? undefined : "1px solid #F1F4F8" }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#8A96A5", marginBottom: 10 }}>{title}</div>
      {!hasItems ? <div style={{ fontSize: 13, color: "#9AA6B4" }}>{empty}</div> : children}
    </div>
  );
}

function Row({
  href,
  title,
  detail,
  meta,
  unread,
  failed,
  accent,
  onOpen,
  onRead,
  onRemove,
}: {
  href: string;
  title: string;
  detail: string;
  meta?: string;
  unread: boolean;
  failed: boolean;
  accent?: string;
  onOpen: () => void;
  onRead: () => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "9px 0", borderTop: "1px solid #F7F9FB", opacity: unread ? 1 : 0.72 }}>
      <Link href={href} onClick={onOpen} style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#16202E", display: "flex", alignItems: "center", gap: 6 }}>
          {unread && <span style={{ width: 7, height: 7, borderRadius: "50%", background: failed ? "#E5544B" : accent || "#0E9384", flex: "none" }} />}
          {title}
        </div>
        <div style={{ fontSize: 12.5, color: failed ? "#C23B34" : "#5C6a79", marginTop: 2, lineHeight: 1.4 }}>{detail}</div>
        {meta && <div style={{ fontSize: 11.5, color: "#9AA6B4", marginTop: 3 }}>{meta}</div>}
      </Link>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "none" }}>
        {unread && (
          <button type="button" title="Mark as read" onClick={onRead} style={chipBtn}>
            Read
          </button>
        )}
        <button type="button" title="Remove notification" onClick={onRemove} style={chipBtn}>
          Remove
        </button>
      </div>
    </div>
  );
}

const chipBtn: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  padding: "4px 7px",
  borderRadius: 7,
  border: "1px solid #E7ECF2",
  background: "#fff",
  color: "#5C6a79",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
