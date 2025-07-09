/**
 * Secure Data Export/Import API Routes
 * 
 * Database-backed data export/import with JWT authentication and user data isolation.
 * Allows users to backup and restore their personal data only.
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { DatabaseManager } from '../database/DatabaseManager';
import { AuthMiddleware } from '../auth/AuthMiddleware';

const router = express.Router();
const dbManager = DatabaseManager.getInstance();

// Apply authentication to all routes
router.use(AuthMiddleware.authenticate);

/**
 * Export user data (accounts and settings) for authenticated user
 */
router.get('/', async (req: Request, res) => {
  try {
    const userId = req.user!.userId;
    
    // Get user's accounts (with decrypted credentials for export)
    const accounts = await dbManager.getUserAccounts(userId);
    const exportAccounts = accounts.map(account => {
      const credentials = JSON.parse(dbManager.decrypt(account.encrypted_credentials));
      const config = JSON.parse(account.config);
      
      return {
        id: account.id,
        name: account.name,
        email: account.email,
        username: credentials.username,
        password: credentials.password,
        unreadCount: 0, // TODO: Calculate from emails
        color: config.color,
        imap: config.imap,
        smtp: config.smtp,
        created_at: account.created_at
      };
    });
    
    // Get user's settings
    const settings = await dbManager.getAllSettings(userId);
    
    const exportData = {
      accounts: exportAccounts,
      settings,
      timestamp: new Date().toISOString(),
      userId // For reference, but not used in import
    };
    
    res.json(exportData);
  } catch (error) {
    console.error('Failed to export data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

/**
 * Import user data (accounts and settings) for authenticated user
 * WARNING: This will replace existing data
 */
router.post('/import', async (req: Request, res) => {
  try {
    const userId = req.user!.userId;
    const { accounts, settings, replaceExisting = false } = req.body;
    
    if (!accounts && !settings) {
      return res.status(400).json({ error: 'No data provided for import' });
    }
    
    let imported = { accounts: 0, settings: 0 };
    
    // Import accounts
    if (accounts && Array.isArray(accounts)) {
      // Clear existing accounts if requested
      if (replaceExisting) {
        const existingAccounts = await dbManager.getUserAccounts(userId);
        for (const account of existingAccounts) {
          await dbManager.deleteAccount(account.id);
        }
      }
      
      // Import each account
      for (const account of accounts) {
        try {
          const accountId = crypto.randomUUID(); // Generate new ID to avoid conflicts
          
          // Prepare encrypted credentials
          const credentials = {
            username: account.username || account.email,
            password: account.password || ''
          };
          const encryptedCredentials = dbManager.encrypt(JSON.stringify(credentials));
          
          // Prepare configuration
          const config = {
            color: account.color || '#' + Math.floor(Math.random()*16777215).toString(16),
            imap: account.imap || { host: '', port: 993, security: 'SSL/TLS' },
            smtp: account.smtp || { host: '', port: 587, security: 'STARTTLS' }
          };
          
          const success = await dbManager.createAccount({
            id: accountId,
            user_id: userId,
            name: account.name || 'Imported Account',
            email: account.email || '',
            encrypted_credentials: encryptedCredentials,
            config: JSON.stringify(config)
          });
          
          if (success) {
            imported.accounts++;
          }
        } catch (error) {
          console.error('Failed to import account:', account.name, error);
        }
      }
    }
    
    // Import settings
    if (settings && typeof settings === 'object') {
      // Clear existing settings if requested
      if (replaceExisting) {
        const existingSettings = await dbManager.getAllSettings(userId);
        // Note: We don't have a clearAllSettings method, so we'll overwrite instead
      }
      
      // Import each setting
      for (const [key, value] of Object.entries(settings)) {
        try {
          await dbManager.setSetting(userId, key, String(value));
          imported.settings++;
        } catch (error) {
          console.error('Failed to import setting:', key, error);
        }
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Data imported successfully',
      imported
    });
  } catch (error) {
    console.error('Failed to import data:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

export default router;