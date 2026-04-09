/* ================================================================
   GrowUpMore Admin Portal — TypeScript Type Definitions
   Maps to API response shapes from api.growupmore.com
   ================================================================ */

// ─── API Response Types ───────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  statusCode?: number;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: {
    totalCount: number;
    pageIndex: number;
    pageSize: number;
  };
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
  errors?: { field: string; message: string }[];
}

// ─── Auth Types ───────────────────────────────────────────────

export interface LoginRequest {
  email?: string;
  mobile?: string;
  password: string;
  recaptchaToken?: string;
}

export interface LoginResponse {
  user: User;
  tokens: TokenPair;
}

export interface RegisterInitiateRequest {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  password: string;
  roleCode?: "student" | "instructor";
  recaptchaToken?: string;
}

export interface RegisterVerifyRequest {
  sessionKey: string;
  emailOtp: string;
  mobileOtp: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ─── User Types ───────────────────────────────────────────────

export interface User {
  id: number;
  countryId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  mobile: string | null;
  isActive: boolean;
  isDeleted: boolean;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
  lastLogin: string | null;
  emailVerifiedAt: string | null;
  mobileVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  country?: Country;
}

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email?: string;
  mobile?: string;
  password: string;
  countryId?: number;
  roleId?: number;
  isActive?: boolean;
  isEmailVerified?: boolean;
  isMobileVerified?: boolean;
}

export interface Country {
  name: string;
  iso2: string;
  iso3: string;
  phoneCode: string;
  nationality: string;
  nationalLanguage: string;
  languages: string[];
  currency: string;
  currencyName: string;
  currencySymbol: string;
  flagImage: string;
}

// ─── Role Types ───────────────────────────────────────────────

export interface Role {
  id: number;
  name: string;
  code: string;
  slug: string;
  description: string | null;
  parentRoleId: number | null;
  level: number;
  isSystemRole: boolean;
  displayOrder: number;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Module Types ─────────────────────────────────────────────

export interface Module {
  id: number;
  name: string;
  code: string;
  description: string | null;
  displayOrder: number;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Permission Types ─────────────────────────────────────────

export interface Permission {
  id: number;
  moduleId: number;
  name: string;
  code: string;
  description: string | null;
  resource: string;
  action: string;
  scope: "global" | "own" | "assigned";
  displayOrder: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export interface UserPermission {
  permissionCode: string;
  permissionName: string;
  moduleCode: string;
  roleCode: string;
  scope: string;
}

// ─── Role Permission Types ────────────────────────────────────

export interface RolePermission {
  id: number;
  roleId: number;
  roleName: string;
  roleCode: string;
  permissionId: number;
  permissionName: string;
  permissionCode: string;
  permissionResource: string;
  permissionAction: string;
  permissionScope: string;
  moduleName: string;
  moduleCode: string;
  isActive: boolean;
  createdAt: string;
}

// ─── User Role Assignment Types ───────────────────────────────

export interface UserRoleAssignment {
  id: number;
  userId: number;
  roleId: number;
  contextType: string | null;
  contextId: number | null;
  assignedAt: string;
  expiresAt: string | null;
  reason: string | null;
  assignedBy: number | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
}

// ─── Menu Item Types ──────────────────────────────────────────

export interface MenuItem {
  id: number;
  name: string;
  code: string;
  route: string | null;
  icon: string | null;
  parentId: number | null;
  parentMenuItemId: number | null;
  permissionId: number | null;
  displayOrder: number;
  isVisible: boolean;
  isActive: boolean;
  description: string | null;
  children?: MenuItem[];
}

// ─── Role Change Log Types ────────────────────────────────────

export interface RoleChangeLog {
  id: number;
  userId: number;
  userEmail: string;
  userFirstName: string;
  userLastName: string;
  action: string;
  roleId: number;
  roleCode: string;
  roleName: string;
  contextType: string | null;
  contextId: number | null;
  reason: string | null;
  changedBy: number;
  changedByEmail: string;
  createdAt: string;
}

// ─── Health Check Types ───────────────────────────────────────

export interface HealthCheck {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services?: {
    database: { status: string; latency: string };
    redis: { status: string; latency: string };
  };
}

// ─── Query Parameter Types ────────────────────────────────────

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "ASC" | "DESC";
}

export interface UserFilters extends PaginationParams {
  isActive?: boolean;
  isDeleted?: boolean;
  isEmailVerified?: boolean;
  isMobileVerified?: boolean;
  countryId?: number;
  countryIso2?: string;
  nationality?: string;
}

export interface RoleFilters extends PaginationParams {
  isActive?: boolean;
  level?: number;
  parentRoleId?: number;
  isSystem?: boolean;
}

export interface PermissionFilters extends PaginationParams {
  isActive?: boolean;
  moduleId?: number;
  moduleCode?: string;
  resource?: string;
  action?: string;
  scope?: string;
}
