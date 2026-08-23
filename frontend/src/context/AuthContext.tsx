/**
 * AuthContext — Global authentication state
 *
 * Stores JWT token in sessionStorage (cleared on tab close).
 * User object is stored alongside token for quick access.
 *
 * Security notes:
 * - Token in sessionStorage (not localStorage — reduces XSS window)
 * - Permissions checked server-side on every request (frontend is hint only)
 * - 401 from API → auto-logout handled in api/client.ts
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, AuthTokenResponse } from '../types';
import { authApi } from '../api/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (tokenData: AuthTokenResponse) => void;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from sessionStorage on mount
  useEffect(() => {
    const savedToken = sessionStorage.getItem('crimelink_token');
    const savedUser = sessionStorage.getItem('crimelink_user');

    if (savedToken && savedUser) {
      try {
        const parsedUser: User = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);
      } catch {
        sessionStorage.removeItem('crimelink_token');
        sessionStorage.removeItem('crimelink_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (tokenData: AuthTokenResponse) => {
    sessionStorage.setItem('crimelink_token', tokenData.access_token);

    // Build user object from token response
    const userObj: User = {
      id: tokenData.user_id,
      username: tokenData.username,
      full_name: tokenData.full_name,
      email: '',
      is_active: true,
      is_locked: false,
      roles: tokenData.roles,
      permissions: tokenData.permissions,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    sessionStorage.setItem('crimelink_user', JSON.stringify(userObj));
    setToken(tokenData.access_token);
    setUser(userObj);
  };

  const logout = async () => {
    try {
      if (token) await authApi.logout();
    } catch {
      // Ignore logout API errors — clear client state regardless
    } finally {
      sessionStorage.removeItem('crimelink_token');
      sessionStorage.removeItem('crimelink_user');
      setToken(null);
      setUser(null);
    }
  };

  const hasPermission = (permission: string): boolean => {
    return user?.permissions?.includes(permission) ?? false;
  };

  const hasRole = (role: string): boolean => {
    return user?.roles?.includes(role) ?? false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
