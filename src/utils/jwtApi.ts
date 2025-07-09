/**
 * JWT-Aware API Utilities
 * 
 * Provides API functions that automatically include JWT tokens
 * and handle token refresh/authentication errors.
 */

import { apiConfig } from '../config/api';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}

/**
 * Get stored access token
 */
const getAccessToken = (): string | null => {
  return localStorage.getItem('mailflow_access_token');
};

/**
 * Get stored refresh token
 */
const getRefreshToken = (): string | null => {
  return localStorage.getItem('mailflow_refresh_token');
};

/**
 * Check if token is expired
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

/**
 * Refresh access token
 */
const refreshAccessToken = async (): Promise<boolean> => {
  try {
    const refreshToken = getRefreshToken();
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

    return true;
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    // Clear invalid tokens
    localStorage.removeItem('mailflow_access_token');
    localStorage.removeItem('mailflow_refresh_token');
    return false;
  }
};

/**
 * Get authorization headers
 */
const getAuthHeaders = (additionalHeaders: Record<string, string> = {}): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...additionalHeaders
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Make authenticated API request with automatic token refresh
 */
export const apiRequest = async <T = any>(
  url: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> => {
  const {
    method = 'GET',
    body,
    headers = {},
    skipAuth = false
  } = options;

  let accessToken = getAccessToken();

  // Check if token needs refresh (only for authenticated requests)
  if (!skipAuth && accessToken && isTokenExpired(accessToken)) {
    const refreshSuccess = await refreshAccessToken();
    if (!refreshSuccess) {
      return {
        success: false,
        error: 'Authentication required',
        status: 401
      };
    }
    accessToken = getAccessToken();
  }

  // Prepare headers
  const requestHeaders = skipAuth ? headers : getAuthHeaders(headers);

  // Prepare request body
  const requestBody = body ? JSON.stringify(body) : undefined;

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: requestBody
    });

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      data = null;
    }

    if (!response.ok) {
      // Handle 401 errors (token expired/invalid)
      if (response.status === 401 && !skipAuth) {
        // Try to refresh token once
        const refreshSuccess = await refreshAccessToken();
        if (refreshSuccess) {
          // Retry the request with new token
          return apiRequest(url, options);
        } else {
          // Refresh failed, redirect to login
          window.location.href = '/login';
          return {
            success: false,
            error: 'Authentication required',
            status: 401
          };
        }
      }

      return {
        success: false,
        error: data?.message || `Request failed with status ${response.status}`,
        status: response.status
      };
    }

    return {
      success: true,
      data,
      status: response.status
    };
  } catch (error) {
    console.error('❌ API request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      status: 0
    };
  }
};

/**
 * Account API functions
 */
export const AccountAPI = {
  /**
   * Get all accounts for the current user
   */
  async getAll(): Promise<ApiResponse<any[]>> {
    return apiRequest(apiConfig.accounts);
  },

  /**
   * Create a new account
   */
  async create(account: any): Promise<ApiResponse<any>> {
    return apiRequest(apiConfig.accounts, {
      method: 'POST',
      body: account
    });
  },

  /**
   * Update an existing account
   */
  async update(accountId: string, account: any): Promise<ApiResponse<any>> {
    return apiRequest(`${apiConfig.accounts}/${accountId}`, {
      method: 'PUT',
      body: account
    });
  },

  /**
   * Delete an account
   */
  async delete(accountId: string): Promise<ApiResponse<void>> {
    return apiRequest(`${apiConfig.accounts}/${accountId}`, {
      method: 'DELETE'
    });
  },

  /**
   * Test account connection
   */
  async testConnection(account: any): Promise<ApiResponse<any>> {
    return apiRequest(`${apiConfig.accounts}/test`, {
      method: 'POST',
      body: account
    });
  }
};

/**
 * Email API functions
 */
export const EmailAPI = {
  /**
   * Get emails for an account
   */
  async getEmails(accountId: string, folder: string = 'INBOX'): Promise<ApiResponse<any[]>> {
    return apiRequest(`${apiConfig.emails}/${accountId}?folder=${folder}`);
  },

  /**
   * Get email content
   */
  async getEmailContent(accountId: string, emailId: string): Promise<ApiResponse<any>> {
    return apiRequest(`${apiConfig.emails}/${accountId}/${emailId}`);
  },

  /**
   * Send email
   */
  async sendEmail(accountId: string, email: any): Promise<ApiResponse<any>> {
    return apiRequest(`${apiConfig.smtp}/${accountId}/send`, {
      method: 'POST',
      body: email
    });
  },

  /**
   * Delete email
   */
  async deleteEmail(accountId: string, emailId: string): Promise<ApiResponse<void>> {
    return apiRequest(`${apiConfig.emails}/${accountId}/${emailId}`, {
      method: 'DELETE'
    });
  }
};

/**
 * Settings API functions
 */
export const SettingsAPI = {
  /**
   * Get user settings
   */
  async getSettings(): Promise<ApiResponse<any>> {
    return apiRequest(apiConfig.settings);
  },

  /**
   * Update user settings
   */
  async updateSettings(settings: any): Promise<ApiResponse<any>> {
    return apiRequest(apiConfig.settings, {
      method: 'PUT',
      body: settings
    });
  }
};

/**
 * Health check (no auth required)
 */
export const healthCheck = async (): Promise<ApiResponse<any>> => {
  return apiRequest(apiConfig.health, { skipAuth: true });
};