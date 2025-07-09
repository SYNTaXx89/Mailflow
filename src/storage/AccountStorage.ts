/**
 * Account Storage
 * 
 * Handles persistence of email account data including
 * account information and secure password storage.
 */

import { Account } from '../types';
import { BaseStorage, STORAGE_KEYS } from './BaseStorage';

export class AccountStorage {
  /**
   * Saves all accounts
   */
  static save(accounts: Account[]): boolean {
    return BaseStorage.save(STORAGE_KEYS.ACCOUNTS, accounts);
  }

  /**
   * Loads all accounts
   */
  static load(): Account[] {
    return BaseStorage.load(STORAGE_KEYS.ACCOUNTS, []);
  }

  /**
   * Adds a new account
   */
  static add(account: Account): boolean {
    const accounts = this.load();
    accounts.push(account);
    return this.save(accounts);
  }

  /**
   * Updates an existing account
   */
  static update(accountId: string, updates: Partial<Account>): boolean {
    const accounts = this.load();
    const index = accounts.findIndex(acc => acc.id === accountId);
    
    if (index === -1) return false;
    
    accounts[index] = { ...accounts[index], ...updates };
    return this.save(accounts);
  }

  /**
   * Save account password securely (separate from account data)
   */
  static savePassword(accountId: string, password: string): boolean {
    const key = `${STORAGE_KEYS.ACCOUNTS}_password_${accountId}`;
    return BaseStorage.save(key, password);
  }

  /**
   * Load account password
   */
  static loadPassword(accountId: string): string | null {
    const key = `${STORAGE_KEYS.ACCOUNTS}_password_${accountId}`;
    return BaseStorage.load(key, null);
  }

  /**
   * Removes an account
   */
  static remove(accountId: string): boolean {
    const accounts = this.load();
    const filtered = accounts.filter(acc => acc.id !== accountId);
    return this.save(filtered);
  }
}