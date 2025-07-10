/**
 * Smart Email API Routes - Clean Architecture
 * 
 * Simple API routes that delegate all business logic to EmailService.
 * This replaces the old complex email routes with clean separation of concerns.
 * All intelligence is in the EmailService layer.
 */

import express from 'express';
import { EmailService } from '../services';
import { DatabaseManager } from '../database/DatabaseManager';
import { getAccountWithCredentials } from '../utils/accountHelpers';
import { AuthMiddleware } from '../auth/AuthMiddleware';
import { EmailCacheService } from '../cache/EmailCacheService';

export function createEmailsRouter(
  databaseManager: DatabaseManager,
  emailCacheService: EmailCacheService,
  authMiddleware: AuthMiddleware
): express.Router {
  const router = express.Router();
  
  // Apply authentication middleware to all email routes
  router.use(authMiddleware.authenticate);

/**
 * GET /api/emails/:accountId
 * 
 * Smart email loading with cache-first strategy
 * Query params:
 * - forceRefresh: boolean (skip cache)
 * - limit: number (default 30)
 */
  router.get('/:accountId', authMiddleware.requireAccountOwnership(), async (req, res) => {
  try {
    const { accountId } = req.params;
    const { forceRefresh, limit } = req.query;
    
    console.log(`📧 GET /api/emails/${accountId} - ForceRefresh: ${forceRefresh}, Limit: ${limit}`);
    
    // Get account with credentials (already verified by middleware)
    const account = await getAccountWithCredentials(accountId, databaseManager);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }
    
    // Create EmailService instance
    const emailService = EmailService.createFromAccount(account, emailCacheService);
    
    // Get emails using smart business logic
    const result = await emailService.getEmails({
      forceRefresh: forceRefresh === 'true',
      limit: limit ? parseInt(limit as string) : 30
    });
    
    console.log(`✅ Returning ${result.emails.length} emails, source: ${result.source}`);
    console.log(`🔍 DEBUG: About to send HTTP response to client`);
    
    const response = {
      success: true,
      emails: result.emails,
      source: result.source,
      metadata: result.metadata,
      timestamp: new Date().toISOString()
    };
    
    console.log(`🔍 DEBUG: Response object created, sending...`);
    res.json(response);
    console.log(`🔍 DEBUG: res.json() called`);
    
    // Set a timeout to log if response completes
    setTimeout(() => {
      console.log(`🔍 DEBUG: Response should have been sent by now`);
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error in GET /api/emails:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get emails'
    });
  }
});

/**
 * GET /api/emails/:accountId/:emailId/content
 * 
 * Smart email content loading (cache-first)
 */
  router.get('/:accountId/:emailId/content', authMiddleware.requireAccountOwnership(), async (req, res) => {
  try {
    const { accountId, emailId } = req.params;
    
    console.log(`📄 GET /api/emails/${accountId}/${emailId}/content`);
    
    // Get account with credentials (already verified by middleware)
    const account = await getAccountWithCredentials(accountId, databaseManager);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }
    
    // Create EmailService instance
    const emailService = EmailService.createFromAccount(account, emailCacheService);
    
    // Get email content using smart business logic
    const result = await emailService.getEmailContent(emailId);
    
    console.log(`✅ Email content retrieved, source: ${result.source}, time: ${result.fetchTime}ms`);
    
    res.json({
      success: true,
      content: result.content,
      source: result.source,
      fetchTime: result.fetchTime
    });
    
  } catch (error) {
    console.error('❌ Error in GET email content:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get email content'
    });
  }
});

/**
 * POST /api/emails/:accountId/:emailId/read
 * 
 * Mark email as read (both IMAP and cache)
 */
  router.post('/:accountId/:emailId/read', authMiddleware.requireAccountOwnership(), async (req, res) => {
  try {
    const { accountId, emailId } = req.params;
    
    console.log(`📖 POST /api/emails/${accountId}/${emailId}/read`);
    
    // Get account with credentials (already verified by middleware)
    const account = await getAccountWithCredentials(accountId, databaseManager);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }
    
    // Create EmailService instance
    const emailService = EmailService.createFromAccount(account, emailCacheService);
    
    // Mark as read using smart business logic
    await emailService.markAsRead(emailId);
    
    console.log(`✅ Email marked as read: ${emailId}`);
    
    res.json({
      success: true,
      message: 'Email marked as read',
      emailId: emailId
    });
    
  } catch (error) {
    console.error('❌ Error marking email as read:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark email as read'
    });
  }
});

