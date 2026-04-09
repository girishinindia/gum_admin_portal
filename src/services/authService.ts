/* ================================================================
   Auth Service — API calls for authentication
   Login, Logout, Refresh, Permissions
   ================================================================ */
import api from "@/lib/axios";
import type {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  TokenPair,
  User,
  UserPermission,
} from "@/types";

// ─── Token Storage (in-memory + localStorage for refresh) ─────
// Access token: kept in Zustand (memory only)
// Refresh token: stored in localStorage (httpOnly cookie would
//   require same-domain API — we use localStorage as fallback)

const REFRESH_TOKEN_KEY = "gum_refresh_token";

export const tokenStorage = {
  getRefreshToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setRefreshToken: (token: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  },
  clearRefreshToken: (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

// ─── Auth API Calls ──────────────────────────────────────────

/**
 * Login with email/mobile + password
 * Returns user object + token pair
 */
export async function loginApi(
  credentials: LoginRequest
): Promise<ApiResponse<LoginResponse>> {
  const { data } = await api.post<ApiResponse<LoginResponse>>(
    "/auth/login",
    credentials
  );
  return data;
}

/**
 * Refresh access token using stored refresh token
 * Returns fresh user + token pair
 */
export async function refreshTokenApi(): Promise<
  ApiResponse<LoginResponse>
> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const { data } = await api.post<ApiResponse<LoginResponse>>(
    "/auth/refresh",
    { refreshToken }
  );
  return data;
}

/**
 * Logout — revokes session on server
 */
export async function logoutApi(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch {
    // Swallow logout errors — we clear local state regardless
  }
}

/**
 * Fetch current user's permissions
 * Requires valid access token
 */
export async function fetchMyPermissions(): Promise<
  ApiResponse<UserPermission[]>
> {
  const { data } = await api.get("/role-permissions/me");
  const raw = data as Record<string, unknown>;

  // Normalize: API may return { data: { permissions: [...] } } or { data: [...] }
  let permissions: UserPermission[];
  if (Array.isArray(raw.data)) {
    permissions = raw.data as UserPermission[];
  } else if (raw.data && typeof raw.data === "object") {
    const inner = raw.data as Record<string, unknown>;
    // Try common keys: permissions, rolePermissions, data
    const arr = inner.permissions ?? inner.rolePermissions ?? inner.data;
    permissions = Array.isArray(arr) ? (arr as UserPermission[]) : [];
  } else {
    permissions = [];
  }

  return {
    success: (raw.success as boolean) ?? true,
    message: (raw.message as string) ?? "",
    data: permissions,
  };
}

/**
 * Fetch current user profile (via refresh gives us updated user)
 * We use the refresh endpoint as a "me" endpoint since there's
 * no dedicated /auth/me — refresh returns the full user object
 */
export async function fetchCurrentUser(): Promise<{
  user: User;
  tokens: TokenPair;
}> {
  const response = await refreshTokenApi();
  return response.data;
}
