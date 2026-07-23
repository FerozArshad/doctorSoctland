"use client";

/** Full-screen success panel — used after consent / finance so the ToS popup
 *  doesn't leave the user staring at a stuck dialog with a toast behind it. */
export default function SuccessModal({
  open,
  title,
  body,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(11,24,40,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 18,
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 30px 60px -20px rgba(11,24,40,.5)",
          overflow: "hidden",
          animation: "ds-toast .28s cubic-bezier(.2,.8,.3,1) both",
        }}
      >
        <div style={{ background: "#0E1A2B", padding: "22px 24px 18px", textAlign: "center" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "#0E9384",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 24,
              fontWeight: 800,
              margin: "0 auto 12px",
            }}
          >
            ✓
          </div>
          <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, letterSpacing: "-.01em" }}>{title}</div>
        </div>
        <div style={{ padding: "22px 24px 24px" }}>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: "#3C4a59", whiteSpace: "pre-wrap" }}>{body}</p>
          <button type="button" className="btn btn-teal" onClick={onClose} style={{ marginTop: 20, width: "100%", padding: 13, fontSize: 14.5 }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
