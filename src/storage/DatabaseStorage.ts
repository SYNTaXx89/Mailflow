/**
 * Database Storage - Replace localStorage with API-based storage
 * 
 * Provides the same interface as localStorage but stores data
 * in the backend database via API calls.
 */

import { apiConfig } from '../config/api';

export class DatabaseStorage {
  /**
   * Store data via API (replaces localStorage.setItem)
   */
  static async setItem(key: string, value: string, userId?: string): Promise<boolean> {
    try {
      const response = await fetch(`${apiConfig.baseUrl}/storage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.getAuthHeaders())
        },
        body: JSON.stringify({
          key,
          value,
          userId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to store data:', error);
      return false;
    }
  }

  /**
   * Retrieve data via API (replaces localStorage.getItem)
   */
  static async getItem(key: string, userId?: string): Promise<string | null> {
    try {
      const url = new URL(`${apiConfig.baseUrl}/storage/${encodeURIComponent(key)}`);
      if (userId) {
        url.searchParams.set('userId', userId);
      }

      const response = await fetch(url.toString(), {
        headers: this.getAuthHeaders()
      });

      if (response.status === 404) {
        return null; // Key not found
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.value || null;
    } catch (error) {
      console.error('Failed to retrieve data:', error);
      return null;
    }
  }

  /**
   * Remove data via API (replaces localStorage.removeItem)
   */
  static async removeItem(key: string, userId?: string): Promise<boolean> {
    try {
      const url = new URL(`${apiConfig.baseUrl}/storage/${encodeURIComponent(key)}`);
      if (userId) {
        url.searchParams.set('userId', userId);
      }

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to remove data:', error);
      return false;
    }
  }

  /**
   * Clear all data for user via API (replaces localStorage.clear)
   */
  static async clear(userId?: string): Promise<boolean> {
    try {
      const url = new URL(`${apiConfig.baseUrl}/storage`);
      if (userId) {
        url.searchParams.set('userId', userId);
      }

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to clear data:', error);
      return false;
    }
  }

  /**
   * Get authentication headers from localStorage (during transition period)
   */
  private static getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('mailflow_access_token');
    if (token) {
      return {
        'Authorization': `Bearer ${token}`
      };
    }
    return {};
  }

  /**
   * Save JSON data (utility method)
   */
  static async saveJSON<T>(key: string, data: T, userId?: string): Promise<boolean> {
    try {
      const jsonString = JSON.stringify(data);
      return await this.setItem(key, jsonString, userId);
    } catch (error) {
      console.error('Failed to save JSON data:', error);
      return false;
    }
  }

  /**
   * Load JSON data (utility method)
   */
  static async loadJSON<T>(key: string, defaultValue: T, userId?: string): Promise<T> {
    try {
      const jsonString = await this.getItem(key, userId);
      if (jsonString === null) {
        return defaultValue;
      }
      return JSON.parse(jsonString) as T;
    } catch (error) {
      console.error('Failed to load JSON data:', error);
      return defaultValue;
    }
  }
}

/**
 * Hybrid Storage - Fallback to localStorage during transition
 * 
 * This class attempts to use DatabaseStorage first, but falls back
 * to localStorage if the API is not available. This allows for
 * gradual migration.
 */
export class HybridStorage {
  /**
   * Check if database storage is available
   */
  private static async isDatabaseAvailable(): Promise<boolean> {
    try {
      const response = await fetch(apiConfig.health);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Save data with fallback
   */
  static async save<T>(key: string, data: T, userId?: string): Promise<boolean> {
    const isDbAvailable = await this.isDatabaseAvailable();
    
    if (isDbAvailable) {
      return await DatabaseStorage.saveJSON(key, data, userId);
    } else {
      // Fallback to localStorage
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
        return false;
      }
    }
  }

  /**
   * Load data with fallback
   */
  static async load<T>(key: string, defaultValue: T, userId?: string): Promise<T> {
    const isDbAvailable = await this.isDatabaseAvailable();
    
    if (isDbAvailable) {
      return await DatabaseStorage.loadJSON(key, defaultValue, userId);
    } else {
      // Fallback to localStorage
      try {
        const item = localStorage.getItem(key);
        if (item === null) return defaultValue;
        return JSON.parse(item) as T;
      } catch (error) {
        console.error('Failed to load from localStorage:', error);
        return defaultValue;
      }
    }
  }

  /**
   * Remove data with fallback
   */
  static async remove(key: string, userId?: string): Promise<boolean> {
    const isDbAvailable = await this.isDatabaseAvailable();
    
    if (isDbAvailable) {
      return await DatabaseStorage.removeItem(key, userId);
    } else {
      // Fallback to localStorage
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error('Failed to remove from localStorage:', error);
        return false;
      }
    }
  }
}