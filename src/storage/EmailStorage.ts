/**
 * Email Storage
 * 
 * Handles persistence of email data with proper date serialization
 * and account-specific operations.
 */

import { Email } from '../types';
import { BaseStorage, STORAGE_KEYS } from './BaseStorage';

export class EmailStorage {
  /**
   * Saves all emails
   */
  static save(emails: Email[]): boolean {
    // Convert Date objects to ISO strings for storage
    const serializedEmails = emails.map(email => ({
      ...email,
      date: email.date.toISOString()
    }));
    
    return BaseStorage.save(STORAGE_KEYS.EMAILS, serializedEmails);
  }

  /**
   * Loads all emails
   */
  static load(): Email[] {
    const emails: any[] = BaseStorage.load(STORAGE_KEYS.EMAILS, []);
    
    // Convert ISO strings back to Date objects
    return emails.map((email: any) => ({
      ...email,
      date: new Date(email.date)
    }));
  }

  /**
   * Gets emails for a specific account
   */
  static getByAccount(accountId: string): Email[] {
    const emails = this.load();
    return emails.filter(email => email.accountId === accountId);
  }

  /**
   * Adds a new email
   */
  static add(email: Email): boolean {
    const emails = this.load();
    emails.push(email);
    return this.save(emails);
  }

  /**
   * Updates an email
   */
  static update(emailId: string, updates: Partial<Email>): boolean {
    const emails = this.load();
    const index = emails.findIndex(email => email.id === emailId);
    
    if (index === -1) return false;
    
    emails[index] = { ...emails[index], ...updates };
    return this.save(emails);
  }

  /**
   * Removes an email
   */
  static remove(emailId: string): boolean {
    const emails = this.load();
    const filtered = emails.filter(email => email.id !== emailId);
    return this.save(filtered);
  }

  /**
   * Marks an email as read/unread
   */
  static markAsRead(emailId: string, isRead: boolean = true): boolean {
    return this.update(emailId, { isRead });
  }

  /**
   * Clears all emails for a specific account
   */
  static clearByAccount(accountId: string): boolean {
    const emails = this.load();
    const filtered = emails.filter(email => email.accountId !== accountId);
    return this.save(filtered);
  }

  /**
   * Replaces all emails for a specific account
   */
  static replaceByAccount(accountId: string, newEmails: Email[]): boolean {
    // First clear existing emails for this account
    this.clearByAccount(accountId);
    
    // Then add the new emails
    const allEmails = this.load();
    const updatedEmails = [...allEmails, ...newEmails];
    return this.save(updatedEmails);
  }
}