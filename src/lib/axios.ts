/* ================================================================
   Axios Instance — Configured for GrowUpMore API
   Auto-attaches JWT, handles refresh, manages errors
   ================================================================ */
import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "@/store/authStore";
import { tokenStorage } from "@/services/authService";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.growupmore.com";
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || "v1";
const BASE_URL = `${API_URL}/api/${API_VERSION}`;

// ─── Create Instance ─────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// ─── Request Interceptor ─────────────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // ─── Handle 401 — Token Expired ──────────────────────────
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry refresh or login endpoints
      const url = originalRequest.url || "";
      if (url.includes("/auth/refresh") || url.includes("/auth/login")) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = tokenStorage.getRefreshToken();
        if (!refreshToken) throw new Error("No refresh token");

        const refreshResponse = await axios.post(
          `${API_URL}/api/${API_VERSION}/auth/refresh`,
          { refreshToken }
        );

        const { accessToken } = refreshResponse.data.data.tokens;
        const newRefreshToken = refreshResponse.data.data.tokens.refreshToken;
        const { user } = refreshResponse.data.data;

        // Update stored tokens
        tokenStorage.setRefreshToken(newRefreshToken);
        useAuthStore.getState().setAuth(user, accessToken);
        processQueue(null, accessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        tokenStorage.clearRefreshToken();
        useAuthStore.getState().logout();

        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ─── Handle 403 — Forbidden ──────────────────────────────
    if (error.response?.status === 403) {
      console.warn("Access forbidden:", originalRequest.url);
    }

    // ─── Handle 429 — Rate Limited (auto-retry with backoff) ──
    if (error.response?.status === 429) {
      const retryCount = (originalRequest as InternalAxiosRequestConfig & { _retryCount?: number })._retryCount ?? 0;
      if (retryCount < 3) {
        (originalRequest as InternalAxiosRequestConfig & { _retryCount?: number })._retryCount = retryCount + 1;
        const retryAfter = error.response.headers?.["retry-after"];
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : (retryCount + 1) * 1500;
        console.warn(`Rate limited. Retrying in ${delay}ms (attempt ${retryCount + 1}/3)...`);
        await new Promise((r) => setTimeout(r, delay));
        return api(originalRequest);
      }
      console.warn("Rate limited. Max retries exceeded.");
    }

    return Promise.reject(error);
  }
);

export default api;
