/**
 * Account Helper Utilities
 * 
 * Shared utilities for working with email accounts across different route files.
 */

import { DatabaseManager } from '../database/DatabaseManager';

/**
 * Get account with decrypted credentials
 */
export async function getAccountWithCredentials(accountId: string, databaseManager: DatabaseManager): Promise<any> {
  try {
    // Get account from database
    const dbAccount = await databaseManager.getAccountById(accountId);
    if (!dbAccount) {
      return null;
    }
    
    // Decrypt credentials
    const credentials = JSON.parse(databaseManager.decrypt(dbAccount.encrypted_credentials));
    const config = JSON.parse(dbAccount.config);
    
    // Return complete account object
    return {
      id: dbAccount.id,
      name: dbAccount.name,
      email: dbAccount.email,
      username: credentials.username || dbAccount.email,
      password: credentials.password,
      imap: config.imap,
      smtp: config.smtp
    };
  } catch (error) {
    console.error(`❌ Error getting account ${accountId}:`, error);
    return null;
  }
}