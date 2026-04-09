"use client";
/* ================================================================
   Toast Container — Renders notification toasts
   ================================================================ */
import { useToastStore, type ToastType } from "@/store/toastStore";

const TOAST_STYLES: Record<
  ToastType,
  { bg: string; border: string; icon: string; color: string }
> = {
  success: {
    bg: "rgba(72, 187, 120, 0.1)",
    border: "rgba(72, 187, 120, 0.4)",
    icon: "fa-circle-check",
    color: "#48BB78",
  },
  error: {
    bg: "rgba(220, 53, 69, 0.1)",
    border: "rgba(220, 53, 69, 0.4)",
    icon: "fa-circle-xmark",
    color: "#DC3545",
  },
  warning: {
    bg: "rgba(237, 137, 54, 0.1)",
    border: "rgba(237, 137, 54, 0.4)",
    icon: "fa-triangle-exclamation",
    color: "#ED8936",
  },
  info: {
    bg: "rgba(74, 144, 217, 0.1)",
    border: "rgba(74, 144, 217, 0.4)",
    icon: "fa-circle-info",
    color: "#4A90D9",
  },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 400,
        width: "100%",
      }}
    >
      {toasts.map((t) => {
        const style = TOAST_STYLES[t.type];
        return (
          <div
            key={t.id}
            className="fade-in"
            style={{
              padding: "14px 16px",
              borderRadius: 10,
              background: style.bg,
              border: `1px solid ${style.border}`,
              backdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            }}
          >
            <i
              className={`fa-solid ${style.icon}`}
              style={{ color: style.color, fontSize: 18, marginTop: 1 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: "var(--gum-text)",
                  marginBottom: t.message ? 2 : 0,
                }}
              >
                {t.title}
              </div>
              {t.message && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--gum-text-muted)",
                    lineHeight: 1.4,
                  }}
                >
                  {t.message}
                </div>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--gum-text-muted)",
                padding: 2,
                fontSize: 14,
              }}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
