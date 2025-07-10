/**
 * IMAP IDLE Routes
 * 
 * API endpoints for managing real-time IMAP IDLE connections.
 * Provides controls for starting, stopping, and monitoring IDLE connections.
 */

import express from 'express';
import { EmailService } from '../services/EmailService';
import { getAccountWithCredentials } from '../utils/accountHelpers';
import { DatabaseManager } from '../database/DatabaseManager';
import { EmailCacheService } from '../cache/EmailCacheService';

export function createIdleRouter(databaseManager: DatabaseManager, emailCacheService: EmailCacheService): express.Router {
  const router = express.Router();

/**
 * POST /api/idle/:accountId/start
 * Start IDLE connection for an account
 */
  router.post('/:accountId/start', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log(`🔄 POST /api/idle/${accountId}/start`);
    
    // Get account details
    const account = await getAccountWithCredentials(accountId, databaseManager);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }
    
    // Create EmailService instance
    const emailService = EmailService.createFromAccount(account, emailCacheService);
    
    // Start IDLE connection with event callback
    await emailService.startIdleConnection((event: string, data: any) => {
      console.log(`📡 IDLE Event for ${accountId}: ${event}`, data);
      // TODO: Implement WebSocket/SSE for real-time frontend notifications
    });
    
    console.log(`✅ IDLE connection started for account: ${accountId}`);
    
    res.json({
      success: true,
      message: 'IDLE connection started',
      accountId: accountId,
      status: emailService.getIdleStatus()
    });
    
  } catch (error) {
    console.error('❌ Error starting IDLE connection:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start IDLE connection'
    });
  }
});

/**
 * POST /api/idle/:accountId/stop
 * Stop IDLE connection for an account
 */
  router.post('/:accountId/stop', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log(`🛑 POST /api/idle/${accountId}/stop`);
    
    // Get account details
    const account = await getAccountWithCredentials(accountId, databaseManager);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }
    
    // Create EmailService instance and stop IDLE
    const emailService = EmailService.createFromAccount(account, emailCacheService);
    await emailService.stopIdleConnection();
    
    console.log(`✅ IDLE connection stopped for account: ${accountId}`);
    
    res.json({
      success: true,
      message: 'IDLE connection stopped',
      accountId: accountId
    });
    
  } catch (error) {
    console.error('❌ Error stopping IDLE connection:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop IDLE connection'
    });
  }
});

/**
 * GET /api/idle/:accountId/status
 * Get IDLE connection status for an account
 */
  router.get('/:accountId/status', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log(`📊 GET /api/idle/${accountId}/status`);
    
    // Get account details
    const account = await getAccountWithCredentials(accountId, databaseManager);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }
    
    // Create EmailService instance and get status
    const emailService = EmailService.createFromAccount(account, emailCacheService);
    const status = emailService.getIdleStatus();
    
    res.json({
      success: true,
      accountId: accountId,
      status: status || {
        isConnected: false,
        isIdling: false,
        supportsIdle: false,
        lastActivity: null,
        connectionAttempts: 0
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting IDLE status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get IDLE status'
    });
  }
});

/**
 * POST /api/idle/:accountId/refresh
 * Manual refresh during IDLE connection
 */
  router.post('/:accountId/refresh', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log(`🔄 POST /api/idle/${accountId}/refresh`);
    
    // Get account details
    const account = await getAccountWithCredentials(accountId, databaseManager);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }
    
    // Create EmailService instance and perform refresh
    const emailService = EmailService.createFromAccount(account, emailCacheService);
    await emailService.refreshDuringIdle();
    
    console.log(`✅ Manual refresh completed for account: ${accountId}`);
    
    res.json({
      success: true,
      message: 'Manual refresh completed',
      accountId: accountId
    });
    
  } catch (error) {
    console.error('❌ Error during manual refresh:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to perform manual refresh'
    });
  }
});

/**
 * GET /api/idle/status
 * Get IDLE connection status for all accounts
 */
  router.get('/status', async (req, res) => {
  try {
    console.log('📊 GET /api/idle/status');
    
    const allStatuses = EmailService.getAllIdleStatuses();
    const statusArray = Array.from(allStatuses.entries()).map(([accountId, status]) => ({
      accountId,
      status
    }));
    
    res.json({
      success: true,
      accounts: statusArray,
      totalAccounts: statusArray.length
    });
    
  } catch (error) {
    console.error('❌ Error getting all IDLE statuses:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get IDLE statuses'
    });
  }
});

/**
 * POST /api/idle/stop-all
 * Stop all IDLE connections
 */
  router.post('/stop-all', async (req, res) => {
  try {
    console.log('🛑 POST /api/idle/stop-all');
    
    await EmailService.stopAllIdleConnections();
    
    res.json({
      success: true,
      message: 'All IDLE connections stopped'
    });
    
  } catch (error) {
    console.error('❌ Error stopping all IDLE connections:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop all IDLE connections'
    });
  }
  });

  return router;
}