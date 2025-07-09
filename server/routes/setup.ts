/**
 * Setup Routes - Initial instance setup endpoints
 * 
 * Handles the setup wizard flow for new Mailflow instances.
 * These routes are accessible without authentication during setup.
 */

import express from 'express';
import { SetupController } from '../controllers/SetupController';
import { AuthMiddleware } from '../auth/AuthMiddleware';

const router = express.Router();

/**
 * GET /setup/status
 * Check if instance needs setup
 */
router.get('/status', SetupController.getSetupStatus);

/**
 * POST /setup/initialize
 * Initialize the setup process
 */
router.post('/initialize', SetupController.initializeSetup);

/**
 * POST /setup/admin
 * Create admin account
 */
router.post('/admin', SetupController.createAdmin);

/**
 * POST /setup/configure
 * Configure instance settings (requires admin auth)
 */
router.post('/configure', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, SetupController.configureInstance);

/**
 * POST /setup/complete
 * Complete the setup process (requires admin auth)
 */
router.post('/complete', AuthMiddleware.authenticate, AuthMiddleware.requireAdmin, SetupController.completeSetup);

/**
 * POST /setup/reset
 * Reset setup (development only)
 */
router.post('/reset', SetupController.resetSetup);

export default router;