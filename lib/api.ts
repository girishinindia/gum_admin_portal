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
  createCourse: (data: any) => request('/courses', { method: 'POST', body: JSON.stringify(data) }),
  updateCourse: (id: number, data: any) => request(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
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
  autoTranslateExercise: (data: { exercise_id?: number; exercise_ids?: number[]; provider?: string }) =>
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

  // Employee Profiles
  listEmployeeProfiles: (qs = '') => request(`/employee-profiles${qs}`),
  getEmployeeProfile: (id: number) => request(`/employee-profiles/${id}`),
  getEmployeeProfileByUserId: (userId: number) => request(`/employee-profiles/user/${userId}`),
  upsertEmployeeProfile: (userId: number, data: any) => request(`/employee-profiles/user/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  createEmployeeProfile: (data: any) => request('/employee-profiles', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployeeProfile: (id: number, data: any) => request(`/employee-profiles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEmployeeProfile: (id: number) => request(`/employee-profiles/${id}`, { method: 'DELETE' }),
  restoreEmployeeProfile: (id: number) => request(`/employee-profiles/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteEmployeeProfile: (id: number) => request(`/employee-profiles/${id}/permanent`, { method: 'DELETE' }),

  // Student Profiles
  listStudentProfiles: (qs = '') => request(`/student-profiles${qs}`),
  getStudentProfile: (id: number) => request(`/student-profiles/${id}`),
  getStudentProfileByUserId: (userId: number) => request(`/student-profiles/user/${userId}`),
  upsertStudentProfile: (userId: number, data: any) => request(`/student-profiles/user/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  createStudentProfile: (data: any) => request('/student-profiles', { method: 'POST', body: JSON.stringify(data) }),
  updateStudentProfile: (id: number, data: any) => request(`/student-profiles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteStudentProfile: (id: number) => request(`/student-profiles/${id}`, { method: 'DELETE' }),
  restoreStudentProfile: (id: number) => request(`/student-profiles/${id}/restore`, { method: 'PATCH' }),
  permanentDeleteStudentProfile: (id: number) => request(`/student-profiles/${id}/permanent`, { method: 'DELETE' }),

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
    return fetch(`${API_URL}/assessment-exercises/create-full`, { method: 'POST', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
  },
  updateFullExercise: (id: number, data: any, file?: File, fileSolution?: File) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
    if (file) fd.append('file', file, file.name);
    if (fileSolution) fd.append('file_solution', fileSolution, fileSolution.name);
    return fetch(`${API_URL}/assessment-exercises/${id}/update-full`, { method: 'PUT', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
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
      return fetch(`${API_URL}/assessment-exercise-translations`, { method: 'POST', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
    }
    return request('/assessment-exercise-translations', { method: 'POST', body: JSON.stringify(data) });
  },
  updateExerciseTranslation: (id: number, data: any, file?: File, fileSolution?: File) => {
    if (file || fileSolution) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      if (file) fd.append('file', file, file.name);
      if (fileSolution) fd.append('file_solution', fileSolution, fileSolution.name);
      return fetch(`${API_URL}/assessment-exercise-translations/${id}`, { method: 'PATCH', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
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
    return fetch(`${API_URL}/assessment-mini-projects/create-full`, { method: 'POST', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
  },
  updateFullMiniProject: (id: number, data: any, file?: File, fileSolution?: File) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
    if (file) fd.append('file', file, file.name);
    if (fileSolution) fd.append('file_solution', fileSolution, fileSolution.name);
    return fetch(`${API_URL}/assessment-mini-projects/${id}/update-full`, { method: 'PUT', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
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
      return fetch(`${API_URL}/assessment-mini-project-translations`, { method: 'POST', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
    }
    return request('/assessment-mini-project-translations', { method: 'POST', body: JSON.stringify(data) });
  },
  updateMiniProjectTranslation: (id: number, data: any, file?: File) => {
    if (file) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      fd.append('file', file, file.name);
      return fetch(`${API_URL}/assessment-mini-project-translations/${id}`, { method: 'PATCH', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
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
      return fetch(`${API_URL}/assessment-mini-project-solutions`, { method: 'POST', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
    }
    return request('/assessment-mini-project-solutions', { method: 'POST', body: JSON.stringify(data) });
  },
  updateMiniProjectSolution: (id: number, data: any, videoFile?: File, thumbnailFile?: File) => {
    if (videoFile || thumbnailFile) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      if (videoFile) fd.append('video_file', videoFile, videoFile.name);
      if (thumbnailFile) fd.append('thumbnail_file', thumbnailFile, thumbnailFile.name);
      return fetch(`${API_URL}/assessment-mini-project-solutions/${id}`, { method: 'PATCH', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
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
    return fetch(`${API_URL}/assessment-mini-project-solutions/bulk-upload`, { method: 'POST', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
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
    return fetch(`${API_URL}/assessment-capstone-projects/create-full`, { method: 'POST', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
  },
  updateFullCapstoneProject: (id: number, data: any, file?: File, fileSolution?: File) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
    if (file) fd.append('file', file, file.name);
    if (fileSolution) fd.append('file_solution', fileSolution, fileSolution.name);
    return fetch(`${API_URL}/assessment-capstone-projects/${id}/update-full`, { method: 'PUT', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
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
      return fetch(`${API_URL}/assessment-capstone-project-translations`, { method: 'POST', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
    }
    return request('/assessment-capstone-project-translations', { method: 'POST', body: JSON.stringify(data) });
  },
  updateCapstoneProjectTranslation: (id: number, data: any, file?: File) => {
    if (file) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      fd.append('file', file, file.name);
      return fetch(`${API_URL}/assessment-capstone-project-translations/${id}`, { method: 'PATCH', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
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
      return fetch(`${API_URL}/assessment-capstone-project-solutions`, { method: 'POST', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
    }
    return request('/assessment-capstone-project-solutions', { method: 'POST', body: JSON.stringify(data) });
  },
  updateCapstoneProjectSolution: (id: number, data: any, videoFile?: File, thumbnailFile?: File) => {
    if (videoFile || thumbnailFile) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
      if (videoFile) fd.append('video_file', videoFile, videoFile.name);
      if (thumbnailFile) fd.append('thumbnail_file', thumbnailFile, thumbnailFile.name);
      return fetch(`${API_URL}/assessment-capstone-project-solutions/${id}`, { method: 'PATCH', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
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
    return fetch(`${API_URL}/assessment-capstone-project-solutions/bulk-upload`, { method: 'POST', headers: { ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}) }, body: fd }).then(r => r.json());
  },

};
