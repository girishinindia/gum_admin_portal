/* ================================================================
   Permission Constants — Maps to API permission codes
   Source: GrowUpMore API RBAC system
   Format: module.action (e.g., user.create, role.read)
   ================================================================ */

export const PERMISSIONS = {
  // ─── User Management ───────────────────────────────────────
  USER_CREATE: "user.create",
  USER_READ: "user.read",
  USER_UPDATE: "user.update",
  USER_DELETE: "user.delete",
  USER_RESTORE: "user.restore",

  // ─── Role Management ───────────────────────────────────────
  ROLE_CREATE: "role.create",
  ROLE_READ: "role.read",
  ROLE_UPDATE: "role.update",
  ROLE_DELETE: "role.delete",
  ROLE_RESTORE: "role.restore",
  ROLE_ASSIGN: "role.assign",

  // ─── Module Management ─────────────────────────────────────
  MODULE_CREATE: "module.create",
  MODULE_READ: "module.read",
  MODULE_UPDATE: "module.update",
  MODULE_DELETE: "module.delete",
  MODULE_RESTORE: "module.restore",

  // ─── Permission Management ─────────────────────────────────
  PERMISSION_MANAGE: "permission.manage",

  // ─── Menu Items ────────────────────────────────────────────
  MENU_CREATE: "menu.create",
  MENU_READ: "menu.read",
  MENU_UPDATE: "menu.update",
  MENU_DELETE: "menu.delete",
  MENU_RESTORE: "menu.restore",

  // ─── Audit Log ────────────────────────────────────────────
  AUDIT_LOG_READ: "admin_log.read",
  AUDIT_LOG_CREATE: "admin_log.create",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ─── Page-level permission requirements ──────────────────────
// Maps each dashboard route to the permission(s) needed to view it
export const PAGE_PERMISSIONS: Record<string, PermissionCode | PermissionCode[]> = {
  "/dashboard": [], // All authenticated users can view dashboard
  "/users": PERMISSIONS.USER_READ,
  "/users/create": PERMISSIONS.USER_CREATE,
  "/roles": PERMISSIONS.ROLE_READ,
  "/permissions": PERMISSIONS.PERMISSION_MANAGE,
  "/role-permissions": PERMISSIONS.PERMISSION_MANAGE,
  "/user-role-assignments": PERMISSIONS.ROLE_ASSIGN,
  "/menu-items": PERMISSIONS.MENU_READ,
  "/audit-log": PERMISSIONS.AUDIT_LOG_READ,
  "/uploads": PERMISSIONS.PERMISSION_MANAGE,
  "/settings": PERMISSIONS.PERMISSION_MANAGE,
} as const;

// ─── Sidebar menu configuration with permission guards ───────
export interface SidebarMenuItem {
  name: string;
  code: string;
  route: string;
  icon: string;
  permission?: PermissionCode | PermissionCode[];
  children?: Omit<SidebarMenuItem, "children" | "code">[];
}

export interface SidebarSection {
  section: string;
  items: SidebarMenuItem[];
}

export const SIDEBAR_MENU: SidebarSection[] = [
  {
    section: "MAIN",
    items: [
      {
        name: "Dashboard",
        code: "dashboard",
        route: "/dashboard",
        icon: "fa-gauge-high",
        // No permission — all authenticated users
      },
    ],
  },
  {
    section: "USER MANAGEMENT",
    items: [
      {
        name: "Users",
        code: "users",
        route: "/users",
        icon: "fa-users",
        permission: PERMISSIONS.USER_READ,
        children: [
          { name: "All Users", route: "/users", icon: "fa-list", permission: PERMISSIONS.USER_READ },
          { name: "Create User", route: "/users/create", icon: "fa-user-plus", permission: PERMISSIONS.USER_CREATE },
        ],
      },
    ],
  },
  {
    section: "ACCESS CONTROL",
    items: [
      {
        name: "Roles",
        code: "roles",
        route: "/roles",
        icon: "fa-shield-halved",
        permission: PERMISSIONS.ROLE_READ,
      },
      {
        name: "Permissions",
        code: "permissions",
        route: "/permissions",
        icon: "fa-key",
        permission: PERMISSIONS.PERMISSION_MANAGE,
      },
      {
        name: "Role Permissions",
        code: "role-permissions",
        route: "/role-permissions",
        icon: "fa-user-lock",
        permission: PERMISSIONS.PERMISSION_MANAGE,
      },
      {
        name: "User Assignments",
        code: "user-role-assignments",
        route: "/user-role-assignments",
        icon: "fa-user-tag",
        permission: PERMISSIONS.ROLE_ASSIGN,
      },
    ],
  },
  {
    section: "SYSTEM",
    items: [
      {
        name: "Uploads",
        code: "uploads",
        route: "/uploads",
        icon: "fa-cloud-arrow-up",
        permission: PERMISSIONS.PERMISSION_MANAGE,
      },
      {
        name: "Menu Items",
        code: "menu-items",
        route: "/menu-items",
        icon: "fa-bars",
        permission: PERMISSIONS.MENU_READ,
      },
      {
        name: "Audit Log",
        code: "audit-log",
        route: "/audit-log",
        icon: "fa-clock-rotate-left",
        permission: PERMISSIONS.AUDIT_LOG_READ,
      },
      {
        name: "Settings",
        code: "settings",
        route: "/settings",
        icon: "fa-gear",
        permission: PERMISSIONS.PERMISSION_MANAGE,
      },
    ],
  },
];
