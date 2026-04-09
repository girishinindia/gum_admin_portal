/* ================================================================
   RBAC — Public API
   Re-exports all RBAC utilities from a single entry point
   ================================================================ */
export { PERMISSIONS, PAGE_PERMISSIONS, SIDEBAR_MENU } from "./permissions";
export type { PermissionCode, SidebarMenuItem, SidebarSection } from "./permissions";
export { default as PermissionGate } from "./PermissionGate";
export { withPermission } from "./withPermission";
