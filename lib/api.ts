import type { ApiResponse, AuthTokens } from './types';

// Phase 7 (June 2026) — exported so lib/push.ts and one-off pages import the
// single constant instead of re-deriving it.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

// Lightweight presence flag for middleware.ts (cookies are the only thing
// Next.js middleware can read — localStorage is invisible to it). This is a
// UX redirect aid only; real enforcement is the Bearer token on every API
// call. The JWTs themselves stay OUT of cookies.
const AUTH_COOKIE = 'gum_admin_auth';
function setAuthCookie(on: boolean) {
  if (typeof document === 'undefined') return;
  document.cookie = on
    ? `${AUTH_COOKIE}=1; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`
    : `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

// Token management
export const tokens = {
  get access() { return typeof window !== 'undefined' ? localStorage.getItem('access_token') : null; },
  get refresh() { return typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null; },
  set: (access: string, refresh: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    setAuthCookie(true);
  },
  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setAuthCookie(false);
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

  // Phase 44 — surface API failures instead of swallowing them.
  //
  // Before this guard, the wrapper returned the parsed body even when
  // the HTTP status was 4xx/5xx OR the envelope's `success` flag was
  // false. Callers do `await api.xxx(...)` and assume the promise only
  // resolves on success — so they'd hit `toast.success(...)` even
  // though the row never landed in the DB. The most visible symptom
  // was Live Sessions: "Session created" toast + empty list (Supabase
  // confirmed 0 rows). The same bug was silently hiding every other
  // failed write across the admin portal.
  //
  // Behaviour now matches what callers already expect:
  //   • 2xx + `success !== false` → resolve with the body
  //   • anything else → throw an Error with the server's `error` /
  //     `message`, which every page's `catch (e) { toast.error(e.message) }`
  //     turns into a real, readable failure toast.
  if (!res.ok || json?.success === false) {
    const message =
      (typeof json?.error === 'string'   && json.error)   ||
      (typeof json?.message === 'string' && json.message) ||
      `Request failed (${res.status})`;
    // Stale-pagination guard (platform-wide). A list page still on a high page
    // number after a filter narrows the result set asks the API for rows past
    // the end, which PostgREST rejects as "Requested range not satisfiable".
    // That's an empty page, not a real failure — resolve with an empty list
    // envelope so the table renders nothing and its "reset to page 1" effect
    // reloads, instead of throwing an unhandled error that crashes the route.
    if (/range not satisfiable/i.test(message)) {
      return { success: true, data: [], pagination: { total: 0, page: 1, limit: 0, totalPages: 1 } } as unknown as ApiResponse<T>;
    }
    throw new Error(message);
  }
  return json;
}

// Phase 14 — expose `request` as `apiRequest` so hooks can hit any path
// without having to add a one-liner to the bulky `api` object.
export { request as apiRequest };

// Phase 7 (June 2026) — FormData uploads used to call fetch() directly,
// skipping BOTH the 401 auto-refresh and the Phase 44 error guard (failures
// resolved with raw JSON, so pages toasted "success" on failed writes).
// Routing them through request() restores both behaviours in one place.
function formDataRequest<T = any>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH',
  fd: FormData,
): Promise<ApiResponse<T>> {
  return request<T>(path, { method, body: fd, isFormData: true });
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

// Phase 44.11 — shared XHR upload helper for the dedicated course video
// endpoints. Mirrors uploadSubTopicVideo (the proven memory-buffer path):
// FormData field name `video`, real upload progress via xhr.upload.onprogress,
// resolves the parsed JSON envelope. Used by uploadCourseVideo /
// uploadCourseTrailerVideo so videos no longer ride the combined course-save
// multipart (which used a broken streaming upload → video_url stayed null).
function _uploadCourseVideoXhr(
  path: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('video', file, file.name);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}${path}`);
    if (tokens.access) xhr.setRequestHeader('Authorization', `Bearer ${tokens.access}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        resolve({ success: false, error: 'Invalid response' });
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(fd);
  });
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
  // Phase 45 — assignable users for owner-aware pickers. kind: 'instructor' | 'super_admin'
  listAssignableUsers: (kind: 'instructor' | 'super_admin') => request(`/users/assignable?kind=${kind}`),
  createUser: (data: any, isFormData = false) => request('/users', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  getUser: (id: number) => request(`/users/${id}`),
  updateUser: (id: number, data: any, isFormData = false) => request(`/users/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteUser: (id: number) => request(`/users/${id}`, { method: 'DELETE' }),
  restoreUser: (id: number) => request(`/users/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteUser: (id: number) => request(`/users/${id}/permanent`, { method: 'DELETE' }),
  assignUserRole: (id: number, data: any) => request(`/users/${id}/roles`, { method: 'POST', body: JSON.stringify(data) }),
  revokeUserRole: (id: number, roleId: number) => request(`/users/${id}/roles/${roleId}`, { method: 'DELETE' }),
  getUserSessions: (id: number) => request(`/users/${id}/sessions`),
  revokeAllSessions: (id: number) => request(`/users/${id}/revoke-sessions`, { method: 'POST' }),

  // Roles
  listRoles: (qs = '') => request(`/roles${qs}`),
  getRole: (id: number) => request(`/roles/${id}`),
  createRole: (data: any) => request('/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: number, data: any) => request(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRole: (id: number) => request(`/roles/${id}`, { method: 'DELETE' }),
  restoreRole: (id: number) => request(`/roles/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteRole: (id: number) => request(`/roles/${id}/permanent`, { method: 'DELETE' }),
  getRolePermissions: (id: number) => request(`/roles/${id}/permissions`),
  assignBulkPermissions: (id: number, permission_ids: number[]) => request(`/roles/${id}/permissions/bulk`, { method: 'POST', body: JSON.stringify({ permission_ids }) }),
  revokeRolePermission: (id: number, pid: number) => request(`/roles/${id}/permissions/${pid}`, { method: 'DELETE' }),

  // Permissions
  listPermissions: () => request('/permissions'),
  listPermissionsGrouped: () => request('/permissions/grouped'),
  updatePermission: (id: number, data: any) => request(`/permissions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Countries
  listCountries: (qs = '') => request(`/countries${qs}`, { auth: false }),
  getCountry: (id: number) => request(`/countries/${id}`, { auth: false }),
  createCountry: (data: any, isFormData = false) => request('/countries', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateCountry: (id: number, data: any, isFormData = false) => request(`/countries/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteCountry: (id: number) => request(`/countries/${id}`, { method: 'DELETE' }),
  restoreCountry: (id: number) => request(`/countries/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteCountry: (id: number) => request(`/countries/${id}/permanent`, { method: 'DELETE' }),

  // States
  listStates: (qs = '') => request(`/states${qs}`, { auth: false }),
  getState: (id: number) => request(`/states/${id}`, { auth: false }),
  createState: (data: any) => request('/states', { method: 'POST', body: JSON.stringify(data) }),
  updateState: (id: number, data: any) => request(`/states/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteState: (id: number) => request(`/states/${id}`, { method: 'DELETE' }),
  restoreState: (id: number) => request(`/states/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteState: (id: number) => request(`/states/${id}/permanent`, { method: 'DELETE' }),

  // Cities
  listCities: (qs = '') => request(`/cities${qs}`, { auth: false }),
  getCity: (id: number) => request(`/cities/${id}`, { auth: false }),
  createCity: (data: any) => request('/cities', { method: 'POST', body: JSON.stringify(data) }),
  updateCity: (id: number, data: any) => request(`/cities/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCity: (id: number) => request(`/cities/${id}`, { method: 'DELETE' }),
  restoreCity: (id: number) => request(`/cities/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteCity: (id: number) => request(`/cities/${id}/permanent`, { method: 'DELETE' }),

  // Skills
  listSkills: (qs = '') => request(`/skills${qs}`, { auth: false }),
  getSkill: (id: number) => request(`/skills/${id}`, { auth: false }),
  createSkill: (data: any, isFormData = false) => request('/skills', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateSkill: (id: number, data: any, isFormData = false) => request(`/skills/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteSkill: (id: number) => request(`/skills/${id}`, { method: 'DELETE' }),
  restoreSkill: (id: number) => request(`/skills/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteSkill: (id: number) => request(`/skills/${id}/permanent`, { method: 'DELETE' }),

  // Languages
  listLanguages: (qs = '') => request(`/languages${qs}`, { auth: false }),
  getLanguage: (id: number) => request(`/languages/${id}`, { auth: false }),
  createLanguage: (data: any) => request('/languages', { method: 'POST', body: JSON.stringify(data) }),
  updateLanguage: (id: number, data: any) => request(`/languages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLanguage: (id: number) => request(`/languages/${id}`, { method: 'DELETE' }),
  restoreLanguage: (id: number) => request(`/languages/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteLanguage: (id: number) => request(`/languages/${id}/permanent`, { method: 'DELETE' }),

  // Education Levels
  listEducationLevels: (qs = '') => request(`/education-levels${qs}`, { auth: false }),
  getEducationLevel: (id: number) => request(`/education-levels/${id}`, { auth: false }),
  createEducationLevel: (data: any) => request('/education-levels', { method: 'POST', body: JSON.stringify(data) }),
  updateEducationLevel: (id: number, data: any) => request(`/education-levels/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEducationLevel: (id: number) => request(`/education-levels/${id}`, { method: 'DELETE' }),
  restoreEducationLevel: (id: number) => request(`/education-levels/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteEducationLevel: (id: number) => request(`/education-levels/${id}/permanent`, { method: 'DELETE' }),

  // Document Types
  listDocumentTypes: (qs = '') => request(`/document-types${qs}`, { auth: false }),
  getDocumentType: (id: number) => request(`/document-types/${id}`, { auth: false }),
  createDocumentType: (data: any) => request('/document-types', { method: 'POST', body: JSON.stringify(data) }),
  updateDocumentType: (id: number, data: any) => request(`/document-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDocumentType: (id: number) => request(`/document-types/${id}`, { method: 'DELETE' }),
  restoreDocumentType: (id: number) => request(`/document-types/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteDocumentType: (id: number) => request(`/document-types/${id}/permanent`, { method: 'DELETE' }),

  // Documents
  listDocuments: (qs = '') => request(`/documents${qs}`, { auth: false }),
  getDocument: (id: number) => request(`/documents/${id}`, { auth: false }),
  createDocument: (data: any, isFormData = false) => request('/documents', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateDocument: (id: number, data: any, isFormData = false) => request(`/documents/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteDocument: (id: number) => request(`/documents/${id}`, { method: 'DELETE' }),
  restoreDocument: (id: number) => request(`/documents/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteDocument: (id: number) => request(`/documents/${id}/permanent`, { method: 'DELETE' }),

  // Designations
  listDesignations: (qs = '') => request(`/designations${qs}`, { auth: false }),
  getDesignation: (id: number) => request(`/designations/${id}`, { auth: false }),
  createDesignation: (data: any) => request('/designations', { method: 'POST', body: JSON.stringify(data) }),
  updateDesignation: (id: number, data: any) => request(`/designations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDesignation: (id: number) => request(`/designations/${id}`, { method: 'DELETE' }),
  restoreDesignation: (id: number) => request(`/designations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteDesignation: (id: number) => request(`/designations/${id}/permanent`, { method: 'DELETE' }),

  // Specializations
  listSpecializations: (qs = '') => request(`/specializations${qs}`, { auth: false }),
  getSpecialization: (id: number) => request(`/specializations/${id}`, { auth: false }),
  createSpecialization: (data: any) => request('/specializations', { method: 'POST', body: JSON.stringify(data) }),
  updateSpecialization: (id: number, data: any) => request(`/specializations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSpecialization: (id: number) => request(`/specializations/${id}`, { method: 'DELETE' }),
  restoreSpecialization: (id: number) => request(`/specializations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteSpecialization: (id: number) => request(`/specializations/${id}/permanent`, { method: 'DELETE' }),

  // Learning Goals
  listLearningGoals: (qs = '') => request(`/learning-goals${qs}`, { auth: false }),
  getLearningGoal: (id: number) => request(`/learning-goals/${id}`, { auth: false }),
  createLearningGoal: (data: any) => request('/learning-goals', { method: 'POST', body: JSON.stringify(data) }),
  updateLearningGoal: (id: number, data: any) => request(`/learning-goals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLearningGoal: (id: number) => request(`/learning-goals/${id}`, { method: 'DELETE' }),
  restoreLearningGoal: (id: number) => request(`/learning-goals/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteLearningGoal: (id: number) => request(`/learning-goals/${id}/permanent`, { method: 'DELETE' }),

  // Social Medias
  listSocialMedias: (qs = '') => request(`/social-medias${qs}`, { auth: false }),
  getSocialMedia: (id: number) => request(`/social-medias/${id}`, { auth: false }),
  createSocialMedia: (data: any, isFormData = false) => request('/social-medias', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateSocialMedia: (id: number, data: any, isFormData = false) => request(`/social-medias/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteSocialMedia: (id: number) => request(`/social-medias/${id}`, { method: 'DELETE' }),
  restoreSocialMedia: (id: number) => request(`/social-medias/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteSocialMedia: (id: number) => request(`/social-medias/${id}/permanent`, { method: 'DELETE' }),

  // Categories
  listCategories: (qs = '') => request(`/categories${qs}`, { auth: false }),
  getCategory: (id: number) => request(`/categories/${id}`, { auth: false }),
  createCategory: (data: any, isFormData = false) => request('/categories', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateCategory: (id: number, data: any, isFormData = false) => request(`/categories/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteCategory: (id: number) => request(`/categories/${id}`, { method: 'DELETE' }),
  restoreCategory: (id: number) => request(`/categories/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteCategory: (id: number) => request(`/categories/${id}/permanent`, { method: 'DELETE' }),

  // Sub-Categories
  listSubCategories: (qs = '') => request(`/sub-categories${qs}`, { auth: false }),
  getSubCategory: (id: number) => request(`/sub-categories/${id}`, { auth: false }),
  createSubCategory: (data: any, isFormData = false) => request('/sub-categories', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateSubCategory: (id: number, data: any, isFormData = false) => request(`/sub-categories/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteSubCategory: (id: number) => request(`/sub-categories/${id}`, { method: 'DELETE' }),
  restoreSubCategory: (id: number) => request(`/sub-categories/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteSubCategory: (id: number) => request(`/sub-categories/${id}/permanent`, { method: 'DELETE' }),

  // Category Translations
  listCategoryTranslations: (qs = '') => request(`/category-translations${qs}`, { auth: false }),
  getCategoryTranslation: (id: number) => request(`/category-translations/${id}`, { auth: false }),
  createCategoryTranslation: (data: any, isFormData = false) => request('/category-translations', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateCategoryTranslation: (id: number, data: any, isFormData = false) => request(`/category-translations/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteCategoryTranslation: (id: number) => request(`/category-translations/${id}`, { method: 'DELETE' }),
  restoreCategoryTranslation: (id: number) => request(`/category-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteCategoryTranslation: (id: number) => request(`/category-translations/${id}/permanent`, { method: 'DELETE' }),

  // Sub-Category Translations
  listSubCategoryTranslations: (qs = '') => request(`/sub-category-translations${qs}`, { auth: false }),
  getSubCategoryTranslation: (id: number) => request(`/sub-category-translations/${id}`, { auth: false }),
  createSubCategoryTranslation: (data: any, isFormData = false) => request('/sub-category-translations', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateSubCategoryTranslation: (id: number, data: any, isFormData = false) => request(`/sub-category-translations/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteSubCategoryTranslation: (id: number) => request(`/sub-category-translations/${id}`, { method: 'DELETE' }),
  restoreSubCategoryTranslation: (id: number) => request(`/sub-category-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteSubCategoryTranslation: (id: number) => request(`/sub-category-translations/${id}/permanent`, { method: 'DELETE' }),

  // Category Translation Coverage
  getCategoryTranslationCoverage: () => request('/category-translations/coverage', { auth: false }),

  // Sub-Category Translation Coverage
  getSubCategoryTranslationCoverage: () => request('/sub-category-translations/coverage', { auth: false }),

  // Subjects
  listSubjects: (qs = '') => request(`/subjects${qs}`, { auth: false }),
  getSubject: (id: number) => request(`/subjects/${id}`, { auth: false }),
  createSubject: (data: any) => request('/subjects', { method: 'POST', body: JSON.stringify(data) }),
  updateSubject: (id: number, data: any) => request(`/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSubject: (id: number) => request(`/subjects/${id}`, { method: 'DELETE' }),
  restoreSubject: (id: number) => request(`/subjects/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteSubject: (id: number) => request(`/subjects/${id}/permanent`, { method: 'DELETE' }),

  // Chapters
  listChapters: (qs = '') => request(`/chapters${qs}`, { auth: false }),
  getChapter: (id: number) => request(`/chapters/${id}`, { auth: false }),
  createChapter: (data: any) => request('/chapters', { method: 'POST', body: JSON.stringify(data) }),
  updateChapter: (id: number, data: any) => request(`/chapters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteChapter: (id: number) => request(`/chapters/${id}`, { method: 'DELETE' }),
  restoreChapter: (id: number) => request(`/chapters/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteChapter: (id: number) => request(`/chapters/${id}/permanent`, { method: 'DELETE' }),

  // Topics
  listTopics: (qs = '') => request(`/topics${qs}`, { auth: false }),
  getTopic: (id: number) => request(`/topics/${id}`, { auth: false }),
  createTopic: (data: any) => request('/topics', { method: 'POST', body: JSON.stringify(data) }),
  updateTopic: (id: number, data: any) => request(`/topics/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTopic: (id: number) => request(`/topics/${id}`, { method: 'DELETE' }),
  restoreTopic: (id: number) => request(`/topics/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteTopic: (id: number) => request(`/topics/${id}/permanent`, { method: 'DELETE' }),

  // Subject Translations
  listSubjectTranslations: (qs = '') => request(`/subject-translations${qs}`, { auth: false }),
  getSubjectTranslation: (id: number) => request(`/subject-translations/${id}`, { auth: false }),
  createSubjectTranslation: (data: any, isFormData = false) => request('/subject-translations', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateSubjectTranslation: (id: number, data: any, isFormData = false) => request(`/subject-translations/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteSubjectTranslation: (id: number) => request(`/subject-translations/${id}`, { method: 'DELETE' }),
  restoreSubjectTranslation: (id: number) => request(`/subject-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteSubjectTranslation: (id: number) => request(`/subject-translations/${id}/permanent`, { method: 'DELETE' }),
  getSubjectTranslationCoverage: () => request('/subject-translations/coverage', { auth: false }),

  // Chapter Translations
  listChapterTranslations: (qs = '') => request(`/chapter-translations${qs}`, { auth: false }),
  getChapterTranslation: (id: number) => request(`/chapter-translations/${id}`, { auth: false }),
  createChapterTranslation: (data: any, isFormData = false) => request('/chapter-translations', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateChapterTranslation: (id: number, data: any, isFormData = false) => request(`/chapter-translations/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteChapterTranslation: (id: number) => request(`/chapter-translations/${id}`, { method: 'DELETE' }),
  restoreChapterTranslation: (id: number) => request(`/chapter-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteChapterTranslation: (id: number) => request(`/chapter-translations/${id}/permanent`, { method: 'DELETE' }),
  getChapterTranslationCoverage: () => request('/chapter-translations/coverage', { auth: false }),

  // Topic Translations
  listTopicTranslations: (qs = '') => request(`/topic-translations${qs}`, { auth: false }),
  getTopicTranslation: (id: number) => request(`/topic-translations/${id}`, { auth: false }),
  createTopicTranslation: (data: any, isFormData = false) => request('/topic-translations', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateTopicTranslation: (id: number, data: any, isFormData = false) => request(`/topic-translations/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteTopicTranslation: (id: number) => request(`/topic-translations/${id}`, { method: 'DELETE' }),
  restoreTopicTranslation: (id: number) => request(`/topic-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteTopicTranslation: (id: number) => request(`/topic-translations/${id}/permanent`, { method: 'DELETE' }),
  getTopicTranslationCoverage: () => request('/topic-translations/coverage', { auth: false }),

  // Sub-Topics
  listSubTopics: (qs = '') => request(`/sub-topics${qs}`, { auth: false }),
  getSubTopic: (id: number) => request(`/sub-topics/${id}`, { auth: false }),
  getSubTopicPlayback: (id: number) => request(`/sub-topics/${id}/video-playback`), // BUG-12: signed preview urls
  createSubTopic: (data: any) => request('/sub-topics', { method: 'POST', body: JSON.stringify(data) }),
  updateSubTopic: (id: number, data: any) => request(`/sub-topics/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSubTopic: (id: number) => request(`/sub-topics/${id}`, { method: 'DELETE' }),
  restoreSubTopic: (id: number) => request(`/sub-topics/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteSubTopic: (id: number) => request(`/sub-topics/${id}/permanent`, { method: 'DELETE' }),

  // Sub-Topic Video
  uploadSubTopicVideo: (id: number, file: File, onProgress?: (percent: number) => void): Promise<any> => {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append('video', file, file.name);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/sub-topics/${id}/upload-video`);
      if (tokens.access) xhr.setRequestHeader('Authorization', `Bearer ${tokens.access}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          resolve({ success: false, error: 'Invalid response' });
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(fd);
    });
  },

  // Phase 44.11 — dedicated course video upload with real progress, mirroring
  // the proven uploadSubTopicVideo helper. Used instead of the combined
  // course-save multipart for videos (that path used a broken streaming
  // upload that left video_url null on every course).
  uploadCourseVideo: (id: number, file: File, onProgress?: (percent: number) => void): Promise<any> =>
    _uploadCourseVideoXhr(`/courses/${id}/upload-video`, file, onProgress),
  uploadCourseTrailerVideo: (id: number, file: File, onProgress?: (percent: number) => void): Promise<any> =>
    _uploadCourseVideoXhr(`/courses/${id}/upload-trailer-video`, file, onProgress),

  // Phase 45.1 — signed playback URLs (the Bunny library is token-gated, so
  // the raw embed URL 403s). Returns { video, trailer } each {url, expiresAt}|null.
  getCoursePlayback: (id: number) => request(`/courses/${id}/playback`),

  deleteSubTopicVideo: (id: number) => request(`/sub-topics/${id}/video`, { method: 'DELETE' }),

  getSubTopicVideoStatus: (id: number) => request(`/sub-topics/${id}/video-status`),

  // Sub-Topic Translations
  listSubTopicTranslations: (qs = '') => request(`/sub-topic-translations${qs}`, { auth: false }),
  getSubTopicTranslation: (id: number) => request(`/sub-topic-translations/${id}`, { auth: false }),
  createSubTopicTranslation: (data: any, isFormData = false) => request('/sub-topic-translations', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateSubTopicTranslation: (id: number, data: any, isFormData = false) => request(`/sub-topic-translations/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteSubTopicTranslation: (id: number) => request(`/sub-topic-translations/${id}`, { method: 'DELETE' }),
  restoreSubTopicTranslation: (id: number) => request(`/sub-topic-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteSubTopicTranslation: (id: number) => request(`/sub-topic-translations/${id}/permanent`, { method: 'DELETE' }),
  getSubTopicTranslationCoverage: () => request('/sub-topic-translations/coverage', { auth: false }),

  // AI — Category Translations
  generateTranslation: (data: { category_id: number; target_language_code: string; target_language_name: string; prompt?: string; provider?: string }) =>
    request('/ai/generate-translation', { method: 'POST', body: JSON.stringify(data) }),
  bulkGenerateTranslations: (data: { category_id: number; prompt?: string; provider?: string }) =>
    request('/ai/bulk-generate-translations', { method: 'POST', body: JSON.stringify(data) }),

  // AI — Sub-Category Translations
  generateSubCategoryTranslation: (data: { sub_category_id: number; target_language_code: string; target_language_name: string; prompt?: string; provider?: string }) =>
    request('/ai/generate-sub-category-translation', { method: 'POST', body: JSON.stringify(data) }),
  bulkGenerateSubCategoryTranslations: (data: { sub_category_id: number; prompt?: string; provider?: string }) =>
    request('/ai/bulk-generate-sub-category-translations', { method: 'POST', body: JSON.stringify(data) }),

  // AI — Subject Translations
  generateSubjectTranslation: (data: { subject_id: number; target_language_code: string; target_language_name: string; prompt?: string; provider?: string }) =>
    request('/ai/generate-subject-translation', { method: 'POST', body: JSON.stringify(data) }),
  bulkGenerateSubjectTranslations: (data: { subject_id: number; prompt?: string; provider?: string }) =>
    request('/ai/bulk-generate-subject-translations', { method: 'POST', body: JSON.stringify(data) }),

  // AI — Chapter Translations
  generateChapterTranslation: (data: { chapter_id: number; target_language_code: string; target_language_name: string; prompt?: string; provider?: string }) =>
    request('/ai/generate-chapter-translation', { method: 'POST', body: JSON.stringify(data) }),
  bulkGenerateChapterTranslations: (data: { chapter_id: number; prompt?: string; provider?: string }) =>
    request('/ai/bulk-generate-chapter-translations', { method: 'POST', body: JSON.stringify(data) }),

  // AI — Topic Translations
  generateTopicTranslation: (data: { topic_id: number; target_language_code: string; target_language_name: string; prompt?: string; provider?: string }) =>
    request('/ai/generate-topic-translation', { method: 'POST', body: JSON.stringify(data) }),
  bulkGenerateTopicTranslations: (data: { topic_id: number; prompt?: string; provider?: string }) =>
    request('/ai/bulk-generate-topic-translations', { method: 'POST', body: JSON.stringify(data) }),

  // AI — Sub-Topic Translations
  generateSubTopicTranslation: (data: { sub_topic_id: number; target_language_code: string; target_language_name: string; prompt?: string; provider?: string }) =>
    request('/ai/generate-sub-topic-translation', { method: 'POST', body: JSON.stringify(data) }),
  bulkGenerateSubTopicTranslations: (data: { sub_topic_id: number; prompt?: string; provider?: string }) =>
    request('/ai/bulk-generate-sub-topic-translations', { method: 'POST', body: JSON.stringify(data) }),

  // AI — Bulk generate missing content for multiple entities (or all with generate_all)
  bulkGenerateMissingContent: (data: { entity_type: string; entity_ids?: number[]; generate_all?: boolean; force_regenerate?: boolean; prompt?: string; provider?: string }) =>
    request('/ai/bulk-generate-missing-content', { method: 'POST', body: JSON.stringify(data) }),

  // AI — Generic single-language generate/translate for any entity (returns fields for the form)
  generateEntityTranslation: (data: { entity_type: string; entity_id: number; target_language_code: string; target_language_name?: string; prompt?: string; provider?: string }) =>
    request('/ai/generate-entity-translation', { method: 'POST', body: JSON.stringify(data) }),

  // AI — Blog post content + SEO (single-language, in-place fill)
  generateBlogPostContent: (data: { title: string; category?: string; prompt?: string; provider?: string }) =>
    request('/ai/generate-blog-post-content', { method: 'POST', body: JSON.stringify(data) }),

  // AI — Auto Sub Topics from HTML
  autoSubTopics: (fd: FormData) =>
    request('/ai/auto-sub-topics', { method: 'POST', body: fd, isFormData: true }),

  // AI — Translate HTML page to all languages
  translatePage: (fd: FormData) =>
    request('/ai/translate-page', { method: 'POST', body: fd, isFormData: true }),

  // AI — Reverse translate HTML page to English
  reverseTranslatePage: (fd: FormData) =>
    request('/ai/reverse-translate-page', { method: 'POST', body: fd, isFormData: true }),

  // AI — Import Material Tree from TXT
  importMaterialTree: (fd: FormData) =>
    request('/ai/import-material-tree', { method: 'POST', body: fd, isFormData: true }),

  // AI — Scan CDN (read-only preview of course folders)
  scanCdn: () =>
    request('/ai/scan-cdn', { method: 'POST', body: JSON.stringify({}) }),

  // AI — Import from CDN (scan Bunny storage and create/sync DB records)
  importFromCdn: (data: { provider?: string; generate_seo?: boolean; upload_videos?: boolean; sync_mode?: string; auto_delete?: boolean; selected_courses?: string[]; selected_items?: { course: string; chapters?: { name: string; topics?: { name: string; subTopics?: string[] }[] }[] }[] }, signal?: AbortSignal) =>
    request('/ai/import-from-cdn', { method: 'POST', body: JSON.stringify(data), signal }),

  // AI — Scaffold CDN folder structure from .txt content
  scaffoldCdn: (data: { txt_content: string }) =>
    request('/ai/scaffold-cdn', { method: 'POST', body: JSON.stringify(data) }),

  // AI — Check video transcoding status
  checkVideoStatus: () =>
    request('/ai/check-video-status', { method: 'POST', body: JSON.stringify({}) }),

  // AI — Clean orphaned videos from Bunny Stream
  cleanOrphanedVideos: (data: { dry_run?: boolean } = {}) =>
    request('/ai/clean-orphaned-videos', { method: 'POST', body: JSON.stringify(data) }),

  // AI — YouTube Description Generation
  generateYoutubeDescription: (data: { sub_topic_ids?: number[]; subject_id?: number; chapter_id?: number; topic_id?: number; subject_ids?: number[]; chapter_ids?: number[]; topic_ids?: number[]; provider?: string }) =>
    request('/ai/generate-youtube-description', { method: 'POST', body: JSON.stringify(data) }),

  // YouTube Descriptions CRUD
  listYoutubeDescriptions: (qs = '') => request(`/youtube-descriptions${qs}`),
  getYoutubeDescription: (id: number) => request(`/youtube-descriptions/${id}`),
  getYoutubeDescriptionBySubTopic: (subTopicId: number) => request(`/youtube-descriptions/sub-topic/${subTopicId}`),
  updateYoutubeDescription: (id: number, data: { video_title?: string; description?: string }) =>
    request(`/youtube-descriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteYoutubeDescription: (id: number) => request(`/youtube-descriptions/${id}`, { method: 'DELETE' }),
  bulkDeleteYoutubeDescriptions: (ids: number[]) =>
    request(`/youtube-descriptions/bulk-delete`, { method: 'POST', body: JSON.stringify({ ids }) }),

  // Courses
  listCourses: (qs = '') => request(`/courses${qs}`, { auth: false }),
  getCourse: (id: number) => request(`/courses/${id}`, { auth: false }),
  createCourse: (data: any, isFormData = false) => request('/courses', { method: 'POST', body: isFormData ? (data as any) : JSON.stringify(data), isFormData }),
  updateCourse: (id: number, data: any, isFormData = false) => request(`/courses/${id}`, { method: 'PATCH', body: isFormData ? (data as any) : JSON.stringify(data), isFormData }),

  // Phase 44.9 Issue 1 — multipart course save with real upload progress.
  // fetch() can't report upload progress, so for the media path (which can
  // carry a multi-hundred-MB video) we use XHR with xhr.upload.onprogress.
  // `onProgress(percent)` fires 0..100 as bytes leave the browser; once it
  // hits 100 the server is processing (streaming to Bunny). Mirrors the
  // existing uploadSubTopicVideo helper.
  saveCourseWithProgress: (
    id: number | null,
    fd: FormData,
    onProgress?: (percent: number) => void,
  ): Promise<any> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const url = id ? `${API_URL}/courses/${id}` : `${API_URL}/courses`;
      xhr.open(id ? 'PATCH' : 'POST', url);
      if (tokens.access) xhr.setRequestHeader('Authorization', `Bearer ${tokens.access}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          // Surface non-2xx with the server's real error message.
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else resolve({ success: false, error: data?.error || data?.message || `Save failed (${xhr.status})` });
        } catch {
          resolve({ success: false, error: `Save failed (${xhr.status})` });
        }
      };
      xhr.onerror = () => resolve({ success: false, error: 'Upload failed — connection error' });
      xhr.ontimeout = () => resolve({ success: false, error: 'Upload timed out' });
      xhr.send(fd);
    });
  },
  deleteCourse: (id: number) => request(`/courses/${id}`, { method: 'DELETE' }),
  restoreCourse: (id: number) => request(`/courses/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteCourse: (id: number) => request(`/courses/${id}/permanent`, { method: 'DELETE' }),
  previewCourseImport: (content: string) => request('/courses/import/preview', { method: 'POST', body: JSON.stringify({ content }) }),
  importCourseFromTxt: (content: string, overwrite = false) => request('/courses/import', { method: 'POST', body: JSON.stringify({ content, overwrite }) }),

  // Course Translations
  listCourseTranslations: (qs = '') => request(`/course-translations${qs}`, { auth: false }),
  getCourseTranslation: (id: number) => request(`/course-translations/${id}`, { auth: false }),
  createCourseTranslation: (data: any, isFormData = false) => request('/course-translations', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateCourseTranslation: (id: number, data: any, isFormData = false) => request(`/course-translations/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteCourseTranslation: (id: number) => request(`/course-translations/${id}`, { method: 'DELETE' }),
  restoreCourseTranslation: (id: number) => request(`/course-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteCourseTranslation: (id: number) => request(`/course-translations/${id}/permanent`, { method: 'DELETE' }),
  getCourseTranslationCoverage: () => request('/course-translations/coverage', { auth: false }),

  // Course Sub-Categories (junction)
  listCourseSubCategories: (qs = '') => request(`/course-sub-categories${qs}`, { auth: false }),
  getCourseSubCategory: (id: number) => request(`/course-sub-categories/${id}`, { auth: false }),
  createCourseSubCategory: (data: any) => request('/course-sub-categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCourseSubCategory: (id: number, data: any) => request(`/course-sub-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCourseSubCategory: (id: number) => request(`/course-sub-categories/${id}`, { method: 'DELETE' }),
  restoreCourseSubCategory: (id: number) => request(`/course-sub-categories/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteCourseSubCategory: (id: number) => request(`/course-sub-categories/${id}/permanent`, { method: 'DELETE' }),

  // Course Modules
  listCourseModules: (qs = '') => request(`/course-modules${qs}`, { auth: false }),
  getCourseModule: (id: number) => request(`/course-modules/${id}`, { auth: false }),
  createCourseModule: (data: any) => request('/course-modules', { method: 'POST', body: JSON.stringify(data) }),
  updateCourseModule: (id: number, data: any) => request(`/course-modules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCourseModule: (id: number) => request(`/course-modules/${id}`, { method: 'DELETE' }),
  restoreCourseModule: (id: number) => request(`/course-modules/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteCourseModule: (id: number) => request(`/course-modules/${id}/permanent`, { method: 'DELETE' }),

  // Course Module Translations
  listCourseModuleTranslations: (qs = '') => request(`/course-module-translations${qs}`, { auth: false }),
  getCourseModuleTranslation: (id: number) => request(`/course-module-translations/${id}`, { auth: false }),
  createCourseModuleTranslation: (data: any, isFormData = false) => request('/course-module-translations', { method: 'POST', body: isFormData ? data : JSON.stringify(data), isFormData }),
  updateCourseModuleTranslation: (id: number, data: any, isFormData = false) => request(`/course-module-translations/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteCourseModuleTranslation: (id: number) => request(`/course-module-translations/${id}`, { method: 'DELETE' }),
  restoreCourseModuleTranslation: (id: number) => request(`/course-module-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteCourseModuleTranslation: (id: number) => request(`/course-module-translations/${id}/permanent`, { method: 'DELETE' }),
  getCourseModuleTranslationCoverage: () => request('/course-module-translations/coverage', { auth: false }),

  // Course Module Subjects (junction: module → subject)
  listCourseModuleSubjects: (qs = '') => request(`/course-module-subjects${qs}`, { auth: false }),
  getCourseModuleSubject: (id: number) => request(`/course-module-subjects/${id}`, { auth: false }),
  createCourseModuleSubject: (data: any) => request('/course-module-subjects', { method: 'POST', body: JSON.stringify(data) }),
  updateCourseModuleSubject: (id: number, data: any) => request(`/course-module-subjects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCourseModuleSubject: (id: number) => request(`/course-module-subjects/${id}`, { method: 'DELETE' }),
  restoreCourseModuleSubject: (id: number) => request(`/course-module-subjects/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteCourseModuleSubject: (id: number) => request(`/course-module-subjects/${id}/permanent`, { method: 'DELETE' }),

  // Course Chapters (junction: module-subject → chapter)
  listCourseChapters: (qs = '') => request(`/course-chapters${qs}`, { auth: false }),
  getCourseChapter: (id: number) => request(`/course-chapters/${id}`, { auth: false }),
  createCourseChapter: (data: any) => request('/course-chapters', { method: 'POST', body: JSON.stringify(data) }),
  updateCourseChapter: (id: number, data: any) => request(`/course-chapters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCourseChapter: (id: number) => request(`/course-chapters/${id}`, { method: 'DELETE' }),
  restoreCourseChapter: (id: number) => request(`/course-chapters/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteCourseChapter: (id: number) => request(`/course-chapters/${id}/permanent`, { method: 'DELETE' }),

  // Course Chapter Topics (junction: chapter → topic)
  listCourseChapterTopics: (qs = '') => request(`/course-chapter-topics${qs}`, { auth: false }),
  getCourseChapterTopic: (id: number) => request(`/course-chapter-topics/${id}`, { auth: false }),
  createCourseChapterTopic: (data: any) => request('/course-chapter-topics', { method: 'POST', body: JSON.stringify(data) }),
  updateCourseChapterTopic: (id: number, data: any) => request(`/course-chapter-topics/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCourseChapterTopic: (id: number) => request(`/course-chapter-topics/${id}`, { method: 'DELETE' }),
  restoreCourseChapterTopic: (id: number) => request(`/course-chapter-topics/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteCourseChapterTopic: (id: number) => request(`/course-chapter-topics/${id}/permanent`, { method: 'DELETE' }),

  // Bundles
  listBundles: (qs = '') => request(`/bundles${qs}`, { auth: false }),
  getBundle: (id: number) => request(`/bundles/${id}`, { auth: false }),
  createBundle: (data: any) => request('/bundles', { method: 'POST', body: JSON.stringify(data) }),
  updateBundle: (id: number, data: any) => request(`/bundles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBundle: (id: number) => request(`/bundles/${id}`, { method: 'DELETE' }),
  restoreBundle: (id: number) => request(`/bundles/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteBundle: (id: number) => request(`/bundles/${id}/permanent`, { method: 'DELETE' }),

  // Bundle Translations
  listBundleTranslations: (qs = '') => request(`/bundle-translations${qs}`, { auth: false }),
  getBundleTranslation: (id: number) => request(`/bundle-translations/${id}`, { auth: false }),
  createBundleTranslation: (data: any, isFormData = false) => request('/bundle-translations', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateBundleTranslation: (id: number, data: any, isFormData = false) => request(`/bundle-translations/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteBundleTranslation: (id: number) => request(`/bundle-translations/${id}`, { method: 'DELETE' }),
  restoreBundleTranslation: (id: number) => request(`/bundle-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteBundleTranslation: (id: number) => request(`/bundle-translations/${id}/permanent`, { method: 'DELETE' }),
  getBundleTranslationCoverage: () => request('/bundle-translations/coverage', { auth: false }),

  // Bundle Courses
  listBundleCourses: (qs = '') => request(`/bundle-courses${qs}`, { auth: false }),
  getBundleCourse: (id: number) => request(`/bundle-courses/${id}`, { auth: false }),
  createBundleCourse: (data: any) => request('/bundle-courses', { method: 'POST', body: JSON.stringify(data) }),
  updateBundleCourse: (id: number, data: any) => request(`/bundle-courses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBundleCourse: (id: number) => request(`/bundle-courses/${id}`, { method: 'DELETE' }),
  restoreBundleCourse: (id: number) => request(`/bundle-courses/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteBundleCourse: (id: number) => request(`/bundle-courses/${id}/permanent`, { method: 'DELETE' }),

  // Course Batches
  listCourseBatches: (qs = '') => request(`/course-batches${qs}`, { auth: false }),
  getCourseBatch: (id: number) => request(`/course-batches/${id}`, { auth: false }),
  createCourseBatch: (data: any) => request('/course-batches', { method: 'POST', body: JSON.stringify(data) }),
  updateCourseBatch: (id: number, data: any) => request(`/course-batches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCourseBatch: (id: number) => request(`/course-batches/${id}`, { method: 'DELETE' }),
  restoreCourseBatch: (id: number) => request(`/course-batches/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteCourseBatch: (id: number) => request(`/course-batches/${id}/permanent`, { method: 'DELETE' }),

  // Batch Translations
  listBatchTranslations: (qs = '') => request(`/batch-translations${qs}`, { auth: false }),
  getBatchTranslation: (id: number) => request(`/batch-translations/${id}`, { auth: false }),
  createBatchTranslation: (data: any, isFormData = false) => request('/batch-translations', { method: 'POST', body: isFormData ? data : JSON.stringify(data), isFormData }),
  updateBatchTranslation: (id: number, data: any, isFormData = false) => request(`/batch-translations/${id}`, { method: 'PATCH', body: isFormData ? data : JSON.stringify(data), isFormData }),
  deleteBatchTranslation: (id: number) => request(`/batch-translations/${id}`, { method: 'DELETE' }),
  restoreBatchTranslation: (id: number) => request(`/batch-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteBatchTranslation: (id: number) => request(`/batch-translations/${id}/permanent`, { method: 'DELETE' }),
  getBatchTranslationCoverage: (qs = '') => request(`/batch-translations/coverage${qs}`, { auth: false }),

  // MCQ Questions
  listMcqQuestions: (qs = '') => request(`/mcq-questions${qs}`, { auth: false }),
  getMcqQuestion: (id: number) => request(`/mcq-questions/${id}`, { auth: false }),
  getMcqQuestionFull: (id: number) => request(`/mcq-questions/${id}/full`, { auth: false }),
  createMcqQuestion: (data: any) => request('/mcq-questions', { method: 'POST', body: JSON.stringify(data) }),
  createFullMcqQuestion: (data: any) => request('/mcq-questions/create-full', { method: 'POST', body: JSON.stringify(data) }),
  updateFullMcqQuestion: (id: number, data: any) => request(`/mcq-questions/${id}/update-full`, { method: 'PUT', body: JSON.stringify(data) }),
  updateMcqQuestion: (id: number, data: any) => request(`/mcq-questions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMcqQuestion: (id: number) => request(`/mcq-questions/${id}`, { method: 'DELETE' }),
  restoreMcqQuestion: (id: number) => request(`/mcq-questions/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteMcqQuestion: (id: number) => request(`/mcq-questions/${id}/permanent`, { method: 'DELETE' }),

  // MCQ Question Translations
  listMcqQuestionTranslations: (qs = '') => request(`/mcq-question-translations${qs}`, { auth: false }),
  getMcqQuestionTranslation: (id: number) => request(`/mcq-question-translations/${id}`, { auth: false }),
  createMcqQuestionTranslation: (data: any, isFormData = false) => request('/mcq-question-translations', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateMcqQuestionTranslation: (id: number, data: any, isFormData = false) => request(`/mcq-question-translations/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteMcqQuestionTranslation: (id: number) => request(`/mcq-question-translations/${id}`, { method: 'DELETE' }),
  restoreMcqQuestionTranslation: (id: number) => request(`/mcq-question-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteMcqQuestionTranslation: (id: number) => request(`/mcq-question-translations/${id}/permanent`, { method: 'DELETE' }),
  getMcqQuestionTranslationCoverage: () => request('/mcq-question-translations/coverage', { auth: false }),

  // MCQ Options
  listMcqOptions: (qs = '') => request(`/mcq-options${qs}`, { auth: false }),
  getMcqOption: (id: number) => request(`/mcq-options/${id}`, { auth: false }),
  createMcqOption: (data: any) => request('/mcq-options', { method: 'POST', body: JSON.stringify(data) }),
  updateMcqOption: (id: number, data: any) => request(`/mcq-options/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMcqOption: (id: number) => request(`/mcq-options/${id}`, { method: 'DELETE' }),
  restoreMcqOption: (id: number) => request(`/mcq-options/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteMcqOption: (id: number) => request(`/mcq-options/${id}/permanent`, { method: 'DELETE' }),

  // MCQ Option Translations
  listMcqOptionTranslations: (qs = '') => request(`/mcq-option-translations${qs}`, { auth: false }),
  getMcqOptionTranslation: (id: number) => request(`/mcq-option-translations/${id}`, { auth: false }),
  createMcqOptionTranslation: (data: any, isFormData = false) => request('/mcq-option-translations', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateMcqOptionTranslation: (id: number, data: any, isFormData = false) => request(`/mcq-option-translations/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteMcqOptionTranslation: (id: number) => request(`/mcq-option-translations/${id}`, { method: 'DELETE' }),
  restoreMcqOptionTranslation: (id: number) => request(`/mcq-option-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteMcqOptionTranslation: (id: number) => request(`/mcq-option-translations/${id}/permanent`, { method: 'DELETE' }),
  getMcqOptionTranslationCoverage: () => request('/mcq-option-translations/coverage', { auth: false }),

  // AI — Auto MCQ Generation
  autoGenerateMcq: (data: { topic_id: number; sub_topic_id?: number; num_questions?: number; difficulty_mix?: string; mcq_types?: string[]; provider?: string; auto_translate?: boolean }, signal?: AbortSignal) =>
    request('/ai/auto-generate-mcq', { method: 'POST', body: JSON.stringify(data), signal }),
  autoTranslateMcq: (data: { topic_id?: number; question_ids?: number[]; provider?: string }) =>
    request('/ai/auto-translate-mcq', { method: 'POST', body: JSON.stringify(data) }),

  // One Word Questions
  listOwQuestions: (qs = '') => request(`/ow-questions${qs}`, { auth: false }),
  getOwQuestion: (id: number) => request(`/ow-questions/${id}`, { auth: false }),
  getOwQuestionFull: (id: number) => request(`/ow-questions/${id}/full`, { auth: false }),
  createFullOwQuestion: (data: any) => request('/ow-questions/create-full', { method: 'POST', body: JSON.stringify(data) }),
  updateFullOwQuestion: (id: number, data: any) => request(`/ow-questions/${id}/update-full`, { method: 'PUT', body: JSON.stringify(data) }),
  createOwQuestion: (data: any) => request('/ow-questions', { method: 'POST', body: JSON.stringify(data) }),
  updateOwQuestion: (id: number, data: any) => request(`/ow-questions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOwQuestion: (id: number) => request(`/ow-questions/${id}`, { method: 'DELETE' }),
  restoreOwQuestion: (id: number) => request(`/ow-questions/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteOwQuestion: (id: number) => request(`/ow-questions/${id}/permanent`, { method: 'DELETE' }),

  // One Word Question Translations
  listOwQuestionTranslations: (qs = '') => request(`/ow-question-translations${qs}`, { auth: false }),
  getOwQuestionTranslation: (id: number) => request(`/ow-question-translations/${id}`, { auth: false }),
  createOwQuestionTranslation: (data: any, isFormData = false) => request('/ow-question-translations', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateOwQuestionTranslation: (id: number, data: any, isFormData = false) => request(`/ow-question-translations/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteOwQuestionTranslation: (id: number) => request(`/ow-question-translations/${id}`, { method: 'DELETE' }),
  restoreOwQuestionTranslation: (id: number) => request(`/ow-question-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteOwQuestionTranslation: (id: number) => request(`/ow-question-translations/${id}/permanent`, { method: 'DELETE' }),
  getOwQuestionTranslationCoverage: () => request('/ow-question-translations/coverage', { auth: false }),

  // One Word Synonyms
  listOwSynonyms: (qs = '') => request(`/ow-synonyms${qs}`, { auth: false }),
  getOwSynonym: (id: number) => request(`/ow-synonyms/${id}`, { auth: false }),
  createOwSynonym: (data: any) => request('/ow-synonyms', { method: 'POST', body: JSON.stringify(data) }),
  updateOwSynonym: (id: number, data: any) => request(`/ow-synonyms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOwSynonym: (id: number) => request(`/ow-synonyms/${id}`, { method: 'DELETE' }),
  restoreOwSynonym: (id: number) => request(`/ow-synonyms/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteOwSynonym: (id: number) => request(`/ow-synonyms/${id}/permanent`, { method: 'DELETE' }),

  // One Word Synonym Translations
  listOwSynonymTranslations: (qs = '') => request(`/ow-synonym-translations${qs}`, { auth: false }),
  getOwSynonymTranslation: (id: number) => request(`/ow-synonym-translations/${id}`, { auth: false }),
  createOwSynonymTranslation: (data: any) => request('/ow-synonym-translations', { method: 'POST', body: JSON.stringify(data) }),
  updateOwSynonymTranslation: (id: number, data: any) => request(`/ow-synonym-translations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOwSynonymTranslation: (id: number) => request(`/ow-synonym-translations/${id}`, { method: 'DELETE' }),
  restoreOwSynonymTranslation: (id: number) => request(`/ow-synonym-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteOwSynonymTranslation: (id: number) => request(`/ow-synonym-translations/${id}/permanent`, { method: 'DELETE' }),
  getOwSynonymTranslationCoverage: () => request('/ow-synonym-translations/coverage', { auth: false }),

  // AI — Auto One Word Generation
  autoGenerateOw: (data: { topic_id: number; sub_topic_id?: number; num_questions?: number; difficulty_mix?: string; question_types?: string[]; provider?: string; auto_translate?: boolean }, signal?: AbortSignal) =>
    request('/ai/auto-generate-ow', { method: 'POST', body: JSON.stringify(data), signal }),
  autoTranslateOw: (data: { topic_id?: number; question_ids?: number[]; provider?: string }) =>
    request('/ai/auto-translate-ow', { method: 'POST', body: JSON.stringify(data) }),

  // Descriptive Questions
  listDescQuestions: (qs = '') => request(`/desc-questions${qs}`, { auth: false }),
  getDescQuestion: (id: number) => request(`/desc-questions/${id}`, { auth: false }),
  getDescQuestionFull: (id: number) => request(`/desc-questions/${id}/full`, { auth: false }),
  createFullDescQuestion: (data: any) => request('/desc-questions/create-full', { method: 'POST', body: JSON.stringify(data) }),
  updateFullDescQuestion: (id: number, data: any) => request(`/desc-questions/${id}/update-full`, { method: 'PUT', body: JSON.stringify(data) }),
  createDescQuestion: (data: any) => request('/desc-questions', { method: 'POST', body: JSON.stringify(data) }),
  updateDescQuestion: (id: number, data: any) => request(`/desc-questions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDescQuestion: (id: number) => request(`/desc-questions/${id}`, { method: 'DELETE' }),
  restoreDescQuestion: (id: number) => request(`/desc-questions/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteDescQuestion: (id: number) => request(`/desc-questions/${id}/permanent`, { method: 'DELETE' }),

  // Descriptive Question Translations
  listDescQuestionTranslations: (qs = '') => request(`/desc-question-translations${qs}`, { auth: false }),
  getDescQuestionTranslation: (id: number) => request(`/desc-question-translations/${id}`, { auth: false }),
  createDescQuestionTranslation: (data: any, isFormData = false) => request('/desc-question-translations', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateDescQuestionTranslation: (id: number, data: any, isFormData = false) => request(`/desc-question-translations/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteDescQuestionTranslation: (id: number) => request(`/desc-question-translations/${id}`, { method: 'DELETE' }),
  restoreDescQuestionTranslation: (id: number) => request(`/desc-question-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteDescQuestionTranslation: (id: number) => request(`/desc-question-translations/${id}/permanent`, { method: 'DELETE' }),
  getDescQuestionTranslationCoverage: () => request('/desc-question-translations/coverage', { auth: false }),

  // AI — Auto Descriptive Generation
  autoGenerateDesc: (data: { topic_id: number; sub_topic_id?: number; num_questions?: number; difficulty_mix?: string; answer_types?: string[]; provider?: string; auto_translate?: boolean }, signal?: AbortSignal) =>
    request('/ai/auto-generate-desc', { method: 'POST', body: JSON.stringify(data), signal }),
  autoTranslateDesc: (data: { topic_id?: number; question_ids?: number[]; provider?: string }) =>
    request('/ai/auto-translate-desc', { method: 'POST', body: JSON.stringify(data) }),

  // Matching Questions
  listMatchingQuestions: (qs = '') => request(`/matching-questions${qs}`, { auth: false }),
  getMatchingQuestion: (id: number) => request(`/matching-questions/${id}`, { auth: false }),
  getMatchingQuestionFull: (id: number) => request(`/matching-questions/${id}/full`, { auth: false }),
  createFullMatchingQuestion: (data: any) => request('/matching-questions/create-full', { method: 'POST', body: JSON.stringify(data) }),
  updateFullMatchingQuestion: (id: number, data: any) => request(`/matching-questions/${id}/update-full`, { method: 'PUT', body: JSON.stringify(data) }),
  createMatchingQuestion: (data: any) => request('/matching-questions', { method: 'POST', body: JSON.stringify(data) }),
  updateMatchingQuestion: (id: number, data: any) => request(`/matching-questions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMatchingQuestion: (id: number) => request(`/matching-questions/${id}`, { method: 'DELETE' }),
  restoreMatchingQuestion: (id: number) => request(`/matching-questions/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteMatchingQuestion: (id: number) => request(`/matching-questions/${id}/permanent`, { method: 'DELETE' }),

  // Matching Question Translations
  listMatchingQuestionTranslations: (qs = '') => request(`/matching-question-translations${qs}`, { auth: false }),
  getMatchingQuestionTranslation: (id: number) => request(`/matching-question-translations/${id}`, { auth: false }),
  createMatchingQuestionTranslation: (data: any) => request('/matching-question-translations', { method: 'POST', body: JSON.stringify(data) }),
  updateMatchingQuestionTranslation: (id: number, data: any) => request(`/matching-question-translations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMatchingQuestionTranslation: (id: number) => request(`/matching-question-translations/${id}`, { method: 'DELETE' }),
  restoreMatchingQuestionTranslation: (id: number) => request(`/matching-question-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteMatchingQuestionTranslation: (id: number) => request(`/matching-question-translations/${id}/permanent`, { method: 'DELETE' }),
  getMatchingQuestionTranslationCoverage: () => request('/matching-question-translations/coverage', { auth: false }),

  // Matching Pairs
  listMatchingPairs: (qs = '') => request(`/matching-pairs${qs}`, { auth: false }),
  getMatchingPair: (id: number) => request(`/matching-pairs/${id}`, { auth: false }),
  createMatchingPair: (data: any) => request('/matching-pairs', { method: 'POST', body: JSON.stringify(data) }),
  updateMatchingPair: (id: number, data: any) => request(`/matching-pairs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMatchingPair: (id: number) => request(`/matching-pairs/${id}`, { method: 'DELETE' }),
  restoreMatchingPair: (id: number) => request(`/matching-pairs/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteMatchingPair: (id: number) => request(`/matching-pairs/${id}/permanent`, { method: 'DELETE' }),

  // Matching Pair Translations
  listMatchingPairTranslations: (qs = '') => request(`/matching-pair-translations${qs}`, { auth: false }),
  getMatchingPairTranslation: (id: number) => request(`/matching-pair-translations/${id}`, { auth: false }),
  createMatchingPairTranslation: (data: any) => request('/matching-pair-translations', { method: 'POST', body: JSON.stringify(data) }),
  updateMatchingPairTranslation: (id: number, data: any) => request(`/matching-pair-translations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMatchingPairTranslation: (id: number) => request(`/matching-pair-translations/${id}`, { method: 'DELETE' }),
  restoreMatchingPairTranslation: (id: number) => request(`/matching-pair-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteMatchingPairTranslation: (id: number) => request(`/matching-pair-translations/${id}/permanent`, { method: 'DELETE' }),
  getMatchingPairTranslationCoverage: () => request('/matching-pair-translations/coverage', { auth: false }),

  // AI — Auto Matching Generation
  autoGenerateMatching: (data: { topic_id: number; sub_topic_id?: number; num_questions?: number; difficulty_mix?: string; provider?: string; auto_translate?: boolean }, signal?: AbortSignal) =>
    request('/ai/auto-generate-matching', { method: 'POST', body: JSON.stringify(data), signal }),
  autoTranslateMatching: (data: { topic_id?: number; question_ids?: number[]; provider?: string }) =>
    request('/ai/auto-translate-matching', { method: 'POST', body: JSON.stringify(data) }),

  // Ordering Questions
  listOrderingQuestions: (qs = '') => request(`/ordering-questions${qs}`, { auth: false }),
  getOrderingQuestion: (id: number) => request(`/ordering-questions/${id}`, { auth: false }),
  getOrderingQuestionFull: (id: number) => request(`/ordering-questions/${id}/full`, { auth: false }),
  createFullOrderingQuestion: (data: any) => request('/ordering-questions/create-full', { method: 'POST', body: JSON.stringify(data) }),
  updateFullOrderingQuestion: (id: number, data: any) => request(`/ordering-questions/${id}/update-full`, { method: 'PUT', body: JSON.stringify(data) }),
  createOrderingQuestion: (data: any) => request('/ordering-questions', { method: 'POST', body: JSON.stringify(data) }),
  updateOrderingQuestion: (id: number, data: any) => request(`/ordering-questions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOrderingQuestion: (id: number) => request(`/ordering-questions/${id}`, { method: 'DELETE' }),
  restoreOrderingQuestion: (id: number) => request(`/ordering-questions/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteOrderingQuestion: (id: number) => request(`/ordering-questions/${id}/permanent`, { method: 'DELETE' }),

  // Ordering Question Translations
  listOrderingQuestionTranslations: (qs = '') => request(`/ordering-question-translations${qs}`, { auth: false }),
  getOrderingQuestionTranslation: (id: number) => request(`/ordering-question-translations/${id}`, { auth: false }),
  createOrderingQuestionTranslation: (data: any) => request('/ordering-question-translations', { method: 'POST', body: JSON.stringify(data) }),
  updateOrderingQuestionTranslation: (id: number, data: any) => request(`/ordering-question-translations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOrderingQuestionTranslation: (id: number) => request(`/ordering-question-translations/${id}`, { method: 'DELETE' }),
  restoreOrderingQuestionTranslation: (id: number) => request(`/ordering-question-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteOrderingQuestionTranslation: (id: number) => request(`/ordering-question-translations/${id}/permanent`, { method: 'DELETE' }),
  getOrderingQuestionTranslationCoverage: () => request('/ordering-question-translations/coverage', { auth: false }),

  // Ordering Items
  listOrderingItems: (qs = '') => request(`/ordering-items${qs}`, { auth: false }),
  getOrderingItem: (id: number) => request(`/ordering-items/${id}`, { auth: false }),
  createOrderingItem: (data: any) => request('/ordering-items', { method: 'POST', body: JSON.stringify(data) }),
  updateOrderingItem: (id: number, data: any) => request(`/ordering-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOrderingItem: (id: number) => request(`/ordering-items/${id}`, { method: 'DELETE' }),
  restoreOrderingItem: (id: number) => request(`/ordering-items/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteOrderingItem: (id: number) => request(`/ordering-items/${id}/permanent`, { method: 'DELETE' }),

  // Ordering Item Translations
  listOrderingItemTranslations: (qs = '') => request(`/ordering-item-translations${qs}`, { auth: false }),
  getOrderingItemTranslation: (id: number) => request(`/ordering-item-translations/${id}`, { auth: false }),
  createOrderingItemTranslation: (data: any) => request('/ordering-item-translations', { method: 'POST', body: JSON.stringify(data) }),
  updateOrderingItemTranslation: (id: number, data: any) => request(`/ordering-item-translations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOrderingItemTranslation: (id: number) => request(`/ordering-item-translations/${id}`, { method: 'DELETE' }),
  restoreOrderingItemTranslation: (id: number) => request(`/ordering-item-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteOrderingItemTranslation: (id: number) => request(`/ordering-item-translations/${id}/permanent`, { method: 'DELETE' }),
  getOrderingItemTranslationCoverage: () => request('/ordering-item-translations/coverage', { auth: false }),

  // AI — Auto Ordering Generation
  autoGenerateOrdering: (data: { topic_id: number; sub_topic_id?: number; num_questions?: number; difficulty_mix?: string; provider?: string; auto_translate?: boolean }, signal?: AbortSignal) =>
    request('/ai/auto-generate-ordering', { method: 'POST', body: JSON.stringify(data), signal }),
  autoTranslateOrdering: (data: { topic_id?: number; question_ids?: number[]; provider?: string }) =>
    request('/ai/auto-translate-ordering', { method: 'POST', body: JSON.stringify(data) }),

  // AI — Assessment translations (HTML file-based)
  autoTranslateExercise: (data: { exercise_id?: number; exercise_ids?: number[]; provider?: string; force?: boolean }) =>
    request('/ai/auto-translate-exercise', { method: 'POST', body: JSON.stringify(data) }),
  autoTranslateMiniProject: (data: { mini_project_id?: number; mini_project_ids?: number[]; provider?: string }) =>
    request('/ai/auto-translate-mini-project', { method: 'POST', body: JSON.stringify(data) }),
  autoTranslateCapstone: (data: { capstone_project_id?: number; capstone_project_ids?: number[]; provider?: string }) =>
    request('/ai/auto-translate-capstone', { method: 'POST', body: JSON.stringify(data) }),

  // Branches
  listBranches: (qs = '') => request(`/branches${qs}`, { auth: false }),
  getBranch: (id: number) => request(`/branches/${id}`, { auth: false }),
  createBranch: (data: any) => request('/branches', { method: 'POST', body: JSON.stringify(data) }),
  updateBranch: (id: number, data: any) => request(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBranch: (id: number) => request(`/branches/${id}`, { method: 'DELETE' }),
  restoreBranch: (id: number) => request(`/branches/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteBranch: (id: number) => request(`/branches/${id}/permanent`, { method: 'DELETE' }),

  // Departments
  listDepartments: (qs = '') => request(`/departments${qs}`, { auth: false }),
  getDepartment: (id: number) => request(`/departments/${id}`, { auth: false }),
  createDepartment: (data: any) => request('/departments', { method: 'POST', body: JSON.stringify(data) }),
  updateDepartment: (id: number, data: any) => request(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDepartment: (id: number) => request(`/departments/${id}`, { method: 'DELETE' }),
  restoreDepartment: (id: number) => request(`/departments/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteDepartment: (id: number) => request(`/departments/${id}/permanent`, { method: 'DELETE' }),

  // Branch Departments
  listBranchDepartments: (qs = '') => request(`/branch-departments${qs}`, { auth: false }),
  getBranchDepartment: (id: number) => request(`/branch-departments/${id}`, { auth: false }),
  createBranchDepartment: (data: any) => request('/branch-departments', { method: 'POST', body: JSON.stringify(data) }),
  updateBranchDepartment: (id: number, data: any) => request(`/branch-departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBranchDepartment: (id: number) => request(`/branch-departments/${id}`, { method: 'DELETE' }),
  restoreBranchDepartment: (id: number) => request(`/branch-departments/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteBranchDepartment: (id: number) => request(`/branch-departments/${id}/permanent`, { method: 'DELETE' }),

  // Phase 13 — employee_profiles + student_profiles tables dropped; their
  // API helpers used to live here.

  // Instructor Profiles
  listInstructorProfiles: (qs = '') => request(`/instructor-profiles${qs}`),
  getInstructorProfile: (id: number) => request(`/instructor-profiles/${id}`),
  getInstructorProfileByUserId: (userId: number) => request(`/instructor-profiles/user/${userId}`),
  upsertInstructorProfile: (userId: number, data: any) => request(`/instructor-profiles/user/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  createInstructorProfile: (data: any) => request('/instructor-profiles', { method: 'POST', body: JSON.stringify(data) }),
  updateInstructorProfile: (id: number, data: any) => request(`/instructor-profiles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteInstructorProfile: (id: number) => request(`/instructor-profiles/${id}`, { method: 'DELETE' }),
  restoreInstructorProfile: (id: number) => request(`/instructor-profiles/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteInstructorProfile: (id: number) => request(`/instructor-profiles/${id}/permanent`, { method: 'DELETE' }),

  // User Profiles
  listUserProfiles: (qs = '') => request(`/user-profiles${qs}`),
  getUserProfile: (userId: number) => request(`/user-profiles/user/${userId}`),
  upsertUserProfile: (userId: number, data: any, isFormData = false) => request(`/user-profiles/user/${userId}`, { method: 'PUT', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteUserProfile: (userId: number) => request(`/user-profiles/user/${userId}`, { method: 'DELETE' }),
  restoreUserProfile: (userId: number) => request(`/user-profiles/user/${userId}/restore`, { method: 'PATCH' }),
  permanentDeleteUserProfile: (userId: number) => request(`/user-profiles/user/${userId}/permanent`, { method: 'DELETE' }),
  getMyProfile: () => request('/user-profiles/me'),
  updateMyProfile: (data: any, isFormData = false) => request('/user-profiles/me', { method: 'PUT', body: isFormData ? data as any : JSON.stringify(data), isFormData }),

  // User Education (admin)
  listUserEducation: (qs = '') => request(`/user-education${qs}`),
  getUserEducation: (id: number) => request(`/user-education/${id}`),
  createUserEducation: (data: any, isFormData = false) => request('/user-education', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateUserEducation: (id: number, data: any, isFormData = false) => request(`/user-education/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteUserEducation: (id: number) => request(`/user-education/${id}`, { method: 'DELETE' }),
  restoreUserEducation: (id: number) => request(`/user-education/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteUserEducation: (id: number) => request(`/user-education/${id}/permanent`, { method: 'DELETE' }),

  // User Education (self-service)
  listMyEducation: (qs = '') => request(`/user-education/me${qs}`),
  getMyEducation: (id: number) => request(`/user-education/me/${id}`),
  createMyEducation: (data: any, isFormData = false) => request('/user-education/me', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateMyEducation: (id: number, data: any, isFormData = false) => request(`/user-education/me/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteMyEducation: (id: number) => request(`/user-education/me/${id}`, { method: 'DELETE' }),
  restoreMyEducation: (id: number) => request(`/user-education/me/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteMyEducation: (id: number) => request(`/user-education/me/${id}/permanent`, { method: 'DELETE' }),

  // User Experience (admin)
  listUserExperience: (qs = '') => request(`/user-experience${qs}`),
  getUserExperience: (id: number) => request(`/user-experience/${id}`),
  createUserExperience: (data: any) => request('/user-experience', { method: 'POST', body: JSON.stringify(data) }),
  updateUserExperience: (id: number, data: any) => request(`/user-experience/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUserExperience: (id: number) => request(`/user-experience/${id}`, { method: 'DELETE' }),
  restoreUserExperience: (id: number) => request(`/user-experience/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteUserExperience: (id: number) => request(`/user-experience/${id}/permanent`, { method: 'DELETE' }),
  // User Experience (self-service)
  listMyExperience: (qs = '') => request(`/user-experience/me${qs}`),
  getMyExperience: (id: number) => request(`/user-experience/me/${id}`),
  createMyExperience: (data: any) => request('/user-experience/me', { method: 'POST', body: JSON.stringify(data) }),
  updateMyExperience: (id: number, data: any) => request(`/user-experience/me/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMyExperience: (id: number) => request(`/user-experience/me/${id}`, { method: 'DELETE' }),
  restoreMyExperience: (id: number) => request(`/user-experience/me/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteMyExperience: (id: number) => request(`/user-experience/me/${id}/permanent`, { method: 'DELETE' }),

  // User Social Media (admin)
  listUserSocialMedia: (qs = '') => request(`/user-social-medias${qs}`),
  getUserSocialMedia: (id: number) => request(`/user-social-medias/${id}`),
  createUserSocialMedia: (data: any) => request('/user-social-medias', { method: 'POST', body: JSON.stringify(data) }),
  updateUserSocialMedia: (id: number, data: any) => request(`/user-social-medias/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUserSocialMedia: (id: number) => request(`/user-social-medias/${id}`, { method: 'DELETE' }),
  restoreUserSocialMedia: (id: number) => request(`/user-social-medias/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteUserSocialMedia: (id: number) => request(`/user-social-medias/${id}/permanent`, { method: 'DELETE' }),
  // User Social Media (self-service)
  listMySocialMedia: (qs = '') => request(`/user-social-medias/me${qs}`),
  getMySocialMedia: (id: number) => request(`/user-social-medias/me/${id}`),
  createMySocialMedia: (data: any) => request('/user-social-medias/me', { method: 'POST', body: JSON.stringify(data) }),
  updateMySocialMedia: (id: number, data: any) => request(`/user-social-medias/me/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMySocialMedia: (id: number) => request(`/user-social-medias/me/${id}`, { method: 'DELETE' }),
  restoreMySocialMedia: (id: number) => request(`/user-social-medias/me/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteMySocialMedia: (id: number) => request(`/user-social-medias/me/${id}/permanent`, { method: 'DELETE' }),

  // User Skills (admin)
  listUserSkills: (qs = '') => request(`/user-skills${qs}`),
  getUserSkill: (id: number) => request(`/user-skills/${id}`),
  createUserSkill: (data: any) => request('/user-skills', { method: 'POST', body: JSON.stringify(data) }),
  updateUserSkill: (id: number, data: any) => request(`/user-skills/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUserSkill: (id: number) => request(`/user-skills/${id}`, { method: 'DELETE' }),
  restoreUserSkill: (id: number) => request(`/user-skills/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteUserSkill: (id: number) => request(`/user-skills/${id}/permanent`, { method: 'DELETE' }),
  // User Skills (self-service)
  listMySkills: (qs = '') => request(`/user-skills/me${qs}`),
  getMySkill: (id: number) => request(`/user-skills/me/${id}`),
  createMySkill: (data: any) => request('/user-skills/me', { method: 'POST', body: JSON.stringify(data) }),
  updateMySkill: (id: number, data: any) => request(`/user-skills/me/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMySkill: (id: number) => request(`/user-skills/me/${id}`, { method: 'DELETE' }),
  restoreMySkill: (id: number) => request(`/user-skills/me/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteMySkill: (id: number) => request(`/user-skills/me/${id}/permanent`, { method: 'DELETE' }),

  // User Languages (admin)
  listUserLanguages: (qs = '') => request(`/user-languages${qs}`),
  getUserLanguage: (id: number) => request(`/user-languages/${id}`),
  createUserLanguage: (data: any) => request('/user-languages', { method: 'POST', body: JSON.stringify(data) }),
  updateUserLanguage: (id: number, data: any) => request(`/user-languages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUserLanguage: (id: number) => request(`/user-languages/${id}`, { method: 'DELETE' }),
  restoreUserLanguage: (id: number) => request(`/user-languages/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteUserLanguage: (id: number) => request(`/user-languages/${id}/permanent`, { method: 'DELETE' }),
  // User Languages (self-service)
  listMyLanguages: (qs = '') => request(`/user-languages/me${qs}`),
  getMyLanguage: (id: number) => request(`/user-languages/me/${id}`),
  createMyLanguage: (data: any) => request('/user-languages/me', { method: 'POST', body: JSON.stringify(data) }),
  updateMyLanguage: (id: number, data: any) => request(`/user-languages/me/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMyLanguage: (id: number) => request(`/user-languages/me/${id}`, { method: 'DELETE' }),
  restoreMyLanguage: (id: number) => request(`/user-languages/me/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteMyLanguage: (id: number) => request(`/user-languages/me/${id}/permanent`, { method: 'DELETE' }),

  // User Documents (admin)
  listUserDocuments: (qs = '') => request(`/user-documents${qs}`),
  getUserDocument: (id: number) => request(`/user-documents/${id}`),
  createUserDocument: (data: any, isFormData = false) => request('/user-documents', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateUserDocument: (id: number, data: any, isFormData = false) => request(`/user-documents/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteUserDocument: (id: number) => request(`/user-documents/${id}`, { method: 'DELETE' }),
  restoreUserDocument: (id: number) => request(`/user-documents/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteUserDocument: (id: number) => request(`/user-documents/${id}/permanent`, { method: 'DELETE' }),
  // User Documents (self-service)
  listMyDocuments: (qs = '') => request(`/user-documents/me${qs}`),
  getMyDocument: (id: number) => request(`/user-documents/me/${id}`),
  createMyDocument: (data: any, isFormData = false) => request('/user-documents/me', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateMyDocument: (id: number, data: any, isFormData = false) => request(`/user-documents/me/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  deleteMyDocument: (id: number) => request(`/user-documents/me/${id}`, { method: 'DELETE' }),
  restoreMyDocument: (id: number) => request(`/user-documents/me/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteMyDocument: (id: number) => request(`/user-documents/me/${id}/permanent`, { method: 'DELETE' }),

  // User Projects (admin)
  listUserProjects: (qs = '') => request(`/user-projects${qs}`),
  getUserProject: (id: number) => request(`/user-projects/${id}`),
  createUserProject: (data: any) => request('/user-projects', { method: 'POST', body: JSON.stringify(data) }),
  updateUserProject: (id: number, data: any) => request(`/user-projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUserProject: (id: number) => request(`/user-projects/${id}`, { method: 'DELETE' }),
  restoreUserProject: (id: number) => request(`/user-projects/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteUserProject: (id: number) => request(`/user-projects/${id}/permanent`, { method: 'DELETE' }),
  // User Projects (self-service)
  listMyProjects: (qs = '') => request(`/user-projects/me${qs}`),
  getMyProject: (id: number) => request(`/user-projects/me/${id}`),
  createMyProject: (data: any) => request('/user-projects/me', { method: 'POST', body: JSON.stringify(data) }),
  updateMyProject: (id: number, data: any) => request(`/user-projects/me/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMyProject: (id: number) => request(`/user-projects/me/${id}`, { method: 'DELETE' }),
  restoreMyProject: (id: number) => request(`/user-projects/me/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteMyProject: (id: number) => request(`/user-projects/me/${id}/permanent`, { method: 'DELETE' }),

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

  // Table Summary
  getTableSummary: (tableName: string) => request(`/table-summary?table_name=${tableName}`, { auth: false }),
  listTableSummaries: () => request('/table-summary', { auth: false }),
  syncTableSummary: (tableName: string) => request(`/table-summary/sync/${tableName}`, { method: 'POST' }),
  syncAllTableSummaries: () => request('/table-summary/sync', { method: 'POST' }),

  // Material Tree (Bunny CDN)
  getMaterialTree: (path?: string) => request(`/material-tree${path ? `?path=${encodeURIComponent(path)}` : ''}`),
  getFullMaterialTree: () => request('/material-tree/full'),
  deleteMaterialFolder: (path: string) => request('/material-tree/folder', { method: 'DELETE', body: JSON.stringify({ path }) }),
  fixOrphanedSubtopicFolders: (dryRun = true) => request(`/material-tree/fix-orphaned-subtopic-folders?dry_run=${dryRun}`, { method: 'POST' }),
  reconcileFolderNames: (dryRun = true) => request(`/material-tree/reconcile-folder-names?dry_run=${dryRun}`, { method: 'POST' }),
  cleanOrphanedCollections: (dryRun = true) => request(`/material-tree/clean-orphaned-collections?dry_run=${dryRun}`, { method: 'POST' }),

  // AI — Sample Data Generation
  generateSampleData: (data: { module: string; provider: string; target_user_id: number; count?: number }) =>
    request('/ai/generate-sample-data', { method: 'POST', body: JSON.stringify(data) }),

  // AI — Master Data Generation
  generateMasterData: (data: { module: string; provider: string; count?: number; prompt?: string }) =>
    request('/ai/generate-master-data', { method: 'POST', body: JSON.stringify(data) }),

  updateMasterData: (data: { module: string; provider: string; prompt: string; record_ids?: number[] }) =>
    request('/ai/update-master-data', { method: 'POST', body: JSON.stringify(data) }),

  // AI — Resume Content (headline + bio)
  generateResumeContent: (data: { provider: string; prompt: string; target_user_id: number; mode?: string }) =>
    request('/ai/generate-resume-content', { method: 'POST', body: JSON.stringify(data) }),

  // Resume (public)
  getResume: (slug: string) => request(`/resume/${slug}`, { auth: false }),

  // ── Assessment Exercises ──
  listExercises: (qs = '') => request(`/assessment-exercises${qs}`, { auth: false }),
  getExercise: (id: number) => request(`/assessment-exercises/${id}`, { auth: false }),
  createExercise: (data: any) => request('/assessment-exercises', { method: 'POST', body: JSON.stringify(data) }),
  updateExercise: (id: number, data: any) => request(`/assessment-exercises/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteExercise: (id: number) => request(`/assessment-exercises/${id}`, { method: 'DELETE' }),
  restoreExercise: (id: number) => request(`/assessment-exercises/${id}/restore`, { method: 'PATCH' }),
  deleteExercise: (id: number) => request(`/assessment-exercises/${id}/permanent`, { method: 'DELETE' }),
  getExerciseFull: (id: number) => request(`/assessment-exercises/${id}/full`, { auth: false }),
  createFullExercise: (data: any, file?: File, fileSolution?: File) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
    if (file) fd.append('file', file, file.name);
    if (fileSolution) fd.append('file_solution', fileSolution, fileSolution.name);
    return formDataRequest(`/assessment-exercises/create-full`, 'POST', fd);
  },
  updateFullExercise: (id: number, data: any, file?: File, fileSolution?: File) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
    if (file) fd.append('file', file, file.name);
    if (fileSolution) fd.append('file_solution', fileSolution, fileSolution.name);
    return formDataRequest(`/assessment-exercises/${id}/update-full`, 'PUT', fd);
  },

  // ── Assessment Exercise Translations ──
  listExerciseTranslations: (qs = '') => request(`/assessment-exercise-translations${qs}`, { auth: false }),
  getExerciseTranslation: (id: number) => request(`/assessment-exercise-translations/${id}`, { auth: false }),
  getExerciseTranslationCoverage: (qs = '') => request(`/assessment-exercise-translations/coverage${qs}`, { auth: false }),
  createExerciseTranslation: (data: any, file?: File, fileSolution?: File) => {
    if (file || fileSolution) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      if (file) fd.append('file', file, file.name);
      if (fileSolution) fd.append('file_solution', fileSolution, fileSolution.name);
      return formDataRequest(`/assessment-exercise-translations`, 'POST', fd);
    }
    return request('/assessment-exercise-translations', { method: 'POST', body: JSON.stringify(data) });
  },
  updateExerciseTranslation: (id: number, data: any, file?: File, fileSolution?: File) => {
    if (file || fileSolution) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      if (file) fd.append('file', file, file.name);
      if (fileSolution) fd.append('file_solution', fileSolution, fileSolution.name);
      return formDataRequest(`/assessment-exercise-translations/${id}`, 'PATCH', fd);
    }
    return request(`/assessment-exercise-translations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  softDeleteExerciseTranslation: (id: number) => request(`/assessment-exercise-translations/${id}`, { method: 'DELETE' }),
  restoreExerciseTranslation: (id: number) => request(`/assessment-exercise-translations/${id}/restore`, { method: 'PATCH' }),
  deleteExerciseTranslation: (id: number) => request(`/assessment-exercise-translations/${id}/permanent`, { method: 'DELETE' }),

  // ── Mini Projects ──
  listMiniProjects: (qs = '') => request(`/assessment-mini-projects${qs}`, { auth: false }),
  getMiniProject: (id: number) => request(`/assessment-mini-projects/${id}`, { auth: false }),
  getMiniProjectFull: (id: number) => request(`/assessment-mini-projects/${id}/full`, { auth: false }),
  createMiniProject: (data: any) => request('/assessment-mini-projects', { method: 'POST', body: JSON.stringify(data) }),
  updateMiniProject: (id: number, data: any) => request(`/assessment-mini-projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteMiniProject: (id: number) => request(`/assessment-mini-projects/${id}`, { method: 'DELETE' }),
  restoreMiniProject: (id: number) => request(`/assessment-mini-projects/${id}/restore`, { method: 'PATCH' }),
  deleteMiniProject: (id: number) => request(`/assessment-mini-projects/${id}/permanent`, { method: 'DELETE' }),
  createFullMiniProject: (data: any, file?: File, fileSolution?: File) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
    if (file) fd.append('file', file, file.name);
    if (fileSolution) fd.append('file_solution', fileSolution, fileSolution.name);
    return formDataRequest(`/assessment-mini-projects/create-full`, 'POST', fd);
  },
  updateFullMiniProject: (id: number, data: any, file?: File, fileSolution?: File) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
    if (file) fd.append('file', file, file.name);
    if (fileSolution) fd.append('file_solution', fileSolution, fileSolution.name);
    return formDataRequest(`/assessment-mini-projects/${id}/update-full`, 'PUT', fd);
  },

  // ── Mini Project Translations ──
  listMiniProjectTranslations: (qs = '') => request(`/assessment-mini-project-translations${qs}`, { auth: false }),
  getMiniProjectTranslation: (id: number) => request(`/assessment-mini-project-translations/${id}`, { auth: false }),
  getMiniProjectTranslationCoverage: (qs = '') => request(`/assessment-mini-project-translations/coverage${qs}`, { auth: false }),
  createMiniProjectTranslation: (data: any, file?: File) => {
    if (file) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      fd.append('file', file, file.name);
      return formDataRequest(`/assessment-mini-project-translations`, 'POST', fd);
    }
    return request('/assessment-mini-project-translations', { method: 'POST', body: JSON.stringify(data) });
  },
  updateMiniProjectTranslation: (id: number, data: any, file?: File) => {
    if (file) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      fd.append('file', file, file.name);
      return formDataRequest(`/assessment-mini-project-translations/${id}`, 'PATCH', fd);
    }
    return request(`/assessment-mini-project-translations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  softDeleteMiniProjectTranslation: (id: number) => request(`/assessment-mini-project-translations/${id}`, { method: 'DELETE' }),
  restoreMiniProjectTranslation: (id: number) => request(`/assessment-mini-project-translations/${id}/restore`, { method: 'PATCH' }),
  deleteMiniProjectTranslation: (id: number) => request(`/assessment-mini-project-translations/${id}/permanent`, { method: 'DELETE' }),

  // ── Mini Project Solutions ──
  listMiniProjectSolutions: (qs = '') => request(`/assessment-mini-project-solutions${qs}`, { auth: false }),
  getMiniProjectSolution: (id: number) => request(`/assessment-mini-project-solutions/${id}`, { auth: false }),
  createMiniProjectSolution: (data: any, videoFile?: File, thumbnailFile?: File) => {
    if (videoFile || thumbnailFile) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      if (videoFile) fd.append('video_file', videoFile, videoFile.name);
      if (thumbnailFile) fd.append('thumbnail_file', thumbnailFile, thumbnailFile.name);
      return formDataRequest(`/assessment-mini-project-solutions`, 'POST', fd);
    }
    return request('/assessment-mini-project-solutions', { method: 'POST', body: JSON.stringify(data) });
  },
  updateMiniProjectSolution: (id: number, data: any, videoFile?: File, thumbnailFile?: File) => {
    if (videoFile || thumbnailFile) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      if (videoFile) fd.append('video_file', videoFile, videoFile.name);
      if (thumbnailFile) fd.append('thumbnail_file', thumbnailFile, thumbnailFile.name);
      return formDataRequest(`/assessment-mini-project-solutions/${id}`, 'PATCH', fd);
    }
    return request(`/assessment-mini-project-solutions/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  softDeleteMiniProjectSolution: (id: number) => request(`/assessment-mini-project-solutions/${id}`, { method: 'DELETE' }),
  restoreMiniProjectSolution: (id: number) => request(`/assessment-mini-project-solutions/${id}/restore`, { method: 'PATCH' }),
  deleteMiniProjectSolution: (id: number) => request(`/assessment-mini-project-solutions/${id}/permanent`, { method: 'DELETE' }),
  bulkUploadMiniProjectSolutions: (miniProjectId: number, files: File[], titles: string[], videoShortIntro?: string) => {
    const fd = new FormData();
    fd.append('mini_project_id', String(miniProjectId));
    fd.append('titles', JSON.stringify(titles));
    if (videoShortIntro) fd.append('video_short_intro', videoShortIntro);
    files.forEach(f => fd.append('video_files', f, f.name));
    return formDataRequest(`/assessment-mini-project-solutions/bulk-upload`, 'POST', fd);
  },

  // ── Capstone Projects ──
  listCapstoneProjects: (qs = '') => request(`/assessment-capstone-projects${qs}`, { auth: false }),
  getCapstoneProject: (id: number) => request(`/assessment-capstone-projects/${id}`, { auth: false }),
  getCapstoneProjectFull: (id: number) => request(`/assessment-capstone-projects/${id}/full`, { auth: false }),
  createCapstoneProject: (data: any) => request('/assessment-capstone-projects', { method: 'POST', body: JSON.stringify(data) }),
  updateCapstoneProject: (id: number, data: any) => request(`/assessment-capstone-projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteCapstoneProject: (id: number) => request(`/assessment-capstone-projects/${id}`, { method: 'DELETE' }),
  restoreCapstoneProject: (id: number) => request(`/assessment-capstone-projects/${id}/restore`, { method: 'PATCH' }),
  deleteCapstoneProject: (id: number) => request(`/assessment-capstone-projects/${id}/permanent`, { method: 'DELETE' }),
  createFullCapstoneProject: (data: any, file?: File, fileSolution?: File) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
    if (file) fd.append('file', file, file.name);
    if (fileSolution) fd.append('file_solution', fileSolution, fileSolution.name);
    return formDataRequest(`/assessment-capstone-projects/create-full`, 'POST', fd);
  },
  updateFullCapstoneProject: (id: number, data: any, file?: File, fileSolution?: File) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
    if (file) fd.append('file', file, file.name);
    if (fileSolution) fd.append('file_solution', fileSolution, fileSolution.name);
    return formDataRequest(`/assessment-capstone-projects/${id}/update-full`, 'PUT', fd);
  },

  // ── Capstone Project Translations ──
  listCapstoneProjectTranslations: (qs = '') => request(`/assessment-capstone-project-translations${qs}`, { auth: false }),
  getCapstoneProjectTranslation: (id: number) => request(`/assessment-capstone-project-translations/${id}`, { auth: false }),
  getCapstoneProjectTranslationCoverage: (qs = '') => request(`/assessment-capstone-project-translations/coverage${qs}`, { auth: false }),
  createCapstoneProjectTranslation: (data: any, file?: File) => {
    if (file) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      fd.append('file', file, file.name);
      return formDataRequest(`/assessment-capstone-project-translations`, 'POST', fd);
    }
    return request('/assessment-capstone-project-translations', { method: 'POST', body: JSON.stringify(data) });
  },
  updateCapstoneProjectTranslation: (id: number, data: any, file?: File) => {
    if (file) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      fd.append('file', file, file.name);
      return formDataRequest(`/assessment-capstone-project-translations/${id}`, 'PATCH', fd);
    }
    return request(`/assessment-capstone-project-translations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  softDeleteCapstoneProjectTranslation: (id: number) => request(`/assessment-capstone-project-translations/${id}`, { method: 'DELETE' }),
  restoreCapstoneProjectTranslation: (id: number) => request(`/assessment-capstone-project-translations/${id}/restore`, { method: 'PATCH' }),
  deleteCapstoneProjectTranslation: (id: number) => request(`/assessment-capstone-project-translations/${id}/permanent`, { method: 'DELETE' }),

  // ── Capstone Project Solutions ──
  listCapstoneProjectSolutions: (qs = '') => request(`/assessment-capstone-project-solutions${qs}`, { auth: false }),
  getCapstoneProjectSolution: (id: number) => request(`/assessment-capstone-project-solutions/${id}`, { auth: false }),
  createCapstoneProjectSolution: (data: any, videoFile?: File, thumbnailFile?: File) => {
    if (videoFile || thumbnailFile) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      if (videoFile) fd.append('video_file', videoFile, videoFile.name);
      if (thumbnailFile) fd.append('thumbnail_file', thumbnailFile, thumbnailFile.name);
      return formDataRequest(`/assessment-capstone-project-solutions`, 'POST', fd);
    }
    return request('/assessment-capstone-project-solutions', { method: 'POST', body: JSON.stringify(data) });
  },
  updateCapstoneProjectSolution: (id: number, data: any, videoFile?: File, thumbnailFile?: File) => {
    if (videoFile || thumbnailFile) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      if (videoFile) fd.append('video_file', videoFile, videoFile.name);
      if (thumbnailFile) fd.append('thumbnail_file', thumbnailFile, thumbnailFile.name);
      return formDataRequest(`/assessment-capstone-project-solutions/${id}`, 'PATCH', fd);
    }
    return request(`/assessment-capstone-project-solutions/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  softDeleteCapstoneProjectSolution: (id: number) => request(`/assessment-capstone-project-solutions/${id}`, { method: 'DELETE' }),
  restoreCapstoneProjectSolution: (id: number) => request(`/assessment-capstone-project-solutions/${id}/restore`, { method: 'PATCH' }),
  deleteCapstoneProjectSolution: (id: number) => request(`/assessment-capstone-project-solutions/${id}/permanent`, { method: 'DELETE' }),
  bulkUploadCapstoneProjectSolutions: (capstoneProjectId: number, files: File[], titles: string[], videoShortIntro?: string) => {
    const fd = new FormData();
    fd.append('capstone_project_id', String(capstoneProjectId));
    fd.append('titles', JSON.stringify(titles));
    if (videoShortIntro) fd.append('video_short_intro', videoShortIntro);
    files.forEach(f => fd.append('video_files', f, f.name));
    return formDataRequest(`/assessment-capstone-project-solutions/bulk-upload`, 'POST', fd);
  },

  // ── Webinars ──
  listWebinars: (qs = '') => request(`/webinars${qs}`, { auth: false }),
  getWebinar: (id: number) => request(`/webinars/${id}`, { auth: false }),
  createWebinar: (data: any) => request('/webinars', { method: 'POST', body: JSON.stringify(data) }),
  updateWebinar: (id: number, data: any) => request(`/webinars/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteWebinar: (id: number) => request(`/webinars/${id}`, { method: 'DELETE' }),
  restoreWebinar: (id: number) => request(`/webinars/${id}/restore`, { method: 'PATCH' }),
  deleteWebinar: (id: number) => request(`/webinars/${id}/permanent`, { method: 'DELETE' }),

  // ── Webinar Translations ──
  listWebinarTranslations: (qs = '') => request(`/webinar-translations${qs}`, { auth: false }),
  getWebinarTranslation: (id: number) => request(`/webinar-translations/${id}`, { auth: false }),
  webinarTranslationCoverage: (qs = '') => request(`/webinar-translations/coverage${qs}`, { auth: false }),
  createWebinarTranslation: (data: any, isFormData = false) => request('/webinar-translations', { method: 'POST', body: isFormData ? data : JSON.stringify(data), isFormData }),
  updateWebinarTranslation: (id: number, data: any, isFormData = false) => request(`/webinar-translations/${id}`, { method: 'PATCH', body: isFormData ? data : JSON.stringify(data), isFormData }),
  softDeleteWebinarTranslation: (id: number) => request(`/webinar-translations/${id}`, { method: 'DELETE' }),
  restoreWebinarTranslation: (id: number) => request(`/webinar-translations/${id}/restore`, { method: 'PATCH' }),
  deleteWebinarTranslation: (id: number) => request(`/webinar-translations/${id}/permanent`, { method: 'DELETE' }),

  // ── Webinar AI ──
  autoTranslateWebinar: (data: { entity_type: string; entity_id: number; provider?: string }) =>
    request('/ai/generate-all-translations', { method: 'POST', body: JSON.stringify(data) }),

  // ── Referral Codes ──
  listReferralCodes: (qs = '') => request(`/referral-codes${qs}`, { auth: false }),
  getReferralCode: (id: number) => request(`/referral-codes/${id}`, { auth: false }),
  createReferralCode: (data: any) => request('/referral-codes', { method: 'POST', body: JSON.stringify(data) }),
  updateReferralCode: (id: number, data: any) => request(`/referral-codes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteReferralCode: (id: number) => request(`/referral-codes/${id}`, { method: 'DELETE' }),
  restoreReferralCode: (id: number) => request(`/referral-codes/${id}/restore`, { method: 'PATCH' }),
  deleteReferralCode: (id: number) => request(`/referral-codes/${id}/permanent`, { method: 'DELETE' }),

  // ── Referral Usages ──
  listReferralUsages: (qs = '') => request(`/referral-usages${qs}`, { auth: false }),
  getReferralUsage: (id: number) => request(`/referral-usages/${id}`, { auth: false }),
  createReferralUsage: (data: any) => request('/referral-usages', { method: 'POST', body: JSON.stringify(data) }),
  updateReferralUsage: (id: number, data: any) => request(`/referral-usages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteReferralUsage: (id: number) => request(`/referral-usages/${id}`, { method: 'DELETE' }),
  restoreReferralUsage: (id: number) => request(`/referral-usages/${id}/restore`, { method: 'PATCH' }),
  deleteReferralUsage: (id: number) => request(`/referral-usages/${id}/permanent`, { method: 'DELETE' }),

  // ── Referral Rewards ──
  listReferralRewards: (qs = '') => request(`/referral-rewards${qs}`, { auth: false }),
  getReferralReward: (id: number) => request(`/referral-rewards/${id}`, { auth: false }),
  createReferralReward: (data: any) => request('/referral-rewards', { method: 'POST', body: JSON.stringify(data) }),
  updateReferralReward: (id: number, data: any) => request(`/referral-rewards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteReferralReward: (id: number) => request(`/referral-rewards/${id}`, { method: 'DELETE' }),
  restoreReferralReward: (id: number) => request(`/referral-rewards/${id}/restore`, { method: 'PATCH' }),
  deleteReferralReward: (id: number) => request(`/referral-rewards/${id}/permanent`, { method: 'DELETE' }),

  // ── Coupons ──
  listCoupons: (qs = '') => request(`/coupons${qs}`, { auth: false }),
  getCoupon: (id: number) => request(`/coupons/${id}`, { auth: false }),
  createCoupon: (data: any) => request('/coupons', { method: 'POST', body: JSON.stringify(data) }),
  updateCoupon: (id: number, data: any) => request(`/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteCoupon: (id: number) => request(`/coupons/${id}`, { method: 'DELETE' }),
  restoreCoupon: (id: number) => request(`/coupons/${id}/restore`, { method: 'PATCH' }),
  deleteCoupon: (id: number) => request(`/coupons/${id}/permanent`, { method: 'DELETE' }),

  // ── Coupon Courses ──
  listCouponCourses: (qs = '') => request(`/coupon-courses${qs}`, { auth: false }),
  getCouponCourse: (id: number) => request(`/coupon-courses/${id}`, { auth: false }),
  createCouponCourse: (data: any) => request('/coupon-courses', { method: 'POST', body: JSON.stringify(data) }),
  updateCouponCourse: (id: number, data: any) => request(`/coupon-courses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteCouponCourse: (id: number) => request(`/coupon-courses/${id}`, { method: 'DELETE' }),
  restoreCouponCourse: (id: number) => request(`/coupon-courses/${id}/restore`, { method: 'PATCH' }),
  deleteCouponCourse: (id: number) => request(`/coupon-courses/${id}/permanent`, { method: 'DELETE' }),

  // ── Coupon Bundles ──
  listCouponBundles: (qs = '') => request(`/coupon-bundles${qs}`, { auth: false }),
  getCouponBundle: (id: number) => request(`/coupon-bundles/${id}`, { auth: false }),
  createCouponBundle: (data: any) => request('/coupon-bundles', { method: 'POST', body: JSON.stringify(data) }),
  updateCouponBundle: (id: number, data: any) => request(`/coupon-bundles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteCouponBundle: (id: number) => request(`/coupon-bundles/${id}`, { method: 'DELETE' }),
  restoreCouponBundle: (id: number) => request(`/coupon-bundles/${id}/restore`, { method: 'PATCH' }),
  deleteCouponBundle: (id: number) => request(`/coupon-bundles/${id}/permanent`, { method: 'DELETE' }),

  // ── Coupon Batches ──
  listCouponBatches: (qs = '') => request(`/coupon-batches${qs}`, { auth: false }),
  getCouponBatch: (id: number) => request(`/coupon-batches/${id}`, { auth: false }),
  createCouponBatch: (data: any) => request('/coupon-batches', { method: 'POST', body: JSON.stringify(data) }),
  updateCouponBatch: (id: number, data: any) => request(`/coupon-batches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteCouponBatch: (id: number) => request(`/coupon-batches/${id}`, { method: 'DELETE' }),
  restoreCouponBatch: (id: number) => request(`/coupon-batches/${id}/restore`, { method: 'PATCH' }),
  deleteCouponBatch: (id: number) => request(`/coupon-batches/${id}/permanent`, { method: 'DELETE' }),

  // ── Coupon Webinars ──
  listCouponWebinars: (qs = '') => request(`/coupon-webinars${qs}`, { auth: false }),
  getCouponWebinar: (id: number) => request(`/coupon-webinars/${id}`, { auth: false }),
  createCouponWebinar: (data: any) => request('/coupon-webinars', { method: 'POST', body: JSON.stringify(data) }),
  updateCouponWebinar: (id: number, data: any) => request(`/coupon-webinars/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteCouponWebinar: (id: number) => request(`/coupon-webinars/${id}`, { method: 'DELETE' }),
  restoreCouponWebinar: (id: number) => request(`/coupon-webinars/${id}/restore`, { method: 'PATCH' }),
  deleteCouponWebinar: (id: number) => request(`/coupon-webinars/${id}/permanent`, { method: 'DELETE' }),

  // ── Instructor Promotions ──
  listInstructorPromotions: (qs = '') => request(`/instructor-promotions${qs}`, { auth: false }),
  getInstructorPromotion: (id: number) => request(`/instructor-promotions/${id}`, { auth: false }),
  createInstructorPromotion: (data: any) => request('/instructor-promotions', { method: 'POST', body: JSON.stringify(data) }),
  updateInstructorPromotion: (id: number, data: any) => request(`/instructor-promotions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteInstructorPromotion: (id: number) => request(`/instructor-promotions/${id}`, { method: 'DELETE' }),
  restoreInstructorPromotion: (id: number) => request(`/instructor-promotions/${id}/restore`, { method: 'PATCH' }),
  deleteInstructorPromotion: (id: number) => request(`/instructor-promotions/${id}/permanent`, { method: 'DELETE' }),
  approveInstructorPromotion: (id: number) => request(`/instructor-promotions/${id}/approve`, { method: 'PATCH' }),
  rejectInstructorPromotion: (id: number, data: any) => request(`/instructor-promotions/${id}/reject`, { method: 'PATCH', body: JSON.stringify(data) }),

  // ── Instructor Promotion Courses ──
  listInstructorPromotionCourses: (qs = '') => request(`/instructor-promotion-courses${qs}`, { auth: false }),
  getInstructorPromotionCourse: (id: number) => request(`/instructor-promotion-courses/${id}`, { auth: false }),
  createInstructorPromotionCourse: (data: any) => request('/instructor-promotion-courses', { method: 'POST', body: JSON.stringify(data) }),
  updateInstructorPromotionCourse: (id: number, data: any) => request(`/instructor-promotion-courses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteInstructorPromotionCourse: (id: number) => request(`/instructor-promotion-courses/${id}`, { method: 'DELETE' }),
  restoreInstructorPromotionCourse: (id: number) => request(`/instructor-promotion-courses/${id}/restore`, { method: 'PATCH' }),
  deleteInstructorPromotionCourse: (id: number) => request(`/instructor-promotion-courses/${id}/permanent`, { method: 'DELETE' }),

  // ── Course Authoring (draft builder) ──
  listAuthoringCourses: (qs = '') => request(`/authoring/courses${qs}`),
  getAuthoringCourse: (id: number) => request(`/authoring/courses/${id}`),
  createAuthoringCourse: (data: any) => request('/authoring/courses', { method: 'POST', body: JSON.stringify(data) }),
  updateAuthoringCourse: (id: number, data: any) => request(`/authoring/courses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  submitAuthoringCourse: (id: number) => request(`/authoring/courses/${id}/submit`, { method: 'PATCH' }),
  verifyAuthoringCourse: (id: number) => request(`/authoring/courses/${id}/verify`, { method: 'PATCH' }),
  rejectAuthoringCourse: (id: number, data: any) => request(`/authoring/courses/${id}/reject`, { method: 'PATCH', body: JSON.stringify(data) }),
  restoreAuthoringCourse: (id: number) => request(`/authoring/courses/${id}/restore`, { method: 'PATCH' }),
  softDeleteAuthoringCourse: (id: number) => request(`/authoring/courses/${id}`, { method: 'DELETE' }),
  deleteAuthoringCourse: (id: number) => request(`/authoring/courses/${id}/permanent`, { method: 'DELETE' }),

  listAuthoringHighlights: (courseId: number) => request(`/authoring/highlights?authoring_course_id=${courseId}`),
  createAuthoringHighlight: (data: any) => request('/authoring/highlights', { method: 'POST', body: JSON.stringify(data) }),
  updateAuthoringHighlight: (id: number, data: any) => request(`/authoring/highlights/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAuthoringHighlight: (id: number) => request(`/authoring/highlights/${id}`, { method: 'DELETE' }),

  listAuthoringUnits: (courseId: number) => request(`/authoring/units?authoring_course_id=${courseId}`),
  createAuthoringUnit: (data: any) => request('/authoring/units', { method: 'POST', body: JSON.stringify(data) }),
  updateAuthoringUnit: (id: number, data: any) => request(`/authoring/units/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAuthoringUnit: (id: number) => request(`/authoring/units/${id}`, { method: 'DELETE' }),
  importCourseStructure: (courseId: number, file: File) => { const fd = new FormData(); fd.append('file', file); return request(`/authoring/courses/${courseId}/import-structure`, { method: 'POST', body: fd as any, isFormData: true }); },

  listAuthoringFaqs: (courseId: number) => request(`/authoring/faqs?authoring_course_id=${courseId}`),
  createAuthoringFaq: (data: any) => request('/authoring/faqs', { method: 'POST', body: JSON.stringify(data) }),
  updateAuthoringFaq: (id: number, data: any) => request(`/authoring/faqs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAuthoringFaq: (id: number) => request(`/authoring/faqs/${id}`, { method: 'DELETE' }),

  // ── Course Authoring — media uploads (Bunny) + readiness ──
  authoringCourseReadiness: (id: number) => request(`/authoring/courses/${id}/readiness`),
  uploadAuthoringThumbnail: (id: number, file: File) => { const fd = new FormData(); fd.append('file', file); return request(`/authoring/courses/${id}/thumbnail`, { method: 'POST', body: fd as any, isFormData: true }); },
  uploadAuthoringTrailerVideo: (id: number, file: File, onProgress?: (p: number) => void) => _uploadCourseVideoXhr(`/authoring/courses/${id}/trailer-video`, file, onProgress),
  authoringTrailerPlayback: (id: number) => request(`/authoring/courses/${id}/trailer-playback`),
  uploadAuthoringUnitVideo: (id: number, file: File, onProgress?: (p: number) => void) => _uploadCourseVideoXhr(`/authoring/units/${id}/video`, file, onProgress),
  authoringUnitVideoPlayback: (id: number) => request(`/authoring/units/${id}/video-playback`),
  removeAuthoringUnitVideo: (id: number) => request(`/authoring/units/${id}/video`, { method: 'DELETE' }),
  uploadAuthoringUnitFile: (id: number, kind: string, file: File) => { const fd = new FormData(); fd.append('file', file); return request(`/authoring/units/${id}/file?kind=${kind}`, { method: 'POST', body: fd as any, isFormData: true }); },
  removeAuthoringUnitFile: (id: number, kind: string) => request(`/authoring/units/${id}/file?kind=${kind}`, { method: 'DELETE' }),
  removeAuthoringTrailerVideo: (id: number) => request(`/authoring/courses/${id}/trailer-video`, { method: 'DELETE' }),

  // ── Authoring Capstone Projects (course-level) ──
  listAuthoringCapstones: (courseId: number) => request(`/authoring/capstone-projects?authoring_course_id=${courseId}`),
  getAuthoringCapstone: (id: number) => request(`/authoring/capstone-projects/${id}`),
  createAuthoringCapstone: (data: any) => request('/authoring/capstone-projects', { method: 'POST', body: JSON.stringify(data) }),
  updateAuthoringCapstone: (id: number, data: any) => request(`/authoring/capstone-projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAuthoringCapstone: (id: number) => request(`/authoring/capstone-projects/${id}`, { method: 'DELETE' }),
  uploadAuthoringCapstoneFile: (id: number, kind: string, file: File) => { const fd = new FormData(); fd.append('file', file); return request(`/authoring/capstone-projects/${id}/file?kind=${kind}`, { method: 'POST', body: fd as any, isFormData: true }); },
  removeAuthoringCapstoneFile: (id: number, kind: string) => request(`/authoring/capstone-projects/${id}/file?kind=${kind}`, { method: 'DELETE' }),

  // ── Authoring Mini Projects (module/chapter-level) ──
  listAuthoringMiniProjects: (courseId: number, unitId?: number) => request(`/authoring/mini-projects?authoring_course_id=${courseId}${unitId ? `&unit_id=${unitId}` : ''}`),
  getAuthoringMiniProject: (id: number) => request(`/authoring/mini-projects/${id}`),
  createAuthoringMiniProject: (data: any) => request('/authoring/mini-projects', { method: 'POST', body: JSON.stringify(data) }),
  updateAuthoringMiniProject: (id: number, data: any) => request(`/authoring/mini-projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAuthoringMiniProject: (id: number) => request(`/authoring/mini-projects/${id}`, { method: 'DELETE' }),
  uploadAuthoringMiniProjectFile: (id: number, kind: string, file: File) => { const fd = new FormData(); fd.append('file', file); return request(`/authoring/mini-projects/${id}/file?kind=${kind}`, { method: 'POST', body: fd as any, isFormData: true }); },
  removeAuthoringMiniProjectFile: (id: number, kind: string) => request(`/authoring/mini-projects/${id}/file?kind=${kind}`, { method: 'DELETE' }),

  // ── Cart Items ──
  listCartItems: (qs = '') => request(`/cart-items${qs}`, { auth: false }),
  getCartItem: (id: number) => request(`/cart-items/${id}`, { auth: false }),
  getCartByUser: (userId: number) => request(`/cart-items/user/${userId}`, { auth: false }),
  createCartItem: (data: any) => request('/cart-items', { method: 'POST', body: JSON.stringify(data) }),
  updateCartItem: (id: number, data: any) => request(`/cart-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteCartItem: (id: number) => request(`/cart-items/${id}`, { method: 'DELETE' }),
  restoreCartItem: (id: number) => request(`/cart-items/${id}/restore`, { method: 'PATCH' }),
  deleteCartItem: (id: number) => request(`/cart-items/${id}/permanent`, { method: 'DELETE' }),
  clearCart: (userId: number) => request(`/cart-items/clear/${userId}`, { method: 'DELETE' }),

  // ── Wishlists ──
  listWishlists: (qs = '') => request(`/wishlists${qs}`),
  getWishlist: (id: number) => request(`/wishlists/${id}`),
  getWishlistByUser: (userId: number) => request(`/wishlists/user/${userId}`),
  createWishlist: (data: any) => request('/wishlists', { method: 'POST', body: JSON.stringify(data) }),
  updateWishlist: (id: number, data: any) => request(`/wishlists/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteWishlist: (id: number) => request(`/wishlists/${id}`, { method: 'DELETE' }),
  restoreWishlist: (id: number) => request(`/wishlists/${id}/restore`, { method: 'PATCH' }),
  deleteWishlist: (id: number) => request(`/wishlists/${id}/permanent`, { method: 'DELETE' }),
  moveWishlistToCart: (id: number) => request(`/wishlists/move-to-cart/${id}`, { method: 'POST' }),

  // ── Orders ──
  // These are admin endpoints behind authMiddleware. auth:false dropped the
  // Bearer token → "No token provided". Default to auth:true (same as BUG-25).
  listOrders: (qs = '') => request(`/orders${qs}`),
  getOrder: (id: number) => request(`/orders/${id}`),
  getOrderItems: (orderId: number) => request(`/orders/${orderId}/items`),
  createOrder: (data: any) => request('/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id: number, data: any) => request(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteOrder: (id: number) => request(`/orders/${id}`, { method: 'DELETE' }),
  restoreOrder: (id: number) => request(`/orders/${id}/restore`, { method: 'PATCH' }),
  deleteOrder: (id: number) => request(`/orders/${id}/permanent`, { method: 'DELETE' }),
  cancelOrder: (id: number, data?: any) => request(`/orders/${id}/cancel`, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  confirmOrder: (id: number) => request(`/orders/${id}/confirm`, { method: 'PATCH' }),

  // ── Payments ──
  listPayments: (qs = '') => request(`/payments${qs}`),
  getPayment: (id: number) => request(`/payments/${id}`),
  getPaymentsByOrder: (orderId: number) => request(`/payments/order/${orderId}`),
  createPayment: (data: any) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),
  updatePayment: (id: number, data: any) => request(`/payments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeletePayment: (id: number) => request(`/payments/${id}`, { method: 'DELETE' }),
  restorePayment: (id: number) => request(`/payments/${id}/restore`, { method: 'PATCH' }),
  deletePayment: (id: number) => request(`/payments/${id}/permanent`, { method: 'DELETE' }),

  // ── Transactions ──
  listTransactions: (qs = '') => request(`/transactions${qs}`),
  getTransaction: (id: number) => request(`/transactions/${id}`),
  getTransactionsByOrder: (orderId: number) => request(`/transactions/order/${orderId}`),
  getTransactionsByUser: (userId: number) => request(`/transactions/user/${userId}`),
  createTransaction: (data: any) => request('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id: number, data: any) => request(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteTransaction: (id: number) => request(`/transactions/${id}`, { method: 'DELETE' }),
  restoreTransaction: (id: number) => request(`/transactions/${id}/restore`, { method: 'PATCH' }),
  deleteTransaction: (id: number) => request(`/transactions/${id}/permanent`, { method: 'DELETE' }),

  // ── Enrollments ──
  // BUG-25 fix: these are admin endpoints behind authMiddleware. With auth:false the
  // Bearer token was not attached → 401 → the Enrollments page (and Certificates/Badges
  // testing) showed "No enrollments". Default to auth:true so the token is sent.
  listEnrollments: (qs = '') => request(`/enrollments${qs}`),
  getEnrollment: (id: number) => request(`/enrollments/${id}`),
  getEnrollmentsByUser: (userId: number) => request(`/enrollments/user/${userId}`),
  getEnrollmentProgress: (id: number) => request(`/enrollments/${id}/progress`),
  createEnrollment: (data: any) => request('/enrollments', { method: 'POST', body: JSON.stringify(data) }),
  updateEnrollment: (id: number, data: any) => request(`/enrollments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteEnrollment: (id: number) => request(`/enrollments/${id}`, { method: 'DELETE' }),
  restoreEnrollment: (id: number) => request(`/enrollments/${id}/restore`, { method: 'PATCH' }),
  deleteEnrollment: (id: number) => request(`/enrollments/${id}/permanent`, { method: 'DELETE' }),
  updateEnrollmentProgress: (id: number, data: any) => request(`/enrollments/${id}/progress`, { method: 'POST', body: JSON.stringify(data) }),

  // ── Invoices ──
  listInvoices: (qs = '') => request(`/invoices${qs}`),
  getInvoice: (id: number) => request(`/invoices/${id}`),
  getInvoicesByOrder: (orderId: number) => request(`/invoices/order/${orderId}`),
  createInvoice: (data: any) => request('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  updateInvoice: (id: number, data: any) => request(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteInvoice: (id: number) => request(`/invoices/${id}`, { method: 'DELETE' }),
  restoreInvoice: (id: number) => request(`/invoices/${id}/restore`, { method: 'PATCH' }),
  deleteInvoice: (id: number) => request(`/invoices/${id}/permanent`, { method: 'DELETE' }),
  issueInvoice: (id: number) => request(`/invoices/${id}/issue`, { method: 'PATCH' }),
  cancelInvoice: (id: number) => request(`/invoices/${id}/cancel-invoice`, { method: 'PATCH' }),

  // ── Refunds ──
  listRefunds: (qs = '') => request(`/refunds${qs}`),
  getRefund: (id: number) => request(`/refunds/${id}`),
  getRefundsByOrder: (orderId: number) => request(`/refunds/order/${orderId}`),
  createRefund: (data: any) => request('/refunds', { method: 'POST', body: JSON.stringify(data) }),
  updateRefund: (id: number, data: any) => request(`/refunds/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteRefund: (id: number) => request(`/refunds/${id}`, { method: 'DELETE' }),
  restoreRefund: (id: number) => request(`/refunds/${id}/restore`, { method: 'PATCH' }),
  deleteRefund: (id: number) => request(`/refunds/${id}/permanent`, { method: 'DELETE' }),
  approveRefund: (id: number) => request(`/refunds/${id}/approve`, { method: 'PATCH' }),
  rejectRefund: (id: number, data: any) => request(`/refunds/${id}/reject`, { method: 'PATCH', body: JSON.stringify(data) }),

  // ── Checkout ──
  getCheckoutConfig: () => request('/checkout/config', { auth: false }),
  initiateCheckout: (data: any) => request('/checkout/initiate', { method: 'POST', body: JSON.stringify(data) }),
  verifyCheckoutPayment: (data: any) => request('/checkout/verify', { method: 'POST', body: JSON.stringify(data) }),
  processCheckoutRefund: (data: any) => request('/checkout/refund', { method: 'POST', body: JSON.stringify(data) }),

  // ── Revenue Dashboard ──
  getRevenueDashboard: (period = 30) => request(`/revenue-dashboard/stats?period=${period}`),

  // ── Student Progress ──
  getStudentProgressOverview: (period = 30) => request(`/student-progress/overview?period=${period}`),
  getStudentProgressStudents: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    if (params.sort_by) q.set('sort_by', params.sort_by);
    if (params.sort_dir) q.set('sort_dir', params.sort_dir);
    return request(`/student-progress/students?${q.toString()}`);
  },
  getStudentProgressDetail: (userId: number) => request(`/student-progress/students/${userId}`),
  getQuizAnalytics: (period = 30) => request(`/student-progress/quiz-analytics?period=${period}`),
  getVideoWatchHistory: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.user_id) q.set('user_id', String(params.user_id));
    return request(`/student-progress/video-history?${q.toString()}`);
  },
  getQuizAttempts: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.user_id) q.set('user_id', String(params.user_id));
    if (params.status) q.set('status', params.status);
    if (params.quiz_type) q.set('quiz_type', params.quiz_type);
    return request(`/student-progress/quiz-attempts?${q.toString()}`);
  },
  getProjectSubmissions: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.user_id) q.set('user_id', String(params.user_id));
    if (params.status) q.set('status', params.status);
    if (params.project_type) q.set('project_type', params.project_type);
    return request(`/student-progress/submissions?${q.toString()}`);
  },

  // ── Certificate Templates ──
  listCertificateTemplates: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) { if (v !== undefined && v !== null && v !== '') q.set(k, String(v)); }
    return request(`/certificate-templates?${q.toString()}`);
  },
  getCertificateTemplate: (id: number) => request(`/certificate-templates/${id}`),
  createCertificateTemplate: (data: FormData) => request('/certificate-templates', { method: 'POST', body: data, isFormData: true }),
  updateCertificateTemplate: (id: number, data: FormData) => request(`/certificate-templates/${id}`, { method: 'PATCH', body: data, isFormData: true }),
  softDeleteCertificateTemplate: (id: number) => request(`/certificate-templates/${id}`, { method: 'DELETE' }),
  restoreCertificateTemplate: (id: number) => request(`/certificate-templates/${id}/restore`, { method: 'PATCH' }),
  deleteCertificateTemplate: (id: number) => request(`/certificate-templates/${id}/permanent`, { method: 'DELETE' }),

  // ── Issued Certificates ──
  listIssuedCertificates: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) { if (v !== undefined && v !== null && v !== '') q.set(k, String(v)); }
    return request(`/issued-certificates?${q.toString()}`);
  },
  getIssuedCertificate: (id: number) => request(`/issued-certificates/${id}`),
  issueCertificate: (data: any) => request('/issued-certificates/issue', { method: 'POST', body: JSON.stringify(data) }),
  bulkIssueCertificates: (data: any) => request('/issued-certificates/bulk-issue', { method: 'POST', body: JSON.stringify(data) }),
  revokeCertificate: (id: number, data: any) => request(`/issued-certificates/${id}/revoke`, { method: 'PATCH', body: JSON.stringify(data) }),
  verifyCertificate: (certNumber: string) => request(`/issued-certificates/verify/${certNumber}`),
  softDeleteIssuedCertificate: (id: number) => request(`/issued-certificates/${id}`, { method: 'DELETE' }),
  restoreIssuedCertificate: (id: number) => request(`/issued-certificates/${id}/restore`, { method: 'PATCH' }),
  deleteIssuedCertificate: (id: number) => request(`/issued-certificates/${id}/permanent`, { method: 'DELETE' }),

  // ── Badges ──
  listBadges: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) { if (v !== undefined && v !== null && v !== '') q.set(k, String(v)); }
    return request(`/badges?${q.toString()}`);
  },
  getBadge: (id: number) => request(`/badges/${id}`),
  createBadge: (data: FormData) => request('/badges', { method: 'POST', body: data, isFormData: true }),
  updateBadge: (id: number, data: FormData) => request(`/badges/${id}`, { method: 'PATCH', body: data, isFormData: true }),
  softDeleteBadge: (id: number) => request(`/badges/${id}`, { method: 'DELETE' }),
  restoreBadge: (id: number) => request(`/badges/${id}/restore`, { method: 'PATCH' }),
  deleteBadge: (id: number) => request(`/badges/${id}/permanent`, { method: 'DELETE' }),

  // ── User Badges ──
  listUserBadges: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) { if (v !== undefined && v !== null && v !== '') q.set(k, String(v)); }
    return request(`/user-badges?${q.toString()}`);
  },
  getUserBadge: (id: number) => request(`/user-badges/${id}`),
  getUserBadgesByUser: (userId: number) => request(`/user-badges/user/${userId}`),
  awardBadge: (data: any) => request('/user-badges/award', { method: 'POST', body: JSON.stringify(data) }),
  bulkAwardBadge: (data: any) => request('/user-badges/bulk-award', { method: 'POST', body: JSON.stringify(data) }),
  removeUserBadge: (id: number) => request(`/user-badges/${id}`, { method: 'DELETE' }),

  // ── Reviews ──
  listReviews: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) { if (v !== undefined && v !== null && v !== '') q.set(k, String(v)); }
    return request(`/reviews?${q.toString()}`);
  },
  getReview: (id: number) => request(`/reviews/${id}`),
  createReview: (data: any) => request('/reviews', { method: 'POST', body: JSON.stringify(data) }),
  updateReview: (id: number, data: any) => request(`/reviews/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  changeReviewStatus: (id: number, status: string) => request(`/reviews/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  softDeleteReview: (id: number) => request(`/reviews/${id}/soft-delete`, { method: 'PATCH' }),
  restoreReview: (id: number) => request(`/reviews/${id}/restore`, { method: 'PATCH' }),
  deleteReview: (id: number) => request(`/reviews/${id}`, { method: 'DELETE' }),
  recalculateReviewRatings: (item_type: string, item_id: number) => request('/reviews/recalculate', { method: 'POST', body: JSON.stringify({ item_type, item_id }) }),
  reviewUserOptions: (search = '') => request(`/reviews/user-options?search=${encodeURIComponent(search)}&limit=20`),
  reviewItemOptions: (item_type: string, search = '') => request(`/reviews/item-options?item_type=${encodeURIComponent(item_type)}&search=${encodeURIComponent(search)}&limit=20`),
  getReviewStats: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) { if (v !== undefined && v !== null && v !== '') q.set(k, String(v)); }
    return request(`/reviews/stats?${q.toString()}`);
  },

  // ── Review Helpfulness ──
  listReviewHelpfulness: (params: Record<string, any> = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) { if (v !== undefined && v !== null && v !== '') q.set(k, String(v)); }
    return request(`/review-helpfulness?${q.toString()}`);
  },
  voteReviewHelpfulness: (data: any) => request('/review-helpfulness', { method: 'POST', body: JSON.stringify(data) }),
  deleteReviewHelpfulness: (id: number) => request(`/review-helpfulness/${id}`, { method: 'DELETE' }),

  // ── Notifications ──
  getNotifications: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/notifications?${q.toString()}`);
  },
  getNotification: (id: number) => request(`/notifications/${id}`),
  createNotification: (data: any) => request('/notifications', { method: 'POST', body: JSON.stringify(data) }),
  updateNotification: (id: number, data: any) => request(`/notifications/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteNotification: (id: number) => request(`/notifications/${id}`, { method: 'DELETE' }),
  restoreNotification: (id: number) => request(`/notifications/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteNotification: (id: number) => request(`/notifications/${id}/permanent`, { method: 'DELETE' }),
  markNotificationAsRead: (id: number) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsAsRead: (userId: number) => request('/notifications/mark-all-read', { method: 'PATCH', body: JSON.stringify({ user_id: userId }) }),
  getUnreadNotificationCount: (userId: number) => request(`/notifications/unread-count/${userId}`),

  // ── Email Templates ──
  listEmailTemplates: (qs?: string) => request(`/email-templates${qs || ''}`),
  getEmailTemplate: (id: number) => request(`/email-templates/${id}`),
  getEmailTemplateSummary: () => request('/email-templates/summary'),
  createEmailTemplate: (data: any) => request('/email-templates', { method: 'POST', body: JSON.stringify(data) }),
  updateEmailTemplate: (id: number, data: any) => request(`/email-templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEmailTemplate: (id: number) => request(`/email-templates/${id}`, { method: 'DELETE' }),
  restoreEmailTemplate: (id: number) => request(`/email-templates/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteEmailTemplate: (id: number) => request(`/email-templates/${id}/permanent`, { method: 'DELETE' }),

  // ── Notification Preferences ──
  listNotificationPreferences: (qs?: string) => request(`/notification-preferences${qs || ''}`),
  getNotificationPreference: (id: number) => request(`/notification-preferences/${id}`),
  getNotificationPreferenceSummary: () => request('/notification-preferences/summary'),
  getNotificationPreferencesByUser: (userId: number) => request(`/notification-preferences/user/${userId}`),
  updateNotificationPreference: (id: number, data: any) => request(`/notification-preferences/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  bulkUpdateNotificationPreferences: (userId: number, data: any) => request(`/notification-preferences/user/${userId}/bulk`, { method: 'PATCH', body: JSON.stringify(data) }),

  // ── Instructor Earnings ──
  getInstructorEarnings: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/instructor-earnings?${q.toString()}`);
  },
  getInstructorEarning: (id: number) => request(`/instructor-earnings/${id}`),
  createInstructorEarning: (data: any) => request('/instructor-earnings', { method: 'POST', body: JSON.stringify(data) }),
  updateInstructorEarning: (id: number, data: any) => request(`/instructor-earnings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteInstructorEarning: (id: number) => request(`/instructor-earnings/${id}`, { method: 'DELETE' }),
  restoreInstructorEarning: (id: number) => request(`/instructor-earnings/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteInstructorEarning: (id: number) => request(`/instructor-earnings/${id}/permanent`, { method: 'DELETE' }),
  getInstructorEarningSummary: (instructorId: number) => request(`/instructor-earnings/summary/${instructorId}`),

  // ── Payout Requests ──
  getPayoutRequests: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/payout-requests?${q.toString()}`);
  },
  getPayoutRequest: (id: number) => request(`/payout-requests/${id}`),
  createPayoutRequest: (data: any) => request('/payout-requests', { method: 'POST', body: JSON.stringify(data) }),
  updatePayoutRequest: (id: number, data: any) => request(`/payout-requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  approvePayoutRequest: (id: number, data: any) => request(`/payout-requests/${id}/approve`, { method: 'PATCH', body: JSON.stringify(data) }),
  rejectPayoutRequest: (id: number, data: any) => request(`/payout-requests/${id}/reject`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeletePayoutRequest: (id: number) => request(`/payout-requests/${id}`, { method: 'DELETE' }),
  restorePayoutRequest: (id: number) => request(`/payout-requests/${id}/restore`, { method: 'PATCH' }),
  permanentDeletePayoutRequest: (id: number) => request(`/payout-requests/${id}/permanent`, { method: 'DELETE' }),

  // ── Payout Settlements ──
  getPayoutSettlements: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/payout-settlements?${q.toString()}`);
  },
  getPayoutSettlement: (id: number) => request(`/payout-settlements/${id}`),
  createPayoutSettlement: (data: any) => request('/payout-settlements', { method: 'POST', body: JSON.stringify(data) }),
  updatePayoutSettlement: (id: number, data: any) => request(`/payout-settlements/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  completePayoutSettlement: (id: number, data: any) => request(`/payout-settlements/${id}/complete`, { method: 'PATCH', body: JSON.stringify(data) }),
  failPayoutSettlement: (id: number, data: any) => request(`/payout-settlements/${id}/fail`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeletePayoutSettlement: (id: number) => request(`/payout-settlements/${id}`, { method: 'DELETE' }),
  restorePayoutSettlement: (id: number) => request(`/payout-settlements/${id}/restore`, { method: 'PATCH' }),
  permanentDeletePayoutSettlement: (id: number) => request(`/payout-settlements/${id}/permanent`, { method: 'DELETE' }),

  // ── Discussion Threads ──
  getDiscussionThreads: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/discussion-threads?${q.toString()}`);
  },
  getDiscussionThread: (id: number) => request(`/discussion-threads/${id}`),
  createDiscussionThread: (data: any) => request('/discussion-threads', { method: 'POST', body: JSON.stringify(data) }),
  updateDiscussionThread: (id: number, data: any) => request(`/discussion-threads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteDiscussionThread: (id: number) => request(`/discussion-threads/${id}`, { method: 'DELETE' }),
  restoreDiscussionThread: (id: number) => request(`/discussion-threads/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteDiscussionThread: (id: number) => request(`/discussion-threads/${id}/permanent`, { method: 'DELETE' }),
  closeDiscussionThread: (id: number) => request(`/discussion-threads/${id}/close`, { method: 'PATCH' }),
  resolveDiscussionThread: (id: number) => request(`/discussion-threads/${id}/resolve`, { method: 'PATCH' }),
  pinDiscussionThread: (id: number) => request(`/discussion-threads/${id}/pin`, { method: 'PATCH' }),

  // ── Discussion Replies ──
  getDiscussionReplies: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/discussion-replies?${q.toString()}`);
  },
  getDiscussionReply: (id: number) => request(`/discussion-replies/${id}`),
  createDiscussionReply: (data: any) => request('/discussion-replies', { method: 'POST', body: JSON.stringify(data) }),
  updateDiscussionReply: (id: number, data: any) => request(`/discussion-replies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteDiscussionReply: (id: number) => request(`/discussion-replies/${id}`, { method: 'DELETE' }),
  restoreDiscussionReply: (id: number) => request(`/discussion-replies/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteDiscussionReply: (id: number) => request(`/discussion-replies/${id}/permanent`, { method: 'DELETE' }),
  acceptDiscussionReply: (id: number) => request(`/discussion-replies/${id}/accept`, { method: 'PATCH' }),

  // ── Live Sessions ──
  getLiveSessions: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/live-sessions?${q.toString()}`);
  },
  getLiveSession: (id: number) => request(`/live-sessions/${id}`),
  createLiveSession: (data: any) => request('/live-sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateLiveSession: (id: number, data: any) => request(`/live-sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteLiveSession: (id: number) => request(`/live-sessions/${id}`, { method: 'DELETE' }),
  restoreLiveSession: (id: number) => request(`/live-sessions/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteLiveSession: (id: number) => request(`/live-sessions/${id}/permanent`, { method: 'DELETE' }),
  startLiveSession: (id: number) => request(`/live-sessions/${id}/start`, { method: 'PATCH' }),
  endLiveSession: (id: number) => request(`/live-sessions/${id}/end`, { method: 'PATCH' }),
  cancelLiveSession: (id: number) => request(`/live-sessions/${id}/cancel`, { method: 'PATCH' }),
  rescheduleLiveSession: (id: number, data: any) => request(`/live-sessions/${id}/reschedule`, { method: 'PATCH', body: JSON.stringify(data) }),

  // ── Session Attendance ──
  getSessionAttendances: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/session-attendance?${q.toString()}`);
  },
  getSessionAttendance: (id: number) => request(`/session-attendance/${id}`),
  createSessionAttendance: (data: any) => request('/session-attendance', { method: 'POST', body: JSON.stringify(data) }),
  updateSessionAttendance: (id: number, data: any) => request(`/session-attendance/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteSessionAttendance: (id: number) => request(`/session-attendance/${id}`, { method: 'DELETE' }),
  restoreSessionAttendance: (id: number) => request(`/session-attendance/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteSessionAttendance: (id: number) => request(`/session-attendance/${id}/permanent`, { method: 'DELETE' }),
  markSessionAttendance: (data: any) => request('/session-attendance/mark', { method: 'POST', body: JSON.stringify(data) }),

  // ── Session Recordings ──
  getSessionRecordings: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/session-recordings?${q.toString()}`);
  },
  getSessionRecording: (id: number) => request(`/session-recordings/${id}`),
  createSessionRecording: (data: any) => request('/session-recordings', { method: 'POST', body: JSON.stringify(data) }),
  updateSessionRecording: (id: number, data: any) => request(`/session-recordings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteSessionRecording: (id: number) => request(`/session-recordings/${id}`, { method: 'DELETE' }),
  restoreSessionRecording: (id: number) => request(`/session-recordings/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteSessionRecording: (id: number) => request(`/session-recordings/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // FAQ CATEGORIES
  // ══════════════════════════════════════════════
  getFaqCategories: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/faq-categories?${q.toString()}`);
  },
  getFaqCategory: (id: number) => request(`/faq-categories/${id}`),
  createFaqCategory: (data: any) => request('/faq-categories', { method: 'POST', body: JSON.stringify(data) }),
  updateFaqCategory: (id: number, data: any) => request(`/faq-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteFaqCategory: (id: number) => request(`/faq-categories/${id}`, { method: 'DELETE' }),
  restoreFaqCategory: (id: number) => request(`/faq-categories/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteFaqCategory: (id: number) => request(`/faq-categories/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // FAQS
  // ══════════════════════════════════════════════
  getFaqs: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/faqs?${q.toString()}`);
  },
  getFaq: (id: number) => request(`/faqs/${id}`),
  createFaq: (data: any) => request('/faqs', { method: 'POST', body: JSON.stringify(data) }),
  updateFaq: (id: number, data: any) => request(`/faqs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteFaq: (id: number) => request(`/faqs/${id}`, { method: 'DELETE' }),
  restoreFaq: (id: number) => request(`/faqs/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteFaq: (id: number) => request(`/faqs/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // FAQ CATEGORY TRANSLATIONS
  // ══════════════════════════════════════════════
  getFaqCategoryTranslations: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/faq-category-translations?${q.toString()}`);
  },
  getFaqCategoryTranslation: (id: number) => request(`/faq-category-translations/${id}`),
  getFaqCategoryTranslationCoverage: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/faq-category-translations/coverage?${q.toString()}`);
  },
  createFaqCategoryTranslation: (data: any) => request('/faq-category-translations', { method: 'POST', body: JSON.stringify(data) }),
  updateFaqCategoryTranslation: (id: number, data: any) => request(`/faq-category-translations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteFaqCategoryTranslation: (id: number) => request(`/faq-category-translations/${id}`, { method: 'DELETE' }),
  restoreFaqCategoryTranslation: (id: number) => request(`/faq-category-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteFaqCategoryTranslation: (id: number) => request(`/faq-category-translations/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // FAQ TRANSLATIONS
  // ══════════════════════════════════════════════
  getFaqTranslations: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/faq-translations?${q.toString()}`);
  },
  getFaqTranslation: (id: number) => request(`/faq-translations/${id}`),
  getFaqTranslationCoverage: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/faq-translations/coverage?${q.toString()}`);
  },
  createFaqTranslation: (data: any) => request('/faq-translations', { method: 'POST', body: JSON.stringify(data) }),
  updateFaqTranslation: (id: number, data: any) => request(`/faq-translations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteFaqTranslation: (id: number) => request(`/faq-translations/${id}`, { method: 'DELETE' }),
  restoreFaqTranslation: (id: number) => request(`/faq-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteFaqTranslation: (id: number) => request(`/faq-translations/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // BLOG CATEGORIES
  // ══════════════════════════════════════════════
  getBlogCategories: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/blog-categories?${q.toString()}`);
  },
  getBlogCategory: (id: number) => request(`/blog-categories/${id}`),
  createBlogCategory: (data: any) => request('/blog-categories', { method: 'POST', body: JSON.stringify(data) }),
  updateBlogCategory: (id: number, data: any) => request(`/blog-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteBlogCategory: (id: number) => request(`/blog-categories/${id}`, { method: 'DELETE' }),
  restoreBlogCategory: (id: number) => request(`/blog-categories/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteBlogCategory: (id: number) => request(`/blog-categories/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // BLOG POSTS
  // ══════════════════════════════════════════════
  getBlogPosts: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/blog-posts?${q.toString()}`);
  },
  getBlogPost: (id: number) => request(`/blog-posts/${id}`),
  // Phase 45 — these send multipart FormData (OG image upload). Without
  // isFormData:true the wrapper forced Content-Type: application/json, which
  // stripped the multipart boundary → server couldn't parse → "Failed to fetch".
  createBlogPost: (data: FormData) => request('/blog-posts', { method: 'POST', body: data, isFormData: true }),
  updateBlogPost: (id: number, data: FormData) => request(`/blog-posts/${id}`, { method: 'PATCH', body: data, isFormData: true }),
  publishBlogPost: (id: number) => request(`/blog-posts/${id}/publish`, { method: 'PATCH' }),
  archiveBlogPost: (id: number) => request(`/blog-posts/${id}/archive`, { method: 'PATCH' }),
  softDeleteBlogPost: (id: number) => request(`/blog-posts/${id}`, { method: 'DELETE' }),
  restoreBlogPost: (id: number) => request(`/blog-posts/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteBlogPost: (id: number) => request(`/blog-posts/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // BLOG REVIEWS
  // ══════════════════════════════════════════════
  getBlogReviews: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/blog-reviews?${q.toString()}`);
  },
  getBlogReview: (id: number) => request(`/blog-reviews/${id}`),
  getBlogReviewStats: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/blog-reviews/stats?${q.toString()}`);
  },
  createBlogReview: (data: any) => request('/blog-reviews', { method: 'POST', body: JSON.stringify(data) }),
  updateBlogReview: (id: number, data: any) => request(`/blog-reviews/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  changeBlogReviewStatus: (id: number, status: string) => request(`/blog-reviews/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  softDeleteBlogReview: (id: number) => request(`/blog-reviews/${id}/soft-delete`, { method: 'PATCH' }),
  restoreBlogReview: (id: number) => request(`/blog-reviews/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteBlogReview: (id: number) => request(`/blog-reviews/${id}`, { method: 'DELETE' }),
  recalculateBlogReviewRatings: (blogPostId: number) => request('/blog-reviews/recalculate', { method: 'POST', body: JSON.stringify({ blog_post_id: blogPostId }) }),

  // ══════════════════════════════════════════════
  // POLICY TYPES
  // ══════════════════════════════════════════════
  getPolicyTypes: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/policy-types?${q.toString()}`);
  },
  getPolicyType: (id: number) => request(`/policy-types/${id}`),
  createPolicyType: (data: any) => request('/policy-types', { method: 'POST', body: JSON.stringify(data) }),
  updatePolicyType: (id: number, data: any) => request(`/policy-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeletePolicyType: (id: number) => request(`/policy-types/${id}`, { method: 'DELETE' }),
  restorePolicyType: (id: number) => request(`/policy-types/${id}/restore`, { method: 'PATCH' }),
  permanentDeletePolicyType: (id: number) => request(`/policy-types/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // POLICY TYPE TRANSLATIONS
  // ══════════════════════════════════════════════
  getPolicyTypeTranslations: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/policy-type-translations?${q.toString()}`);
  },
  getPolicyTypeTranslation: (id: number) => request(`/policy-type-translations/${id}`),
  getPolicyTypeTranslationCoverage: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/policy-type-translations/coverage?${q.toString()}`);
  },
  createPolicyTypeTranslation: (data: any) => request('/policy-type-translations', { method: 'POST', body: JSON.stringify(data) }),
  updatePolicyTypeTranslation: (id: number, data: any) => request(`/policy-type-translations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeletePolicyTypeTranslation: (id: number) => request(`/policy-type-translations/${id}`, { method: 'DELETE' }),
  restorePolicyTypeTranslation: (id: number) => request(`/policy-type-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeletePolicyTypeTranslation: (id: number) => request(`/policy-type-translations/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // POLICIES
  // ══════════════════════════════════════════════
  getPolicies: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/policies?${q.toString()}`);
  },
  getPolicy: (id: number) => request(`/policies/${id}`),
  createPolicy: (data: any) => request('/policies', { method: 'POST', body: JSON.stringify(data) }),
  updatePolicy: (id: number, data: any) => request(`/policies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  publishPolicy: (id: number) => request(`/policies/${id}/publish`, { method: 'PATCH' }),
  archivePolicy: (id: number) => request(`/policies/${id}/archive`, { method: 'PATCH' }),
  softDeletePolicy: (id: number) => request(`/policies/${id}`, { method: 'DELETE' }),
  restorePolicy: (id: number) => request(`/policies/${id}/restore`, { method: 'PATCH' }),
  permanentDeletePolicy: (id: number) => request(`/policies/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // POLICY TRANSLATIONS
  // ══════════════════════════════════════════════
  getPolicyTranslations: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/policy-translations?${q.toString()}`);
  },
  getPolicyTranslation: (id: number) => request(`/policy-translations/${id}`),
  getPolicyTranslationCoverage: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/policy-translations/coverage?${q.toString()}`);
  },
  createPolicyTranslation: (data: any) => request('/policy-translations', { method: 'POST', body: JSON.stringify(data) }),
  updatePolicyTranslation: (id: number, data: any) => request(`/policy-translations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeletePolicyTranslation: (id: number) => request(`/policy-translations/${id}`, { method: 'DELETE' }),
  restorePolicyTranslation: (id: number) => request(`/policy-translations/${id}/restore`, { method: 'PATCH' }),
  permanentDeletePolicyTranslation: (id: number) => request(`/policy-translations/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // TICKET CATEGORIES
  // ══════════════════════════════════════════════
  getTicketCategories: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/ticket-categories?${q.toString()}`);
  },
  getTicketCategory: (id: number) => request(`/ticket-categories/${id}`),
  createTicketCategory: (data: any) => request('/ticket-categories', { method: 'POST', body: JSON.stringify(data) }),
  updateTicketCategory: (id: number, data: any) => request(`/ticket-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteTicketCategory: (id: number) => request(`/ticket-categories/${id}`, { method: 'DELETE' }),
  restoreTicketCategory: (id: number) => request(`/ticket-categories/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteTicketCategory: (id: number) => request(`/ticket-categories/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // TICKET PRIORITIES
  // ══════════════════════════════════════════════
  getTicketPriorities: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/ticket-priorities?${q.toString()}`);
  },
  getTicketPriority: (id: number) => request(`/ticket-priorities/${id}`),
  createTicketPriority: (data: any) => request('/ticket-priorities', { method: 'POST', body: JSON.stringify(data) }),
  updateTicketPriority: (id: number, data: any) => request(`/ticket-priorities/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteTicketPriority: (id: number) => request(`/ticket-priorities/${id}`, { method: 'DELETE' }),
  restoreTicketPriority: (id: number) => request(`/ticket-priorities/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteTicketPriority: (id: number) => request(`/ticket-priorities/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // SUPPORT TICKETS
  // ══════════════════════════════════════════════
  getSupportTickets: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/support-tickets?${q.toString()}`);
  },
  getSupportTicket: (id: number) => request(`/support-tickets/${id}`),
  getSupportTicketStats: () => request('/support-tickets/stats'),
  createSupportTicket: (data: any) => request('/support-tickets', { method: 'POST', body: JSON.stringify(data) }),
  supportTicketUserOptions: (search = '') => request(`/support-tickets/user-options?search=${encodeURIComponent(search)}&limit=20`),
  supportTicketRelatedOptions: (related_type: string, search = '') => request(`/support-tickets/related-options?related_type=${encodeURIComponent(related_type)}&search=${encodeURIComponent(search)}&limit=20`),
  updateSupportTicket: (id: number, data: any) => request(`/support-tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  changeSupportTicketStatus: (id: number, status: string, notes?: string) => request(`/support-tickets/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, notes }) }),
  assignSupportTicket: (id: number, assigned_to: number | null) => request(`/support-tickets/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ assigned_to }) }),
  softDeleteSupportTicket: (id: number) => request(`/support-tickets/${id}`, { method: 'DELETE' }),
  restoreSupportTicket: (id: number) => request(`/support-tickets/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteSupportTicket: (id: number) => request(`/support-tickets/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // USER TICKETS (user-facing, no RBAC)
  // ══════════════════════════════════════════════
  getUserTicketCategories: () => request('/user-tickets/categories'),
  getMyTickets: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/user-tickets?${q.toString()}`);
  },
  getMyTicket: (id: number) => request(`/user-tickets/${id}`),
  submitUserTicket: (data: any) => request('/user-tickets', { method: 'POST', body: JSON.stringify(data) }),
  replyToUserTicket: (id: number, message: string) => request(`/user-tickets/${id}/reply`, { method: 'POST', body: JSON.stringify({ message }) }),
  closeUserTicket: (id: number) => request(`/user-tickets/${id}/close`, { method: 'PATCH' }),

  // ══════════════════════════════════════════════
  // TICKET MESSAGES
  // ══════════════════════════════════════════════
  getTicketMessages: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/ticket-messages?${q.toString()}`);
  },
  getTicketMessage: (id: number) => request(`/ticket-messages/${id}`),
  createTicketMessage: (data: any) => request('/ticket-messages', { method: 'POST', body: JSON.stringify(data) }),
  updateTicketMessage: (id: number, data: any) => request(`/ticket-messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteTicketMessage: (id: number) => request(`/ticket-messages/${id}`, { method: 'DELETE' }),
  restoreTicketMessage: (id: number) => request(`/ticket-messages/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteTicketMessage: (id: number) => request(`/ticket-messages/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // TICKET ATTACHMENTS
  // ══════════════════════════════════════════════
  getTicketAttachments: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/ticket-attachments?${q.toString()}`);
  },
  getTicketAttachment: (id: number) => request(`/ticket-attachments/${id}`),
  createTicketAttachment: (data: any) => request('/ticket-attachments', { method: 'POST', body: JSON.stringify(data) }),
  uploadTicketAttachment: (ticketId: number, file: File, onProgress?: (pct: number) => void): Promise<any> => {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append('file', file, file.name);
      fd.append('ticket_id', String(ticketId));
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/ticket-attachments/upload`);
      if (tokens.access) xhr.setRequestHeader('Authorization', `Bearer ${tokens.access}`);
      if (onProgress) xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => { try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('Invalid response')); } };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(fd);
    });
  },
  deleteTicketAttachment: (id: number) => request(`/ticket-attachments/${id}`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // STICKER CATEGORIES
  // ══════════════════════════════════════════════
  getStickerCategories: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/sticker-categories?${q.toString()}`);
  },
  getStickerCategory: (id: number) => request(`/sticker-categories/${id}`),
  createStickerCategory: (data: any, isFormData = false) => request('/sticker-categories', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateStickerCategory: (id: number, data: any, isFormData = false) => request(`/sticker-categories/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  softDeleteStickerCategory: (id: number) => request(`/sticker-categories/${id}`, { method: 'DELETE' }),
  restoreStickerCategory: (id: number) => request(`/sticker-categories/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteStickerCategory: (id: number) => request(`/sticker-categories/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // STICKERS
  // ══════════════════════════════════════════════
  getStickers: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/stickers?${q.toString()}`);
  },
  getSticker: (id: number) => request(`/stickers/${id}`),
  createSticker: (data: any, isFormData = false) => request('/stickers', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateSticker: (id: number, data: any, isFormData = false) => request(`/stickers/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  softDeleteSticker: (id: number) => request(`/stickers/${id}`, { method: 'DELETE' }),
  restoreSticker: (id: number) => request(`/stickers/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteSticker: (id: number) => request(`/stickers/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // EMOJI CATEGORIES
  // ══════════════════════════════════════════════
  getEmojiCategories: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/emoji-categories?${q.toString()}`);
  },
  getEmojiCategory: (id: number) => request(`/emoji-categories/${id}`),
  createEmojiCategory: (data: any) => request('/emoji-categories', { method: 'POST', body: JSON.stringify(data) }),
  updateEmojiCategory: (id: number, data: any) => request(`/emoji-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteEmojiCategory: (id: number) => request(`/emoji-categories/${id}`, { method: 'DELETE' }),
  restoreEmojiCategory: (id: number) => request(`/emoji-categories/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteEmojiCategory: (id: number) => request(`/emoji-categories/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // CUSTOM EMOJIS
  // ══════════════════════════════════════════════
  getCustomEmojis: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/custom-emojis?${q.toString()}`);
  },
  getCustomEmoji: (id: number) => request(`/custom-emojis/${id}`),
  createCustomEmoji: (data: any, isFormData = false) => request('/custom-emojis', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateCustomEmoji: (id: number, data: any, isFormData = false) => request(`/custom-emojis/${id}`, { method: 'PATCH', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  softDeleteCustomEmoji: (id: number) => request(`/custom-emojis/${id}`, { method: 'DELETE' }),
  restoreCustomEmoji: (id: number) => request(`/custom-emojis/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteCustomEmoji: (id: number) => request(`/custom-emojis/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // QUICK REPLIES
  // ══════════════════════════════════════════════
  getQuickReplies: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/quick-replies?${q.toString()}`);
  },
  getQuickReply: (id: number) => request(`/quick-replies/${id}`),
  createQuickReply: (data: any) => request('/quick-replies', { method: 'POST', body: JSON.stringify(data) }),
  updateQuickReply: (id: number, data: any) => request(`/quick-replies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteQuickReply: (id: number) => request(`/quick-replies/${id}`, { method: 'DELETE' }),
  restoreQuickReply: (id: number) => request(`/quick-replies/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteQuickReply: (id: number) => request(`/quick-replies/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // CHAT ROOMS
  // ══════════════════════════════════════════════
  getChatRooms: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/chat-rooms?${q.toString()}`);
  },
  getChatRoom: (id: number) => request(`/chat-rooms/${id}`),
  createChatRoom: (data: any) => request('/chat-rooms', { method: 'POST', body: JSON.stringify(data) }),
  updateChatRoom: (id: number, data: any) => request(`/chat-rooms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteChatRoom: (id: number) => request(`/chat-rooms/${id}`, { method: 'DELETE' }),
  restoreChatRoom: (id: number) => request(`/chat-rooms/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteChatRoom: (id: number) => request(`/chat-rooms/${id}/permanent`, { method: 'DELETE' }),
  createBatchRoom: (data: any) => request('/chat-rooms/batch-room', { method: 'POST', body: JSON.stringify(data) }),
  syncBatchMembers: (roomId: number) => request(`/chat-rooms/${roomId}/sync-batch`, { method: 'POST' }),

  // ══════════════════════════════════════════════
  // CHAT MEMBERS
  // ══════════════════════════════════════════════
  getChatMembers: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/chat-members?${q.toString()}`);
  },
  getChatMember: (id: number) => request(`/chat-members/${id}`),
  addChatMember: (data: any) => request('/chat-members', { method: 'POST', body: JSON.stringify(data) }),
  updateChatMember: (id: number, data: any) => request(`/chat-members/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeChatMember: (id: number) => request(`/chat-members/${id}`, { method: 'DELETE' }),
  bulkAddChatMembers: (data: any) => request('/chat-members/bulk', { method: 'POST', body: JSON.stringify(data) }),

  // ══════════════════════════════════════════════
  // CHAT MESSAGES
  // ══════════════════════════════════════════════
  getChatMessages: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/chat-messages?${q.toString()}`);
  },
  getChatMessage: (id: number) => request(`/chat-messages/${id}`),
  getChatMessagesByRoom: (roomId: number, params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/chat-messages/room/${roomId}?${q.toString()}`);
  },
  getPinnedMessages: (roomId: number) => request(`/chat-messages/room/${roomId}/pinned`),
  getMessageThread: (messageId: number) => request(`/chat-messages/${messageId}/thread`),
  sendChatMessage: (data: any, isFormData = false) => request('/chat-messages', { method: 'POST', body: isFormData ? data as any : JSON.stringify(data), isFormData }),
  updateChatMessage: (id: number, data: any) => request(`/chat-messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  togglePinMessage: (id: number) => request(`/chat-messages/${id}/pin`, { method: 'PATCH' }),
  softDeleteChatMessage: (id: number) => request(`/chat-messages/${id}`, { method: 'DELETE' }),
  permanentDeleteChatMessage: (id: number) => request(`/chat-messages/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // CHAT REACTIONS
  // ══════════════════════════════════════════════
  getMessageReactions: (messageId: number) => request(`/chat-reactions/message/${messageId}`),
  toggleReaction: (data: any) => request('/chat-reactions', { method: 'POST', body: JSON.stringify(data) }),
  removeReaction: (id: number) => request(`/chat-reactions/${id}`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // CHAT READ RECEIPTS
  // ══════════════════════════════════════════════
  getRoomReadReceipts: (roomId: number) => request(`/chat-read-receipts/room/${roomId}`),
  markMessagesRead: (data: any) => request('/chat-read-receipts', { method: 'POST', body: JSON.stringify(data) }),
  getUnreadCounts: () => request('/chat-read-receipts/unread-count'),

  // ══════════════════════════════════════════════
  // CHAT INVITES
  // ══════════════════════════════════════════════
  getChatInvites: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/chat-invites?${q.toString()}`);
  },
  getChatInvite: (id: number) => request(`/chat-invites/${id}`),
  createChatInvite: (data: any) => request('/chat-invites', { method: 'POST', body: JSON.stringify(data) }),
  revokeChatInvite: (id: number) => request(`/chat-invites/${id}/revoke`, { method: 'PATCH' }),
  deleteChatInvite: (id: number) => request(`/chat-invites/${id}`, { method: 'DELETE' }),
  previewInvite: (token: string) => request(`/chat-invites/preview/${token}`),
  acceptInvite: (token: string) => request(`/chat-invites/accept/${token}`, { method: 'POST' }),
  joinRoomByCode: (inviteCode: string) => request('/chat-invites/join-by-code', { method: 'POST', body: JSON.stringify({ invite_code: inviteCode }) }),

  // ══════════════════════════════════════════════
  // ANNOUNCEMENTS
  // ══════════════════════════════════════════════
  getAnnouncements: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/announcements?${q.toString()}`);
  },
  getAnnouncement: (id: number) => request(`/announcements/${id}`),
  createAnnouncement: (data: any) => request('/announcements', { method: 'POST', body: JSON.stringify(data) }),
  updateAnnouncement: (id: number, data: any) => request(`/announcements/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteAnnouncement: (id: number) => request(`/announcements/${id}`, { method: 'DELETE' }),
  restoreAnnouncement: (id: number) => request(`/announcements/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteAnnouncement: (id: number) => request(`/announcements/${id}/permanent`, { method: 'DELETE' }),
  publishAnnouncement: (id: number) => request(`/announcements/${id}/publish`, { method: 'POST' }),
  archiveAnnouncement: (id: number) => request(`/announcements/${id}/archive`, { method: 'POST' }),
  getAnnouncementStats: (id: number) => request(`/announcements/${id}/stats`),
  getAnnouncementReads: (id: number, params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/announcements/${id}/reads?${q.toString()}`);
  },

  // ══════════════════════════════════════════════
  // WALLETS
  // ══════════════════════════════════════════════
  getWallets: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/wallets?${q.toString()}`);
  },
  getWallet: (id: number) => request(`/wallets/${id}`),
  getWalletByUserId: (userId: number) => request(`/wallets/user/${userId}`),
  createWallet: (data: any) => request('/wallets', { method: 'POST', body: JSON.stringify(data) }),
  updateWallet: (id: number, data: any) => request(`/wallets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDeleteWallet: (id: number) => request(`/wallets/${id}`, { method: 'DELETE' }),
  restoreWallet: (id: number) => request(`/wallets/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteWallet: (id: number) => request(`/wallets/${id}/permanent`, { method: 'DELETE' }),
  toggleFreezeWallet: (id: number, body?: { reason: string }) => request(`/wallets/${id}/freeze`, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  walletManualCredit: (id: number, data: any) => request(`/wallets/${id}/credit`, { method: 'POST', body: JSON.stringify(data) }),
  walletManualDebit: (id: number, data: any) => request(`/wallets/${id}/debit`, { method: 'POST', body: JSON.stringify(data) }),

  // ══════════════════════════════════════════════
  // WALLET TRANSACTIONS
  // ══════════════════════════════════════════════
  getWalletTransactions: (params?: Record<string, any>) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return request(`/wallet-transactions?${q.toString()}`);
  },
  getWalletTransaction: (id: number) => request(`/wallet-transactions/${id}`),
  reverseWalletTransaction: (id: number) => request(`/wallet-transactions/${id}/reverse`, { method: 'POST' }),
  softDeleteWalletTransaction: (id: number) => request(`/wallet-transactions/${id}`, { method: 'DELETE' }),
  restoreWalletTransaction: (id: number) => request(`/wallet-transactions/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteWalletTransaction: (id: number) => request(`/wallet-transactions/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // PODCASTS
  // ══════════════════════════════════════════════
  listPodcasts: (qs = '') => request(`/podcasts${qs}`),
  getPodcast: (id: number) => request(`/podcasts/${id}`, { auth: false }),
  createPodcast: (data: any) => request('/podcasts', { method: 'POST', body: JSON.stringify(data) }),
  updatePodcast: (id: number, data: any) => request(`/podcasts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  uploadPodcastVideo: (id: number, file: File, onProgress?: (p: number) => void) => _uploadCourseVideoXhr(`/podcasts/${id}/video`, file, onProgress),
  removePodcastVideo: (id: number) => request(`/podcasts/${id}/video`, { method: 'DELETE' }),
  uploadPodcastThumbnail: (id: number, file: File) => { const fd = new FormData(); fd.append('thumbnail', file); return request(`/podcasts/${id}/thumbnail`, { method: 'POST', body: fd as any, isFormData: true }); },
  removePodcastThumbnail: (id: number) => request(`/podcasts/${id}/thumbnail`, { method: 'DELETE' }),
  podcastPlayback: (id: number) => request(`/podcasts/${id}/playback`, { auth: false }),
  markPodcastComingSoon: (id: number) => request(`/podcasts/${id}/coming-soon`, { method: 'PATCH' }),
  submitPodcast: (id: number) => request(`/podcasts/${id}/submit`, { method: 'PATCH' }),
  approvePodcast: (id: number) => request(`/podcasts/${id}/approve`, { method: 'PATCH' }),
  rejectPodcast: (id: number) => request(`/podcasts/${id}/reject`, { method: 'PATCH' }),
  publishPodcast: (id: number) => request(`/podcasts/${id}/publish`, { method: 'PATCH' }),
  archivePodcast: (id: number) => request(`/podcasts/${id}/archive`, { method: 'PATCH' }),
  softDeletePodcast: (id: number) => request(`/podcasts/${id}`, { method: 'DELETE' }),
  restorePodcast: (id: number) => request(`/podcasts/${id}/restore`, { method: 'PATCH' }),
  deletePodcast: (id: number) => request(`/podcasts/${id}/permanent`, { method: 'DELETE' }),

  // ══════════════════════════════════════════════
  // CRON / SCHEDULED JOBS
  // ══════════════════════════════════════════════
  getCronStatus: () => request('/cron/status'),
  getCronJobs: () => request('/cron/jobs'),
  triggerCronJob: (name: string) => request(`/cron/${name}/trigger`, { method: 'POST' }),

  // ══════════════════════════════════════════════
  // SITE SETTINGS — Section Visibility
  // ══════════════════════════════════════════════
  listSiteSettings: () => request('/site-settings'),
  updateSiteSettings: (id: number, is_visible: boolean) => request(`/site-settings/${id}`, { method: 'PATCH', body: JSON.stringify({ is_visible }) }),

};
