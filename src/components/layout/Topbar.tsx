"use client";
/* ================================================================
   Topbar — App bar with breadcrumbs, theme toggle, profile dropdown
   ================================================================ */
import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSidebarStore } from "@/store/sidebarStore";
import { useAuthStore } from "@/store/authStore";

// ─── Breadcrumb mapping ──────────────────────────────────────
const BREADCRUMB_MAP: Record<string, string> = {
  dashboard: "Dashboard",
  users: "Users",
  create: "Create",
  edit: "Edit",
  roles: "Roles",
  permissions: "Permissions",
  "role-permissions": "Role Permissions",
  "user-role-assignments": "User Assignments",
  "menu-items": "Menu Items",
  "audit-log": "Audit Log",
  uploads: "Uploads",
  settings: "Settings",
  profile: "Profile",
};

export default function Topbar() {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const { toggleCollapse, toggleMobile } = useSidebarStore();
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // ─── Click-outside & Escape key to close dropdown ──────────
  const closeDropdown = useCallback(() => setShowProfileMenu(false), []);

  useEffect(() => {
    if (!showProfileMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDropdown();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showProfileMenu, closeDropdown]);

  // ─── Generate breadcrumbs from pathname ─────────────────────
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: BREADCRUMB_MAP[seg] || seg.charAt(0).toUpperCase() + seg.slice(1),
    path: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const userInitials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
    : "SA";

  const userName = user
    ? `${user.firstName} ${user.lastName}`
    : "Super Admin";

  if (!mounted) return <div className="gum-topbar" />;

  return (
    <header className="gum-topbar">
      {/* ─── Toggle Sidebar ─────────────────────────────── */}
      <button
        className="gum-topbar__toggle d-none d-md-flex"
        onClick={toggleCollapse}
        title="Toggle sidebar"
        aria-label="Toggle sidebar"
      >
        <i className="fa-solid fa-bars" />
      </button>

      <button
        className="gum-topbar__toggle d-md-none"
        onClick={toggleMobile}
        title="Open menu"
        aria-label="Open menu"
      >
        <i className="fa-solid fa-bars" />
      </button>

      {/* ─── Breadcrumbs ────────────────────────────────── */}
      <nav className="gum-topbar__breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard" aria-label="Home">
          <i className="fa-solid fa-house" style={{ fontSize: 13 }} />
        </Link>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.path}>
            <span className="separator" aria-hidden="true">/</span>
            {crumb.isLast ? (
              <span className="current" aria-current="page">{crumb.label}</span>
            ) : (
              <Link href={crumb.path}>{crumb.label}</Link>
            )}
          </span>
        ))}
      </nav>

      {/* ─── Actions ────────────────────────────────────── */}
      <div className="gum-topbar__actions">
        {/* Theme Toggle */}
        <button
          className="gum-topbar__action-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          <i className={`fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}`} />
        </button>

        {/* Notifications */}
        <button className="gum-topbar__action-btn" title="Notifications" aria-label="Notifications">
          <i className="fa-solid fa-bell" />
          <span className="gum-topbar__badge" />
        </button>

        {/* Profile */}
        <div ref={profileRef} style={{ position: "relative" }}>
          <button
            className="gum-topbar__profile"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-expanded={showProfileMenu}
            aria-haspopup="true"
          >
            <div className="gum-topbar__avatar">{userInitials}</div>
            <div className="gum-topbar__user-info">
              <div className="gum-topbar__user-name">{userName}</div>
              <div className="gum-topbar__user-role">{user?.email || "Admin"}</div>
            </div>
            <i
              className="fa-solid fa-chevron-down"
              style={{
                fontSize: 10, color: "var(--gum-text-muted)",
                transition: "transform 0.2s",
                transform: showProfileMenu ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          {/* Profile Dropdown */}
          {showProfileMenu && (
            <div
              className="gum-card"
              role="menu"
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                marginTop: 8,
                width: 220,
                padding: "8px 0",
                zIndex: 1050,
                boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                border: "1px solid var(--gum-border)",
              }}
            >
              {/* User info header */}
              <div style={{ padding: "10px 16px 12px", borderBottom: "1px solid var(--gum-border)" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--gum-text)" }}>{userName}</p>
                <p style={{ fontSize: 11, color: "var(--gum-text-muted)" }}>{user?.email || ""}</p>
              </div>

              <Link
                href="/users/profile"
                role="menuitem"
                onClick={closeDropdown}
                style={dropdownItemStyle}
              >
                <i className="fa-solid fa-user" style={dropdownIconStyle} />
                <span>My Profile</span>
              </Link>
              <Link
                href="/settings"
                role="menuitem"
                onClick={closeDropdown}
                style={dropdownItemStyle}
              >
                <i className="fa-solid fa-gear" style={dropdownIconStyle} />
                <span>Settings</span>
              </Link>
              <div style={{ height: 1, background: "var(--gum-border)", margin: "4px 0" }} />
              <button
                role="menuitem"
                style={{ ...dropdownItemStyle, width: "100%", background: "none", border: "none", color: "var(--gum-danger, #DC3545)" }}
                onClick={async () => {
                  closeDropdown();
                  await useAuthStore.getState().logout();
                  window.location.href = "/login";
                }}
              >
                <i className="fa-solid fa-right-from-bracket" style={{ ...dropdownIconStyle, color: "var(--gum-danger, #DC3545)" }} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const dropdownItemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
  fontSize: 13, color: "var(--gum-text)", textDecoration: "none", cursor: "pointer",
  transition: "background 0.15s",
};

const dropdownIconStyle: React.CSSProperties = {
  width: 16, textAlign: "center", fontSize: 13, color: "var(--gum-text-muted)",
};
