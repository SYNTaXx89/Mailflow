/**
 * Base Storage - Generic storage utilities
 * 
 * Provides fundamental localStorage operations with error handling
 * and type safety.
 */

export const STORAGE_KEYS = {
  APP_STATE: 'mailflow_app_state',
  ACCOUNTS: 'mailflow_accounts',
  EMAILS: 'mailflow_emails',
  SETTINGS: 'mailflow_settings',
  SETUP_PASSWORD: 'mailflow_setup_password'
} as const;

export class BaseStorage {
  /**
   * Saves data to localStorage with JSON serialization
   */
  static save<T>(key: string, data: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`Failed to save data to localStorage (${key}):`, error);
      return false;
    }
  }

  /**
   * Loads data from localStorage with JSON deserialization
   */
  static load<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`Failed to load data from localStorage (${key}):`, error);
      return defaultValue;
    }
  }

  /**
   * Removes data from localStorage
   */
  static remove(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Failed to remove data from localStorage (${key}):`, error);
      return false;
    }
  }

  /**
   * Checks if localStorage is available
   */
  static isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clears all application data from localStorage
   */
  static clearAll(): boolean {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      return true;
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
      return false;
    }
  }
}