/**
 * DELETE /api/emails/:accountId/:emailId
 * 
 * Delete email (both IMAP and cache)
 */
  router.delete('/:accountId/:emailId', authMiddleware.requireAccountOwnership(), async (req, res) => {
  try {
    const { accountId, emailId } = req.params;
    
    console.log(`🗑️ DELETE /api/emails/${accountId}/${emailId}`);
    
    // Get account with credentials (already verified by middleware)
    const account = await getAccountWithCredentials(accountId, databaseManager);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }
    
    // Create EmailService instance
    const emailService = EmailService.createFromAccount(account, emailCacheService);
    
    // Delete email using smart business logic
    await emailService.deleteEmail(emailId);
    
    console.log(`✅ Email deleted: ${emailId}`);
    
    res.json({
      success: true,
      message: 'Email deleted',
      emailId: emailId
    });
    
  } catch (error) {
    console.error('❌ Error deleting email:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete email'
    });
  }
});

/**
 * GET /api/emails/:accountId/search?q=query
 * 
 * Smart email search (cache + IMAP)
 */
  router.get('/:accountId/search', authMiddleware.requireAccountOwnership(), async (req, res) => {
  try {
    const { accountId } = req.params;
    const { q: query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    console.log(`🔍 GET /api/v2/emails/${accountId}/search?q=${query}`);
    
    // Get account with credentials (already verified by middleware)
    const account = await getAccountWithCredentials(accountId, databaseManager);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }
    
    // Create EmailService instance
    const emailService = EmailService.createFromAccount(account, emailCacheService);
    
    // Search emails using smart business logic
    const result = await emailService.searchEmails(query);
    
    console.log(`✅ Search completed: ${result.totalFound} results in ${result.searchTime}ms`);
    
    res.json({
      success: true,
      results: result.results,
      sources: result.sources,
      totalFound: result.totalFound,
      searchTime: result.searchTime,
      query: query
    });
    
  } catch (error) {
    console.error('❌ Error searching emails:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search emails'
    });
  }
});

/**
 * GET /api/v2/emails/:accountId/:emailId/attachments/:attachmentId
 * 
 * Download email attachment (always from IMAP)
 */
  router.get('/:accountId/:emailId/attachments/:attachmentId', authMiddleware.requireAccountOwnership(), async (req, res) => {
  try {
    const { accountId, emailId, attachmentId } = req.params;
    
    console.log(`📎 GET /api/emails/${accountId}/${emailId}/attachments/${attachmentId}`);
    
    // Get account with credentials (already verified by middleware)
    const account = await getAccountWithCredentials(accountId, databaseManager);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }
    
    // Create EmailService instance
    const emailService = EmailService.createFromAccount(account, emailCacheService);
    
    // Get attachment using smart business logic
    const attachment = await emailService.getAttachment(emailId, attachmentId);
    
    console.log(`✅ Attachment retrieved: ${attachment.filename} (${attachment.size} bytes)`);
    
    // Set proper headers for secure download
    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.setHeader('Content-Length', attachment.size.toString());
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    
    // Send the attachment buffer (use end() for binary data)
    res.end(attachment.buffer);
    
  } catch (error) {
    console.error('❌ Error getting attachment:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get attachment'
    });
  }
});

/**
 * GET /api/v2/emails/:accountId/status
 * 
 * Get account email status (refresh status, cache stats)
 */
  router.get('/:accountId/status', authMiddleware.requireAccountOwnership(), async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log(`📊 GET /api/v2/emails/${accountId}/status`);
    
    // Get refresh status
    const refreshStatus = EmailService.getRefreshStatus(accountId);
    
    // Get cache stats
    const cacheStats = await emailCacheService.getCacheStats(accountId);
    
    res.json({
      success: true,
      accountId: accountId,
      refreshStatus: refreshStatus,
      cacheStats: cacheStats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting account status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get account status'
    });
  }
  });

  // Helper functions moved to ../utils/accountHelpers.ts

  return router;
}