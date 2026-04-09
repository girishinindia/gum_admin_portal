"use client";
/* ================================================================
   ConfirmDialog — Reusable confirmation modal
   ================================================================ */

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "warning";
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_COLORS = {
  danger: { bg: "#DC3545", hover: "#c82333" },
  primary: { bg: "var(--gum-primary)", hover: "var(--gum-primary-dark)" },
  warning: { bg: "#ED8936", hover: "#dd6b20" },
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const colors = VARIANT_COLORS[variant];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 9998,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Dialog */}
      <div
        className="fade-in"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9999,
          background: "var(--gum-surface)",
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          width: "100%",
          maxWidth: 420,
          padding: 28,
        }}
      >
        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--gum-text)",
            marginBottom: 8,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: 14,
            color: "var(--gum-text-muted)",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          {message}
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={isLoading}
            style={{
              height: 38,
              padding: "0 20px",
              background: "var(--gum-surface)",
              color: "var(--gum-text)",
              border: "1px solid var(--gum-border)",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              height: 38,
              padding: "0 20px",
              background: colors.bg,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {isLoading && <i className="fa-solid fa-spinner fa-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
