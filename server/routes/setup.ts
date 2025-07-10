/**
 * Setup Routes - Initial instance setup endpoints
 * 
 * Handles the setup wizard flow for new Mailflow instances.
 * These routes are accessible without authentication during setup.
 */

import express from 'express';
import { SetupController } from '../controllers/SetupController';
import { AuthMiddleware } from '../auth/AuthMiddleware';
import { ConfigManager } from '../config/ConfigManager';
import { DatabaseManager } from '../database/DatabaseManager';
import { TokenManager } from '../auth/TokenManager';

export const createSetupRouter = (configManager: ConfigManager, databaseManager: DatabaseManager, authMiddleware?: AuthMiddleware) => {
  const router = express.Router();
  const tokenManager = new TokenManager(configManager);
  const setupController = new SetupController(configManager, databaseManager, tokenManager);

  /**
   * GET /setup/status
   * Check if instance needs setup
   */
  router.get('/status', (req, res) => setupController.getSetupStatus(req, res));

  /**
   * POST /setup/initialize
   * Initialize the setup process
   */
  router.post('/initialize', (req, res) => setupController.initializeSetup(req, res));

  /**
   * POST /setup/admin
   * Create admin account
   */
  router.post('/admin', (req, res) => setupController.createAdmin(req, res));

  /**
   * POST /setup/configure
   * Configure instance settings (requires admin auth)
   */
  if (authMiddleware) {
    router.post('/configure', authMiddleware.authenticate, authMiddleware.requireAdmin, (req, res) => setupController.configureInstance(req, res));
  } else {
    router.post('/configure', (req, res) => setupController.configureInstance(req, res));
  }

  /**
   * POST /setup/complete
   * Complete the setup process (requires admin auth)
   */
  if (authMiddleware) {
    router.post('/complete', authMiddleware.authenticate, authMiddleware.requireAdmin, (req, res) => setupController.completeSetup(req, res));
  } else {
    router.post('/complete', (req, res) => setupController.completeSetup(req, res));
  }

  /**
   * POST /setup/reset
   * Reset setup (development only, requires admin auth in production)
   */
  if (process.env.NODE_ENV === 'production' && authMiddleware) {
    router.post('/reset', authMiddleware.authenticate, authMiddleware.requireAdmin, (req, res) => setupController.resetSetup(req, res));
  } else {
    router.post('/reset', (req, res) => setupController.resetSetup(req, res));
  }

  return router;
};

// Temporary backward compatibility
export default createSetupRouter;