import type { ApiResponse, AuthTokens } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

// Token management
export const tokens = {
  get access() { return typeof window !== 'undefined' ? localStorage.getItem('access_token') : null; },
  get refresh() { return typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null; },
  set: (access: string, refresh: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  },
  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },
};

// User cache
export const userCache = {
  get() {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  },
  set(user: any) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('user', JSON.stringify(user));
  },
};

// ── Core fetch wrapper with auto token refresh ──
async function request<T = any>(
  path: string,
  options: RequestInit & { auth?: boolean; isFormData?: boolean } = {}
): Promise<ApiResponse<T>> {
  const { auth = true, isFormData = false, ...init } = options;
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (!isFormData && init.body) headers['Content-Type'] = 'application/json';
  if (auth && tokens.access) headers['Authorization'] = `Bearer ${tokens.access}`;

  let res = await fetch(`${API_URL}${path}`, { ...init, headers });

  // Auto-refresh on 401
  if (res.status === 401 && auth && tokens.refresh && !path.includes('/auth/refresh')) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${tokens.access}`;
      res = await fetch(`${API_URL}${path}`, { ...init, headers });
    } else {
      tokens.clear();
      if (typeof window !== 'undefined') window.location.href = '/login?reason=session_expired';
    }
  }

  // Force logout on account suspension / deactivation / account not found
  if (res.status === 403 || res.status === 401) {
    const cloned = res.clone();
    try {
      const body = await cloned.json();
      const code = body?.code;
      if (code === 'ACCOUNT_SUSPENDED' || code === 'ACCOUNT_INACTIVE' || code === 'ACCOUNT_NOT_FOUND' || code === 'SESSION_REVOKED') {
        tokens.clear();
        if (typeof window !== 'undefined') {
          window.location.href = `/login?reason=${code.toLowerCase()}`;
        }
      }
    } catch {}
  }

  const json = await res.json().catch(() => ({ success: false, error: 'Invalid response' }));
  return json;
}

async function refreshTokens(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: tokens.refresh }),
    });
    const data = await res.json();
    if (data.success && data.data?.access_token) {
      tokens.set(data.data.access_token, data.data.refresh_token);
      userCache.set(data.data.user);
      return true;
    }
  } catch {}
  return false;
}

// ── API endpoints ──
export const api = {
  // Auth
  register: (data: any) => request('/auth/register', { method: 'POST', body: JSON.stringify(data), auth: false }),
  verifyOtp: (data: any) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify(data), auth: false }),
  resendOtp: (data: any) => request('/auth/resend-otp', { method: 'POST', body: JSON.stringify(data), auth: false }),
  login: (data: any) => request<AuthTokens>('/auth/login', { method: 'POST', body: JSON.stringify(data), auth: false }),
  logout: () => request('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: tokens.refresh }) }),
  forgotPassword: (data: any) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(data), auth: false }),
  verifyResetOtp: (data: any) => request('/auth/verify-reset-otp', { method: 'POST', body: JSON.stringify(data), auth: false }),
  resendResetOtp: (data: any) => request('/auth/resend-reset-otp', { method: 'POST', body: JSON.stringify(data), auth: false }),
  resetPassword: (data: any) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(data), auth: false }),

  // Users
  me: () => request('/users/me'),
  myPermissions: () => request('/users/me/permissions'),
  updateMe: (data: any, isFormData = false) => request('/users/me', { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  listUsers: (qs = '') => request(`/users${qs}`),
  createUser: (data: any, isFormData = false) => request('/users', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  getUser: (id: number) => request(`/users/${id}`),
  updateUser: (id: number, data: any, isFormData = false) => request(`/users/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  assignUserRole: (id: number, data: any) => request(`/users/${id}/roles`, { method: 'POST', body: JSON.stringify(data) }),
  revokeUserRole: (id: number, roleId: number) => request(`/users/${id}/roles/${roleId}`, { method: 'DELETE' }),
  getUserSessions: (id: number) => request(`/users/${id}/sessions`),
  revokeAllSessions: (id: number) => request(`/users/${id}/revoke-sessions`, { method: 'POST' }),

  // Roles
  listRoles: () => request('/roles'),
  getRole: (id: number) => request(`/roles/${id}`),
  createRole: (data: any) => request('/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: number, data: any) => request(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRole: (id: number) => request(`/roles/${id}`, { method: 'DELETE' }),
  getRolePermissions: (id: number) => request(`/roles/${id}/permissions`),
  assignBulkPermissions: (id: number, permission_ids: number[]) => request(`/roles/${id}/permissions/bulk`, { method: 'POST', body: JSON.stringify({ permission_ids }) }),
  revokeRolePermission: (id: number, pid: number) => request(`/roles/${id}/permissions/${pid}`, { method: 'DELETE' }),

  // Permissions
  listPermissions: () => request('/permissions'),
  listPermissionsGrouped: () => request('/permissions/grouped'),
  updatePermission: (id: number, data: any) => request(`/permissions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Countries
  listCountries: () => request('/countries', { auth: false }),
  getCountry: (id: number) => request(`/countries/${id}`, { auth: false }),
  createCountry: (data: any, isFormData = false) => request('/countries', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateCountry: (id: number, data: any, isFormData = false) => request(`/countries/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteCountry: (id: number) => request(`/countries/${id}`, { method: 'DELETE' }),

  // States
  listStates: (countryId?: number) => request(`/states${countryId ? `?country_id=${countryId}` : ''}`, { auth: false }),
  getState: (id: number) => request(`/states/${id}`, { auth: false }),
  createState: (data: any) => request('/states', { method: 'POST', body: JSON.stringify(data) }),
  updateState: (id: number, data: any) => request(`/states/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteState: (id: number) => request(`/states/${id}`, { method: 'DELETE' }),

  // Cities
  listCities: (stateId?: number) => request(`/cities${stateId ? `?state_id=${stateId}` : ''}`, { auth: false }),
  getCity: (id: number) => request(`/cities/${id}`, { auth: false }),
  createCity: (data: any) => request('/cities', { method: 'POST', body: JSON.stringify(data) }),
  updateCity: (id: number, data: any) => request(`/cities/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCity: (id: number) => request(`/cities/${id}`, { method: 'DELETE' }),

  // Skills
  listSkills: (category?: string) => request(`/skills${category ? `?category=${category}` : ''}`, { auth: false }),
  getSkill: (id: number) => request(`/skills/${id}`, { auth: false }),
  createSkill: (data: any, isFormData = false) => request('/skills', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateSkill: (id: number, data: any, isFormData = false) => request(`/skills/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteSkill: (id: number) => request(`/skills/${id}`, { method: 'DELETE' }),

  // Languages
  listLanguages: (forMaterial?: boolean) => request(`/languages${forMaterial ? '?for_material=true' : ''}`, { auth: false }),
  getLanguage: (id: number) => request(`/languages/${id}`, { auth: false }),
  createLanguage: (data: any) => request('/languages', { method: 'POST', body: JSON.stringify(data) }),
  updateLanguage: (id: number, data: any) => request(`/languages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLanguage: (id: number) => request(`/languages/${id}`, { method: 'DELETE' }),

  // Activity Logs
  authLogs: (qs = '') => request(`/activity-logs/auth${qs}`),
  adminLogs: (qs = '') => request(`/activity-logs/admin${qs}`),
  dataLogs: (qs = '') => request(`/activity-logs/data${qs}`),
  systemLogs: (qs = '') => request(`/activity-logs/system${qs}`),

  // Profile updates (logged-in user)
  changePasswordInitiate: (data: any) => request('/profile/change-password/initiate', { method: 'POST', body: JSON.stringify(data) }),
  changePasswordVerifyOtp: (data: any) => request('/profile/change-password/verify-otp', { method: 'POST', body: JSON.stringify(data) }),
  changePasswordConfirm: (data: any) => request('/profile/change-password/confirm', { method: 'POST', body: JSON.stringify(data) }),
  changePasswordResendOtp: (data: any) => request('/profile/change-password/resend-otp', { method: 'POST', body: JSON.stringify(data) }),
  updateEmailInitiate: (data: any) => request('/profile/update-email/initiate', { method: 'POST', body: JSON.stringify(data) }),
  updateEmailVerifyOtp: (data: any) => request('/profile/update-email/verify-otp', { method: 'POST', body: JSON.stringify(data) }),
  updateEmailResendOtp: (data: any) => request('/profile/update-email/resend-otp', { method: 'POST', body: JSON.stringify(data) }),
  updateMobileInitiate: (data: any) => request('/profile/update-mobile/initiate', { method: 'POST', body: JSON.stringify(data) }),
  updateMobileVerifyOtp: (data: any) => request('/profile/update-mobile/verify-otp', { method: 'POST', body: JSON.stringify(data) }),
  updateMobileResendOtp: (data: any) => request('/profile/update-mobile/resend-otp', { method: 'POST', body: JSON.stringify(data) }),
};
