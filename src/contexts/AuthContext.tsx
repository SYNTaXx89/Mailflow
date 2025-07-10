/**
 * Authentication Context
 * 
 * Provides shared authentication state across the entire application
 * using React Context to ensure all components see the same auth state.
 */

import React, { createContext, useContext } from 'react';
import { useJWTAuth } from '../hooks/useJWTAuth';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshTokens: () => Promise<boolean>;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useJWTAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};