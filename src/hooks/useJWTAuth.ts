/**
 * JWT Authentication Hook
 * 
 * Provides JWT-based authentication state management for Mailflow.
 * Handles token storage, validation, refresh, and user state.
 */

import { useState, useEffect } from 'react';
import { apiConfig } from '../config/api';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshTokens: () => Promise<boolean>;
  getAuthHeaders: () => Record<string, string>;
}

export const useJWTAuth = (): AuthContextType => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    accessToken: null,
    refreshToken: null
  });

  /**
   * Initialize authentication state from localStorage
   */
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const accessToken = localStorage.getItem('mailflow_access_token');
      const refreshToken = localStorage.getItem('mailflow_refresh_token');

      if (!accessToken) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Check if token is expired
      if (isTokenExpired(accessToken)) {
        if (refreshToken) {
          const refreshSuccess = await refreshTokens();
          if (!refreshSuccess) {
            clearTokens();
            setAuthState(prev => ({ ...prev, isLoading: false }));
            return;
          }
        } else {
          clearTokens();
          setAuthState(prev => ({ ...prev, isLoading: false }));
          return;
        }
      } else {
        // Token is valid, get user info
        const user = await getCurrentUser(accessToken);
        if (user) {
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user,
            accessToken,
            refreshToken
          });
        } else {
          clearTokens();
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      }
    } catch (error) {
      console.error('❌ Auth initialization failed:', error);
      clearTokens();
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  /**
   * Login with email and password
   */
  const login = async (email: string, password: string): Promise<void> => {
    try {
      // Set loading state
      setAuthState(prev => ({ ...prev, isLoading: true }));

      const response = await fetch(apiConfig.auth.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store tokens
      localStorage.setItem('mailflow_access_token', data.accessToken);
      localStorage.setItem('mailflow_refresh_token', data.refreshToken);

      // Update auth state
      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      });

      console.log('✅ User logged in successfully:', data.user.email);
    } catch (error) {
      console.error('❌ Login failed:', error);
      // Clear loading state on error
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  /**
   * Logout and clear all tokens
   */
  const logout = async () => {
    try {
      // Call logout endpoint if we have a token
      if (authState.accessToken) {
        await fetch(apiConfig.auth.logout, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authState.accessToken}`
          }
        });
      }
    } catch (error) {
      console.error('❌ Logout API call failed:', error);
      // Continue with local logout even if API call fails
    }

    clearTokens();
    setAuthState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      accessToken: null,
      refreshToken: null
    });

    console.log('✅ User logged out');
  };

  /**
   * Refresh access token using refresh token
   */
  const refreshTokens = async (): Promise<boolean> => {
    try {
      const refreshToken = localStorage.getItem('mailflow_refresh_token');
      if (!refreshToken) {
        return false;
      }

      const response = await fetch(apiConfig.auth.refresh, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Token refresh failed');
      }

      // Store new tokens
      localStorage.setItem('mailflow_access_token', data.accessToken);
      localStorage.setItem('mailflow_refresh_token', data.refreshToken);

      // Update auth state
      setAuthState(prev => ({
        ...prev,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      }));

      console.log('✅ Tokens refreshed successfully');
      return true;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      return false;
    }
  };

  /**
   * Get current user information
   */
  const getCurrentUser = async (token: string): Promise<User | null> => {
    try {
      const response = await fetch(apiConfig.auth.me, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get user info');
      }

      return data.user;
    } catch (error) {
      console.error('❌ Failed to get current user:', error);
      return null;
    }
  };

  /**
   * Get authorization headers for API requests
   */
  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (authState.accessToken) {
      headers['Authorization'] = `Bearer ${authState.accessToken}`;
    }

    return headers;
  };

  /**
   * Clear tokens from localStorage
   */
  const clearTokens = () => {
    localStorage.removeItem('mailflow_access_token');
    localStorage.removeItem('mailflow_refresh_token');
  };

  /**
   * Check if token is expired (without verification)
   */
  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  };

  return {
    ...authState,
    login,
    logout,
    refreshTokens,
    getAuthHeaders
  };
};