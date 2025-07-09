/**
 * API Service - Server Communication Layer
 * 
 * This module provides utilities for communicating with the backend API.
 * It replaces localStorage-based persistence with server-side data management.
 * 
 * Features:
 * - RESTful API communication
 * - Type-safe API operations
 * - Error handling and response validation
 * - Account, email, and settings management
 */

import { Account, Email, AppSettings } from '../types';
import { apiConfig } from '../config/api';

/**
 * Generic API utility functions
 */
class ApiClient {
  /**
   * Gets authorization headers for JWT authentication
   */
  private static getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('mailflow_access_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  /**
   * Makes a GET request to the API
   */
  static async get<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
        headers: {
          ...this.getAuthHeaders(),
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API GET ${endpoint} failed:`, error);
      throw error;
    }
  }

  /**
   * Makes a POST request to the API
   */
  static async post<T>(endpoint: string, data: any): Promise<T> {
    try {
      const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API POST ${endpoint} failed:`, error);
      throw error;
    }
  }

  /**
   * Makes a PUT request to the API
   */
  static async put<T>(endpoint: string, data: any): Promise<T> {
    try {
      const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API PUT ${endpoint} failed:`, error);
      throw error;
    }
  }

  /**
   * Makes a DELETE request to the API
   */
  static async delete<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: {
          ...this.getAuthHeaders(),
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API DELETE ${endpoint} failed:`, error);
      throw error;
    }
  }
}

/**
 * Account management API
 */
export class AccountApi {
  /**
   * Loads all accounts
   */
  static async load(): Promise<Account[]> {
    const response = await ApiClient.get<{ accounts: Account[] }>('/accounts');
    return response.accounts;
  }

  /**
   * Adds a new account
   */
  static async add(account: Account): Promise<boolean> {
    try {
      await ApiClient.post('/accounts', { account });
      return true;
    } catch (error) {
      console.error('Failed to add account:', error);
      return false;
    }
  }

  /**
   * Updates an existing account
   */
  static async update(accountId: string, updates: Partial<Account>): Promise<boolean> {
    try {
      await ApiClient.put(`/accounts/${accountId}`, { account: updates });
      return true;
    } catch (error) {
      console.error('Failed to update account:', error);
      return false;
    }
  }

  /**
   * Removes an account
   */
  static async remove(accountId: string): Promise<boolean> {
    try {
      await ApiClient.delete(`/accounts/${accountId}`);
      return true;
    } catch (error) {
      console.error('Failed to remove account:', error);
      return false;
    }
  }
}

/**
 * Email management API
 */
export class EmailApi {
  /**
   * Loads all emails or emails for a specific account
   */
  static async load(accountId?: string): Promise<Email[]> {
    const endpoint = accountId ? `/emails?accountId=${accountId}` : '/emails';
    const response = await ApiClient.get<{ emails: any[] }>(endpoint);
    
    // Convert date strings back to Date objects
    return response.emails.map((email: any) => ({
      ...email,
      date: new Date(email.date)
    }));
  }

  /**
   * Gets emails for a specific account
   */
  static async getByAccount(accountId: string): Promise<Email[]> {
    return this.load(accountId);
  }

  /**
   * Adds a new email
   */
  static async add(email: Email): Promise<boolean> {
    try {
      await ApiClient.post('/emails', { email });
      return true;
    } catch (error) {
      console.error('Failed to add email:', error);
      return false;
    }
  }

  /**
   * Updates an email
   */
  static async update(emailId: string, updates: Partial<Email>): Promise<boolean> {
    try {
      await ApiClient.put(`/emails/${emailId}`, { email: updates });
      return true;
    } catch (error) {
      console.error('Failed to update email:', error);
      return false;
    }
  }

  /**
   * Removes an email
   */
  static async remove(emailId: string): Promise<boolean> {
    try {
      await ApiClient.delete(`/emails/${emailId}`);
      return true;
    } catch (error) {
      console.error('Failed to remove email:', error);
      return false;
    }
  }

  /**
   * Marks an email as read/unread
   */
  static async markAsRead(emailId: string, isRead: boolean = true): Promise<boolean> {
    return this.update(emailId, { isRead });
  }

  /**
   * Replaces all emails for a specific account
   */
  static async replaceByAccount(accountId: string, newEmails: Email[]): Promise<boolean> {
    try {
      await ApiClient.post(`/emails/replace/${accountId}`, { emails: newEmails });
      return true;
    } catch (error) {
      console.error('Failed to replace emails:', error);
      return false;
    }
  }

  /**
   * Clears all emails for a specific account
   */
  static async clearByAccount(accountId: string): Promise<boolean> {
    try {
      await ApiClient.delete(`/emails/account/${accountId}`);
      return true;
    } catch (error) {
      console.error('Failed to clear emails for account:', error);
      return false;
    }
  }
}

/**
 * Settings management API
 */
export class SettingsApi {
  /**
   * Loads application settings
   */
  static async load(): Promise<AppSettings> {
    const response = await ApiClient.get<{ settings: AppSettings }>('/settings');
    return response.settings;
  }

  /**
   * Saves application settings
   */
  static async save(settings: AppSettings): Promise<boolean> {
    try {
      await ApiClient.post('/settings', { settings });
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }

  /**
   * Updates specific setting
   */
  static async update<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<boolean> {
    try {
      const currentSettings = await this.load();
      const updatedSettings = { ...currentSettings, [key]: value };
      return await this.save(updatedSettings);
    } catch (error) {
      console.error('Failed to update setting:', error);
      return false;
    }
  }
}

/**
 * Import/Export API
 */
export class ImportExportApi {
  /**
   * Exports all data
   */
  static async export(): Promise<{ accounts: Account[]; settings: AppSettings; timestamp: string }> {
    return await ApiClient.get('/export');
  }

  /**
   * Imports data
   */
  static async import(data: { accounts?: Account[]; settings?: AppSettings }): Promise<boolean> {
    try {
      await ApiClient.post('/import', data);
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }
}