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

  // AI — Auto Sub Topics from HTML
  autoSubTopics: (fd: FormData) =>
    request('/ai/auto-sub-topics', { method: 'POST', body: fd, isFormData: true }),

  // AI — Translate HTML page to all languages
  translatePage: (fd: FormData) =>
    request('/ai/translate-page', { method: 'POST', body: fd, isFormData: true }),

  // AI — Import Material Tree from TXT
  importMaterialTree: (fd: FormData) =>
    request('/ai/import-material-tree', { method: 'POST', body: fd, isFormData: true }),

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
};
