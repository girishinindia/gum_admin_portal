/* ================================================================
   Dashboard Route Loading — Shown during page transitions
   ================================================================ */
export default function DashboardLoading() {
  return (
    <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        border: "3px solid var(--gum-border)",
        borderTopColor: "var(--gum-primary)",
        animation: "spin 0.8s linear infinite",
      }} />
      <p style={{ marginTop: 16, fontSize: 13, color: "var(--gum-text-muted)" }}>Loading...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
