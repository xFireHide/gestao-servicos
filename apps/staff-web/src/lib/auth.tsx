'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthTokens, JwtClaims, LoginInput } from '@clinica/shared';
import { api, clearTokens, getAccessToken, setTokens } from './api';

interface AuthState {
  user: JwtClaims | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<JwtClaims | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    api
      .get<JwtClaims>('/auth/me')
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const tokens = await api.post<AuthTokens>('/auth/login', input);
    setTokens(tokens);
    setUser(await api.get<JwtClaims>('/auth/me'));
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
