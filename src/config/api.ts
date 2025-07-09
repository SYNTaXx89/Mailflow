/**
 * API Configuration
 * 
 * Centralized API configuration using Vite environment variables.
 * Provides runtime API base URL detection for self-hosted instances.
 */

/**
 * Get the API base URL from environment variables or runtime detection
 */
function getApiBaseUrl(): string {
  // First, try environment variable
  const envApiUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (envApiUrl) {
    return envApiUrl;
  }
  
  // Fallback: Runtime detection for self-hosted instances
  // In production, API is served from same origin
  if (import.meta.env.PROD) {
    return '/api';
  }
  
  // Development fallback
  return 'http://localhost:3001/api';
}

/**
 * API Configuration object
 */
export const apiConfig = {
  baseUrl: getApiBaseUrl(),
  appName: import.meta.env.VITE_APP_NAME || 'Mailflow',
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
  
  // Computed URLs
  get accounts() { return `${this.baseUrl}/accounts`; },
  get emails() { return `${this.baseUrl}/emails`; },
  get settings() { return `${this.baseUrl}/settings`; },
  get health() { return `${this.baseUrl}/health`; },
  get imap() { return `${this.baseUrl}/imap`; },
  get smtp() { return `${this.baseUrl}/smtp`; },
  get export() { return `${this.baseUrl}/export`; },
  get import() { return `${this.baseUrl}/import`; },
  
  // Auth endpoints (for Phase 2)
  get auth() { 
    return {
      login: `${this.baseUrl}/auth/login`,
      logout: `${this.baseUrl}/auth/logout`,
      refresh: `${this.baseUrl}/auth/refresh`,
      me: `${this.baseUrl}/auth/me`
    };
  },
  
  // Setup endpoints (for Phase 2)
  get setup() {
    return {
      status: `${this.baseUrl}/setup/status`,
      initialize: `${this.baseUrl}/setup/initialize`,
      admin: `${this.baseUrl}/setup/admin`,
      configure: `${this.baseUrl}/setup/configure`,
      complete: `${this.baseUrl}/setup/complete`,
      reset: `${this.baseUrl}/setup/reset`
    };
  }
};

/**
 * Environment information
 */
export const envInfo = {
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  mode: import.meta.env.MODE,
  baseUrl: import.meta.env.BASE_URL,
};

/**
 * Debug function to log API configuration (development only)
 */
export function debugApiConfig() {
  if (envInfo.isDevelopment) {
    console.log('🔧 API Configuration:', {
      baseUrl: apiConfig.baseUrl,
      environment: envInfo.mode,
      envVariable: import.meta.env.VITE_API_BASE_URL,
      allEndpoints: {
        accounts: apiConfig.accounts,
        emails: apiConfig.emails,
        health: apiConfig.health,
        auth: apiConfig.auth,
        setup: apiConfig.setup
      }
    });
  }
}