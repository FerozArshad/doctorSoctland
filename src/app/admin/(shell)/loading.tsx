export default function AdminLoading() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ height: 70, flex: "none", background: "#fff", borderBottom: "1px solid #E7ECF2" }} />
      <div style={{ flex: 1, padding: 28, overflow: "auto" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ height: 100, borderRadius: 14, background: "linear-gradient(90deg,#F4F6F9 25%,#EEF2F6 50%,#F4F6F9 75%)", backgroundSize: "200% 100%", animation: "ds-shimmer 1.2s ease-in-out infinite" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 120, borderRadius: 14, background: "#F4F6F9" }} />
            ))}
          </div>
          <div style={{ height: 280, borderRadius: 14, background: "#F4F6F9" }} />
        </div>
      </div>
      <style>{`@keyframes ds-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
