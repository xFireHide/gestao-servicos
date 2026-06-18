'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthTokens, JwtClaims, LoginInput, RegisterInput } from '@clinica/shared';
import { api, clearTokens, getAccessToken, setTokens } from './api';

interface AuthState {
  user: JwtClaims | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
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

  const hydrate = useCallback(async (tokens: AuthTokens) => {
    setTokens(tokens);
    setUser(await api.get<JwtClaims>('/auth/me'));
  }, []);

  const login = useCallback(
    async (input: LoginInput) => hydrate(await api.post<AuthTokens>('/auth/login', input)),
    [hydrate],
  );

  const register = useCallback(
    async (input: RegisterInput) => hydrate(await api.post<AuthTokens>('/auth/register', input)),
    [hydrate],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
