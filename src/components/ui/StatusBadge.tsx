"use client";
/* ================================================================
   StatusBadge — Reusable badge for status indicators
   ================================================================ */

type BadgeVariant = "active" | "inactive" | "verified" | "deleted" | "pending";

const BADGE_STYLES: Record<BadgeVariant, { bg: string; color: string }> = {
  active: { bg: "rgba(72, 187, 120, 0.15)", color: "#48BB78" },
  inactive: { bg: "rgba(160, 174, 192, 0.15)", color: "#A0AEC0" },
  verified: { bg: "rgba(74, 144, 217, 0.15)", color: "#4A90D9" },
  deleted: { bg: "rgba(220, 53, 69, 0.15)", color: "#DC3545" },
  pending: { bg: "rgba(237, 137, 54, 0.15)", color: "#ED8936" },
};

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  icon?: string;
}

export default function StatusBadge({ variant, label, icon }: StatusBadgeProps) {
  const style = BADGE_STYLES[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
        whiteSpace: "nowrap",
      }}
    >
      {icon && <i className={`fa-solid ${icon}`} style={{ fontSize: 9 }} />}
      {label}
    </span>
  );
}
