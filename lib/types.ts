export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: any;
  pagination?: { total: number; page: number; limit: number; totalPages: number };
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  display_name?: string | null;
  email: string;
  mobile: string;
  avatar_url?: string | null;
  status: 'active' | 'inactive' | 'suspended';
  type: 'employee' | 'instructor' | 'student';
  locale: 'en' | 'hi' | 'gu';
  preferences?: any;
  last_login_at?: string;
  last_login_method?: string;
  login_count: number;
  created_at: string;
  deleted_at?: string | null;
  roles?: Array<{ role: string; display_name: string; level: number }>;
  max_role_level?: number;
  profile_image_url?: string | null;
}

export interface Role {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  level: number;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  permissions?: RolePermission[];
}

export interface Permission {
  id: number;
  resource: string;
  action: string;
  display_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface RolePermission {
  id: number;
  permission_id: number;
  conditions?: any;
  created_at: string;
  permissions?: Permission;
}

export interface Country {
  id: number;
  name: string;
  iso2: string;
  iso3: string;
  phone_code?: string;
  nationality?: string;
  national_language?: string;
  languages?: string[];
  tld?: string;
  currency?: string;
  currency_name?: string;
  currency_symbol?: string;
  flag_image?: string | null;
  is_active: boolean;
  sort_order: number;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface State {
  id: number;
  country_id: number;
  name: string;
  state_code?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  countries?: { name: string; iso2: string };
}

export interface City {
  id: number;
  state_id: number;
  name: string;
  phonecode?: string;
  timezone?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  states?: { name: string; state_code?: string; country_id: number; countries?: { name: string; iso2: string } };
}

export interface Skill {
  id: number;
  name: string;
  category: 'technical' | 'soft_skill' | 'tool' | 'framework' | 'language' | 'domain' | 'certification' | 'other';
  description?: string;
  icon?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Language {
  id: number;
  name: string;
  native_name?: string;
  iso_code?: string;
  script?: string;
  for_material: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface EducationLevel {
  id: number;
  name: string;
  abbreviation?: string;
  level_order: number;
  level_category: 'pre_school' | 'school' | 'diploma' | 'undergraduate' | 'postgraduate' | 'doctoral' | 'professional' | 'informal' | 'other';
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface DocumentType {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Document {
  id: number;
  document_type_id: number;
  name: string;
  description?: string;
  file_url?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  document_types?: { name: string };
}

export interface Designation {
  id: number;
  name: string;
  code?: string;
  level: number;
  level_band: 'intern' | 'entry' | 'mid' | 'senior' | 'lead' | 'manager' | 'director' | 'executive';
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Specialization {
  id: number;
  name: string;
  category: 'technology' | 'data' | 'design' | 'business' | 'language' | 'science' | 'mathematics' | 'arts' | 'health' | 'exam_prep' | 'professional' | 'other';
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface LearningGoal {
  id: number;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface SocialMedia {
  id: number;
  name: string;
  code: string;
  base_url?: string;
  icon?: string | null;
  placeholder?: string;
  platform_type: 'social' | 'professional' | 'code' | 'video' | 'blog' | 'portfolio' | 'messaging' | 'website' | 'other';
  display_order: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Category {
  id: number;
  code: string;
  slug: string;
  english_name?: string | null;
  display_order: number;
  image?: string | null;
  is_new: boolean;
  new_until?: string | null;
  og_site_name?: string | null;
  og_type?: string | null;
  twitter_site?: string | null;
  twitter_card?: string | null;
  robots_directive?: string | null;
  is_active: boolean;

  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface SubCategory {
  id: number;
  category_id: number;
  code: string;
  slug: string;
  english_name?: string | null;
  display_order: number;
  image?: string | null;
  is_new: boolean;
  new_until?: string | null;
  og_site_name?: string | null;
  og_type?: string | null;
  twitter_site?: string | null;
  twitter_card?: string | null;
  robots_directive?: string | null;
  is_active: boolean;

  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  categories?: { code: string; slug: string };
}

export interface CategoryTranslation {
  id: number;
  category_id: number;
  language_id: number;
  name: string;
  description?: string | null;
  is_new_title?: string | null;
  tags?: any;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  canonical_url?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  og_url?: string | null;
  twitter_title?: string | null;
  twitter_description?: string | null;
  twitter_image?: string | null;
  focus_keyword?: string | null;
  structured_data?: any;
  is_active: boolean;

  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  categories?: { code: string; slug: string };
  languages?: { name: string; native_name?: string; iso_code?: string };
}

export interface SubCategoryTranslation {
  id: number;
  sub_category_id: number;
  language_id: number;
  name: string;
  description?: string | null;
  is_new_title?: string | null;
  tags?: any;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  canonical_url?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  og_url?: string | null;
  twitter_title?: string | null;
  twitter_description?: string | null;
  twitter_image?: string | null;
  focus_keyword?: string | null;
  structured_data?: any;
  is_active: boolean;

  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  sub_categories?: { code: string; slug: string; image?: string | null; category_id: number; categories?: { code: string; slug: string } };
  languages?: { name: string; native_name?: string; iso_code?: string };
}

export interface Branch {
  id: number;
  country_id?: number | null;
  state_id?: number | null;
  city_id?: number | null;
  branch_manager_id?: number | null;
  name: string;
  code: string;
  branch_type: 'headquarters' | 'office' | 'campus' | 'remote' | 'warehouse' | 'other';
  address_line_1?: string | null;
  address_line_2?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  google_maps_url?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  countries?: { name: string; iso2: string };
  states?: { name: string; state_code?: string };
  cities?: { name: string };
  users?: { full_name: string; email: string };
}

export interface Department {
  id: number;
  parent_department_id?: number | null;
  head_user_id?: number | null;
  name: string;
  code: string;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  parent?: { id: number; name: string; code: string } | null;
  head?: { full_name: string; email: string } | null;
}

export interface BranchDepartment {
  id: number;
  branch_id: number;
  department_id: number;
  local_head_user_id?: number | null;
  employee_capacity?: number | null;
  floor_or_wing?: string | null;
  extension_number?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  branches?: { name: string; code: string; branch_type: string };
  departments?: { name: string; code: string };
  local_head?: { full_name: string; email: string } | null;
}

export interface ActivityLog {
  id: number;
  action: string;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
  device_type?: string;
  metadata?: any;
  user_id?: number;
  actor_id?: number;
  identifier?: string;
  target_type?: string;
  target_id?: number;
  target_name?: string;
  changes?: any;
  resource_type?: string;
  resource_id?: number;
  resource_name?: string;
  level?: string;
  source?: string;
  message?: string;
  endpoint?: string;
  http_method?: string;
  status_code?: number;
  response_time?: number;
}

export interface Session {
  session_id: number;
  user_id: number;
  full_name: string;
  login_method: string;
  device_type?: string;
  ip_address?: string;
  last_active_at: string;
  created_at: string;
  expires_at: string;
}

export interface Subject {
  id: number;
  code: string;
  slug: string;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'all_levels';
  estimated_hours?: number | null;
  display_order: number;
  sort_order: number;
  view_count: number;
  is_active: boolean;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  english_name?: string | null;
}

export interface Chapter {
  id: number;
  subject_id: number;
  slug: string;
  display_order: number;
  sort_order: number;
  is_active: boolean;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  subjects?: { code: string; slug: string };
  english_name?: string | null;
}

export interface Topic {
  id: number;
  chapter_id?: number | null;
  slug: string;
  display_order: number;
  sort_order: number;
  is_active: boolean;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  chapters?: { slug: string; subject_id: number };
  english_name?: string | null;
}

export interface SubjectTranslation {
  id: number;
  subject_id: number;
  language_id: number;
  name: string;
  short_intro?: string | null;
  long_intro?: string | null;
  image?: string | null;
  is_active: boolean;
  sort_order: number;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  subjects?: { code: string; slug: string };
  languages?: { name: string; native_name?: string; iso_code?: string };
}

export interface ChapterTranslation {
  id: number;
  chapter_id: number;
  language_id: number;
  name: string;
  short_intro?: string | null;
  long_intro?: string | null;
  prerequisites?: string | null;
  learning_objectives?: string | null;
  image?: string | null;
  is_active: boolean;
  sort_order: number;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  chapters?: { slug: string; subject_id: number; subjects?: { code: string; slug: string } };
  languages?: { name: string; native_name?: string; iso_code?: string };
}

export interface TopicTranslation {
  id: number;
  topic_id: number;
  language_id: number;
  name: string;
  short_intro?: string | null;
  long_intro?: string | null;
  prerequisites?: string | null;
  learning_objectives?: string | null;
  image?: string | null;
  is_active: boolean;
  sort_order: number;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  topics?: { slug: string; chapter_id?: number | null; chapters?: { slug: string; subject_id: number; subjects?: { code: string; slug: string } } };
  languages?: { name: string; native_name?: string; iso_code?: string };
}

export interface SubTopic {
  id: number;
  topic_id: number;
  slug: string | null;
  display_order: number;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'all_levels';
  estimated_minutes: number | null;
  view_count: number;
  video_id: string | null;
  video_url: string | null;
  video_thumbnail_url: string | null;
  video_status: 'uploading' | 'processing' | 'ready' | 'failed' | null;
  youtube_url: string | null;
  video_source: 'bunny' | 'youtube' | null;
  is_active: boolean;
  deleted_at: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  // FK joins
  topics?: { slug: string; chapter_id: number };
  english_name?: string | null;
}

export interface SubTopicTranslation {
  id: number;
  sub_topic_id: number;
  language_id: number;
  name: string;
  short_intro: string | null;
  long_intro: string | null;
  image: string | null;
  video_title: string | null;
  video_description: string | null;
  video_thumbnail: string | null;
  video_duration_minutes: number | null;
  tags: string[] | null;
  page: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  canonical_url: string | null;
  og_site_name: string | null;
  og_title: string | null;
  og_description: string | null;
  og_type: string | null;
  og_image: string | null;
  og_url: string | null;
  twitter_site: string | null;
  twitter_title: string | null;
  twitter_description: string | null;
  twitter_image: string | null;
  twitter_card: string | null;
  robots_directive: string | null;
  focus_keyword: string | null;
  structured_data: any[] | null;
  is_active: boolean;
  sort_order: number;
  deleted_at: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  // FK joins
  sub_topics?: { slug: string; topic_id: number; topics?: { slug: string; chapter_id: number; chapters?: { slug: string; subject_id: number } } };
  languages?: { name: string; native_name: string; iso_code: string };
}

export interface YoutubeDescription {
  id: number;
  sub_topic_id: number;
  video_title: string | null;
  description: string | null;
  source_file_path: string | null;
  generated_by: number | null;
  created_at: string;
  updated_at: string;
  // FK joins
  sub_topics?: {
    id: number;
    slug: string;
    display_order: number;
    topic_id: number;
    topics?: {
      id: number;
      slug: string;
      chapter_id: number;
      chapters?: {
        id: number;
        slug: string;
        subject_id: number;
        subjects?: { id: number; slug: string; code: string };
      };
    };
  };
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: User;
}
