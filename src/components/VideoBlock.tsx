// ClinCheck / smile video: embeds YouTube & Vimeo inline, otherwise renders
// the branded play card linking out to the video.
function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {}
  return null;
}

export default function VideoBlock({ url }: { url: string }) {
  const embed = url ? embedUrl(url) : null;

  if (embed) {
    return (
      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#0E1A2B", aspectRatio: "16/9" }}>
        <iframe
          src={embed}
          title="Your Personalised ClinCheck Video"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  const card = (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "linear-gradient(135deg,#12324a,#0B7A6E)", aspectRatio: "16/9", display: "grid", placeItems: "center", cursor: url ? "pointer" : "default" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,.14), transparent 60%)" }} />
      <div style={{ width: 66, height: 66, borderRadius: "50%", background: "rgba(255,255,255,.92)", display: "grid", placeItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,.3)", zIndex: 1 }}>
        <div style={{ width: 0, height: 0, borderLeft: "20px solid #0B7A6E", borderTop: "12px solid transparent", borderBottom: "12px solid transparent", marginLeft: 5 }} />
      </div>
      <div style={{ position: "absolute", bottom: 16, left: 18, color: "#fff", zIndex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Your Personalised ClinCheck Video</div>
        <div style={{ fontSize: 12.5, opacity: 0.85 }}>How your teeth move · predicted result · aligners & duration</div>
      </div>
    </div>
  );

  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
      {card}
    </a>
  ) : (
    card
  );
}
