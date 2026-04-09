/* ================================================================
   Auth Store — Zustand
   Manages authentication state, tokens, user, and permissions
   ================================================================ */
import { create } from "zustand";
import type { User, UserPermission } from "@/types";
import {
  loginApi,
  logoutApi,
  fetchMyPermissions,
  fetchCurrentUser,
  tokenStorage,
} from "@/services/authService";
import type { LoginRequest } from "@/types";

interface AuthState {
  // ─── State ─────────────────────────────────────────────────
  user: User | null;
  accessToken: string | null;
  permissions: UserPermission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;

  // ─── Actions ───────────────────────────────────────────────
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  loadPermissions: () => Promise<void>;
  setAuth: (user: User, accessToken: string) => void;
  setPermissions: (permissions: UserPermission[]) => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;

  // ─── Permission Helpers ────────────────────────────────────
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  hasAllPermissions: (codes: string[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // ─── Initial State ─────────────────────────────────────────
  user: null,
  accessToken: null,
  permissions: [],
  isAuthenticated: false,
  isLoading: true, // starts true — initializeAuth will resolve it
  authError: null,

  // ─── Login ─────────────────────────────────────────────────
  login: async (credentials) => {
    set({ isLoading: true, authError: null });
    try {
      const response = await loginApi(credentials);
      const { user, tokens } = response.data;

      // Store refresh token persistently
      tokenStorage.setRefreshToken(tokens.refreshToken);

      // Set auth state (access token in memory only)
      set({
        user,
        accessToken: tokens.accessToken,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
      });

      // Load permissions in background
      get().loadPermissions();
    } catch (error: unknown) {
      const message = extractErrorMessage(error);
      set({
        isLoading: false,
        authError: message,
        isAuthenticated: false,
      });
      throw error;
    }
  },

  // ─── Logout ────────────────────────────────────────────────
  logout: async () => {
    try {
      await logoutApi();
    } finally {
      tokenStorage.clearRefreshToken();
      set({
        user: null,
        accessToken: null,
        permissions: [],
        isAuthenticated: false,
        isLoading: false,
        authError: null,
      });
    }
  },

  // ─── Initialize Auth (on app load) ─────────────────────────
  // Checks for existing refresh token, tries to restore session
  initializeAuth: async () => {
    const refreshToken = tokenStorage.getRefreshToken();

    if (!refreshToken) {
      // No stored session — go to login
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      // Try to refresh — this validates the session is still active
      const { user, tokens } = await fetchCurrentUser();

      tokenStorage.setRefreshToken(tokens.refreshToken);

      set({
        user,
        accessToken: tokens.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });

      // Load permissions in background
      get().loadPermissions();
    } catch {
      // Refresh failed — session expired, clear everything
      tokenStorage.clearRefreshToken();
      set({
        user: null,
        accessToken: null,
        permissions: [],
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  // ─── Load Permissions ──────────────────────────────────────
  loadPermissions: async () => {
    try {
      const response = await fetchMyPermissions();
      set({ permissions: response.data });
    } catch {
      console.warn("Failed to load permissions");
      set({ permissions: [] });
    }
  },

  // ─── Direct Setters (for interceptor use) ──────────────────
  setAuth: (user, accessToken) =>
    set({
      user,
      accessToken,
      isAuthenticated: true,
      isLoading: false,
    }),

  setPermissions: (permissions) => set({ permissions }),

  setUser: (user) => set({ user }),

  setLoading: (isLoading) => set({ isLoading }),

  clearError: () => set({ authError: null }),

  // ─── Permission Helpers ────────────────────────────────────
  hasPermission: (code) => {
    const { permissions } = get();
    return permissions.some((p) => p.permissionCode === code);
  },

  hasAnyPermission: (codes) => {
    const { permissions } = get();
    return codes.some((code) =>
      permissions.some((p) => p.permissionCode === code)
    );
  },

  hasAllPermissions: (codes) => {
    const { permissions } = get();
    return codes.every((code) =>
      permissions.some((p) => p.permissionCode === code)
    );
  },
}));

// ─── Error Message Extractor ────────────────────────────────
function extractErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const axiosErr = error as {
      response?: {
        status?: number;
        data?: { message?: string; error?: string; errors?: { field: string; message: string }[] };
      };
    };

    // Log full error response for debugging
    if (process.env.NODE_ENV !== "production") {
      console.error("[Auth Error]", {
        status: axiosErr.response?.status,
        data: axiosErr.response?.data,
      });
    }

    // Field-level validation errors
    if (axiosErr.response?.data?.errors?.length) {
      return axiosErr.response.data.errors.map((e) => e.message).join(". ");
    }

    // API message or error string
    const msg =
      axiosErr.response?.data?.message ||
      axiosErr.response?.data?.error ||
      "";

    if (msg) return msg;

    // Fallback based on status code
    const status = axiosErr.response?.status;
    if (status === 401) return "Invalid email or password.";
    if (status === 403) return "Account is disabled or locked.";
    if (status === 429) return "Too many attempts. Please wait and try again.";
    if (status === 500) return "Server error. Please try again in a moment.";

    return "Login failed. Please try again.";
  }

  // Network error (no response received)
  if (error && typeof error === "object" && "request" in error) {
    return "Network error. Please check your connection.";
  }

  return "An unexpected error occurred. Please try again.";
}
