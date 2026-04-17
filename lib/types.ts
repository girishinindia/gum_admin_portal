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
  locale: 'en' | 'hi' | 'gu';
  preferences?: any;
  last_login_at?: string;
  last_login_method?: string;
  login_count: number;
  created_at: string;
  roles?: Array<{ role: string; display_name: string; level: number }>;
  max_role_level?: number;
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

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: User;
}
