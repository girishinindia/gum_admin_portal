/* ================================================================
   User Service — API calls for User Management (CRUD)
   ================================================================ */
import api from "@/lib/axios";
import { normalizePaginatedResponse } from "@/lib/apiNormalizer";
import type {
  ApiResponse,
  PaginatedResponse,
  User,
  CreateUserRequest,
  UserFilters,
} from "@/types";

// ─── List Users (paginated + filters) ────────────────────────
export async function fetchUsers(
  filters: UserFilters = {}
): Promise<PaginatedResponse<User>> {
  const params = new URLSearchParams();

  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.search) params.set("search", filters.search);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir) params.set("sortDir", filters.sortDir);
  if (filters.isActive !== undefined) params.set("isActive", String(filters.isActive));
  if (filters.isDeleted !== undefined) params.set("isDeleted", String(filters.isDeleted));
  if (filters.isEmailVerified !== undefined) params.set("isEmailVerified", String(filters.isEmailVerified));
  if (filters.isMobileVerified !== undefined) params.set("isMobileVerified", String(filters.isMobileVerified));
  if (filters.countryId) params.set("countryId", String(filters.countryId));
  if (filters.countryIso2) params.set("countryIso2", filters.countryIso2);
  if (filters.nationality) params.set("nationality", filters.nationality);

  const { data } = await api.get(`/users?${params.toString()}`);
  return normalizePaginatedResponse<User>(data as Record<string, unknown>, "users");
}

// ─── Get User by ID ──────────────────────────────────────────
export async function fetchUserById(id: number): Promise<ApiResponse<User>> {
  const { data } = await api.get<ApiResponse<User>>(`/users/${id}`);
  return data;
}

// ─── Get Current User Profile ────────────────────────────────
export async function fetchMyProfile(): Promise<ApiResponse<User>> {
  const { data } = await api.get<ApiResponse<User>>("/users/me");
  return data;
}

// ─── Create User ─────────────────────────────────────────────
export async function createUser(
  payload: CreateUserRequest
): Promise<ApiResponse<{ id: number }>> {
  const { data } = await api.post<ApiResponse<{ id: number }>>(
    "/users",
    payload
  );
  return data;
}

// ─── Update User ─────────────────────────────────────────────
export async function updateUser(
  id: number,
  payload: Partial<CreateUserRequest>
): Promise<ApiResponse<null>> {
  const { data } = await api.patch<ApiResponse<null>>(
    `/users/${id}`,
    payload
  );
  return data;
}

// ─── Update Own Profile ──────────────────────────────────────
export async function updateMyProfile(
  payload: { firstName?: string; lastName?: string }
): Promise<ApiResponse<null>> {
  const { data } = await api.patch<ApiResponse<null>>("/users/me", payload);
  return data;
}

// ─── Delete User (soft-delete) ───────────────────────────────
export async function deleteUser(id: number): Promise<ApiResponse<null>> {
  const { data } = await api.delete<ApiResponse<null>>(`/users/${id}`);
  return data;
}

// ─── Restore User ────────────────────────────────────────────
export async function restoreUser(id: number): Promise<ApiResponse<null>> {
  const { data } = await api.patch<ApiResponse<null>>(
    `/users/${id}/restore`
  );
  return data;
}
