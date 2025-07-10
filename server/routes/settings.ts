/**
 * Secure User Settings API Routes
 * 
 * Database-backed user settings with JWT authentication and user data isolation.
 * Handles application preferences and configuration per user.
 */

import express, { Request, Response } from 'express';
import { DatabaseManager } from '../database/DatabaseManager';
import { AuthMiddleware } from '../auth/AuthMiddleware';

export const createSettingsRouter = (dbManager: DatabaseManager, authMiddleware: AuthMiddleware) => {
  const router = express.Router();
  
  // Apply authentication to all routes
  router.use(authMiddleware.authenticate);

/**
 * Get user settings for authenticated user
 */
router.get('/', async (req: Request, res) => {
  try {
    const userId = req.user!.userId;
    
    // Get all settings for user
    const userSettings = await dbManager.getAllSettings(userId);
    
    // Provide defaults for missing settings
    const settings = {
      theme: userSettings.theme || 'dark',
      emailsPerPage: parseInt(userSettings.emailsPerPage) || 50,
      autoRefresh: parseInt(userSettings.autoRefresh) || 5,
      ...userSettings // Include any additional custom settings
    };
    
    res.json({ settings });
  } catch (error) {
    console.error('Failed to load settings:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

/**
 * Save user settings for authenticated user
 */
router.post('/', async (req: Request, res) => {
  try {
    const userId = req.user!.userId;
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings data' });
    }
    
    // Save each setting individually
    const savePromises = Object.entries(settings).map(([key, value]) => 
      dbManager.setSetting(userId, key, String(value))
    );
    
    await Promise.all(savePromises);
    
    // Return the saved settings
    const savedSettings = await dbManager.getAllSettings(userId);
    const formattedSettings = {
      theme: savedSettings.theme || 'dark',
      emailsPerPage: parseInt(savedSettings.emailsPerPage) || 50,
      autoRefresh: parseInt(savedSettings.autoRefresh) || 5,
      ...savedSettings
    };
    
    res.json({ success: true, settings: formattedSettings });
  } catch (error) {
    console.error('Failed to save settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

/**
 * Update a specific setting for authenticated user
 */
router.put('/:key', async (req: Request, res) => {
  try {
    const userId = req.user!.userId;
    const { key } = req.params;
    const { value } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Missing key or value' });
    }
    
    await dbManager.setSetting(userId, key, String(value));
    
    res.json({ success: true, key, value });
  } catch (error) {
    console.error('Failed to update setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

/**
 * Get a specific setting for authenticated user
 */
router.get('/:key', async (req: Request, res) => {
  try {
    const userId = req.user!.userId;
    const { key } = req.params;
    
    const value = await dbManager.getSetting(userId, key);
    
    if (value !== undefined) {
      res.json({ key, value });
    } else {
      res.status(404).json({ error: 'Setting not found' });
    }
  } catch (error) {
    console.error('Failed to get setting:', error);
    res.status(500).json({ error: 'Failed to get setting' });
  }
});

  return router;
};

// Temporary backward compatibility
export default createSettingsRouter;