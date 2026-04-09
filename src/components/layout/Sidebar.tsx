"use client";
/* ================================================================
   Sidebar — Collapsible navigation with RBAC permission filtering
   Menu items are filtered based on the user's loaded permissions
   ================================================================ */
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebarStore } from "@/store/sidebarStore";
import { useAuthStore } from "@/store/authStore";
import {
  SIDEBAR_MENU,
  type SidebarSection,
  type SidebarMenuItem,
} from "@/lib/rbac/permissions";

export default function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, isMobileOpen, expandedMenus, toggleExpandedMenu, setMobileOpen } =
    useSidebarStore();
  const { hasPermission, hasAnyPermission } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // ─── Filter menu items by permissions ──────────────────────
  const filteredMenu = useMemo((): SidebarSection[] => {
    return SIDEBAR_MENU.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.permission) return true; // No permission = always visible
        if (Array.isArray(item.permission)) {
          return item.permission.length === 0 || hasAnyPermission(item.permission);
        }
        return hasPermission(item.permission);
      }).map((item) => ({
        ...item,
        children: item.children?.filter((child) => {
          if (!child.permission) return true;
          if (Array.isArray(child.permission)) {
            return child.permission.length === 0 || hasAnyPermission(child.permission);
          }
          return hasPermission(child.permission);
        }),
      })),
    })).filter((section) => section.items.length > 0); // Remove empty sections
  }, [hasPermission, hasAnyPermission]);

  if (!mounted) return null;

  const isActive = (route: string) => {
    if (route === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(route);
  };

  const handleItemClick = (item: SidebarMenuItem) => {
    if (item.children && item.children.length > 0) {
      toggleExpandedMenu(item.code);
    }
    if (isMobileOpen) setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="gum-sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 1029,
          }}
        />
      )}

      <aside
        className={`gum-sidebar ${isCollapsed ? "collapsed" : ""} ${isMobileOpen ? "mobile-open" : ""}`}
      >
        {/* ─── Brand ──────────────────────────────────────── */}
        <div className="gum-sidebar__brand">
          <div className="gum-sidebar__brand-logo">G</div>
          {!isCollapsed && (
            <span className="gum-sidebar__brand-text">GrowUpMore</span>
          )}
        </div>

        {/* ─── Navigation ─────────────────────────────────── */}
        <nav className="gum-sidebar__nav" role="navigation" aria-label="Main navigation">
          {filteredMenu.length === 0 && !isCollapsed && (
            <div style={{ padding: "24px 20px", textAlign: "center" }}>
              <i className="fa-solid fa-lock" style={{ fontSize: 20, color: "var(--gum-text-muted)", marginBottom: 8, display: "block" }} />
              <p style={{ fontSize: 12, color: "var(--gum-text-muted)", margin: 0, lineHeight: 1.5 }}>
                No menu items available for your role.
              </p>
            </div>
          )}
          {filteredMenu.map((section) => (
            <div key={section.section}>
              {!isCollapsed && (
                <div className="gum-sidebar__section-title">
                  {section.section}
                </div>
              )}

              {section.items.map((item) => {
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = expandedMenus.includes(item.code);
                const itemActive = isActive(item.route);

                return (
                  <div key={item.code}>
                    {hasChildren ? (
                      <div
                        className={`gum-sidebar__menu-item ${itemActive ? "active" : ""} ${isExpanded ? "expanded" : ""}`}
                        onClick={() => handleItemClick(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleItemClick(item);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                      >
                        <i className={`fa-solid ${item.icon} gum-sidebar__menu-icon`} />
                        {!isCollapsed && (
                          <>
                            <span className="gum-sidebar__menu-text">
                              {item.name}
                            </span>
                            <i className="fa-solid fa-chevron-right gum-sidebar__menu-arrow" />
                          </>
                        )}
                      </div>
                    ) : (
                      <Link
                        href={item.route}
                        className={`gum-sidebar__menu-item ${itemActive ? "active" : ""}`}
                        onClick={() => {
                          if (isMobileOpen) setMobileOpen(false);
                        }}
                      >
                        <i className={`fa-solid ${item.icon} gum-sidebar__menu-icon`} />
                        {!isCollapsed && (
                          <span className="gum-sidebar__menu-text">
                            {item.name}
                          </span>
                        )}
                      </Link>
                    )}

                    {/* Submenu */}
                    {hasChildren && !isCollapsed && (
                      <div
                        className="gum-sidebar__submenu"
                        style={{
                          maxHeight: isExpanded
                            ? `${(item.children?.length || 0) * 42}px`
                            : "0",
                        }}
                      >
                        {item.children?.map((child) => (
                          <Link
                            key={child.route}
                            href={child.route}
                            className={`gum-sidebar__menu-item ${pathname === child.route ? "active" : ""}`}
                            onClick={() => {
                              if (isMobileOpen) setMobileOpen(false);
                            }}
                          >
                            <i className={`fa-solid ${child.icon} gum-sidebar__menu-icon`} />
                            <span className="gum-sidebar__menu-text">
                              {child.name}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ─── Sidebar Footer ─────────────────────────────── */}
        {!isCollapsed && (
          <div className="gum-sidebar__footer">
            <small style={{ color: "var(--gum-text-muted)", fontSize: 11 }}>
              GrowUpMore v1.0.0
            </small>
          </div>
        )}
      </aside>
    </>
  );
}
