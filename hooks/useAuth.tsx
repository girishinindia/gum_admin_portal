"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, tokens, userCache } from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthContext {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const cached = userCache.get();
    if (cached && tokens.access) { setUser(cached); refresh(); }
    else setLoading(false);
  }, []);

  async function refresh() {
    if (!tokens.access) { setLoading(false); return; }
    const res = await api.me();
    if (res.success && res.data) {
      setUser(res.data);
      userCache.set(res.data);
    }
    setLoading(false);
  }

  async function login(identifier: string, password: string) {
    const res = await api.login({ identifier, password });
    if (res.success && res.data) {
      tokens.set(res.data.access_token, res.data.refresh_token);
      userCache.set(res.data.user);
      const profile = await api.me();
      if (profile.success && profile.data) {
        setUser(profile.data);
        userCache.set(profile.data);
      } else {
        setUser(res.data.user);
      }
      return { success: true };
    }
    return { success: false, error: res.error || 'Login failed' };
  }

  async function logout() {
    try { await api.logout(); } catch {}
    tokens.clear();
    setUser(null);
    router.push('/login');
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
