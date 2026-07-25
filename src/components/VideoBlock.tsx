"use client";

import { useMemo, useState } from "react";

type VideoMode = "embed" | "direct" | "external" | "empty";

function resolveVideo(url: string): { mode: VideoMode; src: string; openUrl: string } {
  const raw = (url || "").trim();
  if (!raw) return { mode: "empty", src: "", openUrl: "" };

  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");

    // Direct video files — play inline with HTML5 video.
    if (/\.(mp4|webm|mov)(\?.*)?$/i.test(u.pathname)) {
      return { mode: "direct", src: raw, openUrl: raw };
    }

    // YouTube
    if (host.includes("youtube.com")) {
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/").filter(Boolean)[1];
        if (id) return { mode: "embed", src: `https://www.youtube.com/embed/${id}?rel=0`, openUrl: raw };
      }
      const v = u.searchParams.get("v");
      if (v) return { mode: "embed", src: `https://www.youtube.com/embed/${v}?rel=0`, openUrl: raw };
      if (u.pathname.startsWith("/embed/")) return { mode: "embed", src: raw, openUrl: raw };
    }
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return { mode: "embed", src: `https://www.youtube.com/embed/${id}?rel=0`, openUrl: raw };
    }

    // Vimeo — /123456 and /video/123456
    if (host.includes("vimeo.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      const id = parts[0] === "video" ? parts[1] : parts[0];
      if (id && /^\d+$/.test(id)) {
        return { mode: "embed", src: `https://player.vimeo.com/video/${id}`, openUrl: raw };
      }
    }

    // Loom
    if (host.includes("loom.com")) {
      const m = u.pathname.match(/\/(?:share|embed)\/([a-zA-Z0-9]+)/);
      if (m) return { mode: "embed", src: `https://www.loom.com/embed/${m[1]}`, openUrl: raw };
    }

    // Google Drive — try preview embed
    if (host.includes("drive.google.com")) {
      const fileId = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || u.searchParams.get("id");
      if (fileId) {
        return {
          mode: "embed",
          src: `https://drive.google.com/file/d/${fileId}/preview`,
          openUrl: raw,
        };
      }
    }
  } catch {
    // fall through
  }

  if (/\.(mp4|webm|mov)(\?.*)?$/i.test(raw)) {
    return { mode: "direct", src: raw, openUrl: raw };
  }

  // ClinCheck / Invisalign share links and anything else — open in new tab.
  return { mode: "external", src: "", openUrl: raw };
}

export default function VideoBlock({ url }: { url: string }) {
  const video = useMemo(() => resolveVideo(url), [url]);
  const [playing, setPlaying] = useState(false);

  if (video.mode === "embed") {
    return (
      <div
        style={{
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
          background: "#0E1A2B",
          aspectRatio: "16/9",
          boxShadow: "0 12px 32px -16px rgba(11,24,40,.45)",
        }}
      >
        <iframe
          src={video.src}
          title="Your Personalised ClinCheck Video"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  if (video.mode === "direct") {
    return (
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          background: "#0E1A2B",
          aspectRatio: "16/9",
          boxShadow: "0 12px 32px -16px rgba(11,24,40,.45)",
        }}
      >
        <video
          src={video.src}
          controls
          playsInline
          preload="metadata"
          style={{ width: "100%", height: "100%", display: "block", objectFit: "contain", background: "#000" }}
        >
          <a href={video.openUrl} target="_blank" rel="noreferrer">
            Open video
          </a>
        </video>
      </div>
    );
  }

  const showExternal = video.mode === "external" && video.openUrl;

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        background: "linear-gradient(145deg,#0E1A2B 0%,#0B5C4F 55%,#0B7A6E 100%)",
        aspectRatio: "16/9",
        boxShadow: "0 12px 32px -16px rgba(11,24,40,.45)",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 28% 22%, rgba(255,255,255,.16), transparent 58%)" }} />
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", zIndex: 1 }}>
        {showExternal ? (
          <a
            href={video.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setPlaying(true)}
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "rgba(255,255,255,.95)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 12px 36px rgba(0,0,0,.35)",
              textDecoration: "none",
              transition: "transform .15s ease",
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "22px solid #0B7A6E",
                borderTop: "14px solid transparent",
                borderBottom: "14px solid transparent",
                marginLeft: 6,
              }}
            />
          </a>
        ) : (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "rgba(255,255,255,.2)",
              display: "grid",
              placeItems: "center",
              border: "2px dashed rgba(255,255,255,.35)",
            }}
          >
            <div style={{ fontSize: 28, opacity: 0.7 }}>▶</div>
          </div>
        )}
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 18px", background: "linear-gradient(transparent, rgba(0,0,0,.55))", color: "#fff", zIndex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Your Personalised ClinCheck Video</div>
        <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3, lineHeight: 1.45 }}>
          {showExternal
            ? playing
              ? "Opening your video…"
              : "Tap play to open your ClinCheck smile preview"
            : "Your ClinCheck video link will appear here once your coordinator adds it."}
        </div>
        {showExternal && (
          <a
            href={video.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              marginTop: 10,
              padding: "8px 14px",
              borderRadius: 9,
              background: "rgba(255,255,255,.95)",
              color: "#0B7A6E",
              fontWeight: 800,
              fontSize: 12.5,
              textDecoration: "none",
            }}
          >
            Open ClinCheck video →
          </a>
        )}
      </div>
    </div>
  );
}
