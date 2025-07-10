/**
 * Secure Email Accounts API Routes
 * 
 * Database-backed email account management with JWT authentication
 * and user data isolation. Replaces insecure JSON file storage.
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { DatabaseManager } from '../database/DatabaseManager';
import { AuthMiddleware } from '../auth/AuthMiddleware';

export const createAccountsRouter = (dbManager: DatabaseManager, authMiddleware: AuthMiddleware) => {
  const router = express.Router();
  
  // Apply authentication to all routes
  router.use(authMiddleware.authenticate);

/**
 * Get all email accounts for authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const accounts = await dbManager.getUserAccounts(userId);
    
    // Transform database accounts to frontend format
    const formattedAccounts = accounts.map(account => {
      const credentials = JSON.parse(dbManager.decrypt(account.encrypted_credentials));
      const config = JSON.parse(account.config);
      
      return {
        id: account.id,
        name: account.name,
        email: account.email,
        username: credentials.username || account.email,
        password: credentials.password,
        unreadCount: 0, // TODO: Calculate from emails table
        color: config.color || '#' + Math.floor(Math.random()*16777215).toString(16),
        imap: config.imap,
        smtp: config.smtp
      };
    });
    
    res.json({ accounts: formattedAccounts });
  } catch (error) {
    console.error('Failed to load accounts:', error);
    res.status(500).json({ error: 'Failed to load accounts' });
  }
});

/**
 * Create new email account for authenticated user
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { account } = req.body;
    
    if (!account || !account.name || !account.email) {
      return res.status(400).json({ error: 'Missing required account fields' });
    }
    
    const accountId = crypto.randomUUID();
    
    // Prepare encrypted credentials
    const credentials = {
      username: account.username || account.email,
      password: account.password || ''
    };
    const encryptedCredentials = dbManager.encrypt(JSON.stringify(credentials));
    
    // Prepare configuration
    const config = {
      color: account.color || '#' + Math.floor(Math.random()*16777215).toString(16),
      imap: account.imap || {
        host: '',
        port: 993,
        security: 'SSL/TLS'
      },
      smtp: account.smtp || {
        host: '',
        port: 587,
        security: 'STARTTLS'
      }
    };
    
    const success = await dbManager.createAccount({
      id: accountId,
      user_id: userId,
      name: account.name,
      email: account.email,
      encrypted_credentials: encryptedCredentials,
      config: JSON.stringify(config)
    });
    
    if (success) {
      // Return the account in frontend format
      const newAccount = {
        id: accountId,
        name: account.name,
        email: account.email,
        username: credentials.username,
        password: credentials.password,
        unreadCount: 0,
        color: config.color,
        imap: config.imap,
        smtp: config.smtp
      };
      
      res.json({ success: true, account: newAccount });
    } else {
      res.status(500).json({ error: 'Failed to save account' });
    }
  } catch (error) {
    console.error('Failed to create account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

/**
 * Update email account for authenticated user
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { account } = req.body;
    
    // Verify account belongs to user
    const existingAccount = await dbManager.getAccountById(id);
    if (!existingAccount || existingAccount.user_id !== userId) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Prepare updates
    const updates: any = {};
    
    if (account.name) updates.name = account.name;
    if (account.email) updates.email = account.email;
    
    // Update credentials if provided
    if (account.username || account.password) {
      const existingCredentials = JSON.parse(dbManager.decrypt(existingAccount.encrypted_credentials));
      const newCredentials = {
        username: account.username || existingCredentials.username,
        password: account.password || existingCredentials.password
      };
      updates.encrypted_credentials = dbManager.encrypt(JSON.stringify(newCredentials));
    }
    
    // Update config if provided
    if (account.imap || account.smtp || account.color) {
      const existingConfig = JSON.parse(existingAccount.config);
      const newConfig = {
        ...existingConfig,
        ...(account.color && { color: account.color }),
        ...(account.imap && { imap: account.imap }),
        ...(account.smtp && { smtp: account.smtp })
      };
      updates.config = JSON.stringify(newConfig);
    }
    
    const success = await dbManager.updateAccount(id, updates);
    
    if (success) {
      // Return updated account in frontend format
      const updatedAccount = await dbManager.getAccountById(id);
      const credentials = JSON.parse(dbManager.decrypt(updatedAccount!.encrypted_credentials));
      const config = JSON.parse(updatedAccount!.config);
      
      const formattedAccount = {
        id: updatedAccount!.id,
        name: updatedAccount!.name,
        email: updatedAccount!.email,
        username: credentials.username,
        password: credentials.password,
        unreadCount: 0, // TODO: Calculate from emails
        color: config.color,
        imap: config.imap,
        smtp: config.smtp
      };
      
      res.json({ success: true, account: formattedAccount });
    } else {
      res.status(500).json({ error: 'Failed to update account' });
    }
  } catch (error) {
    console.error('Failed to update account:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

/**
 * Delete email account for authenticated user
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    // Verify account belongs to user
    const existingAccount = await dbManager.getAccountById(id);
    if (!existingAccount || existingAccount.user_id !== userId) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    const success = await dbManager.deleteAccount(id);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to delete account' });
    }
  } catch (error) {
    console.error('Failed to delete account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

  return router;
};

// Temporary backward compatibility
export default createAccountsRouter;