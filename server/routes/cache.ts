/**
 * Cache API Routes - Testing EmailCacheService
 * 
 * Test routes for validating the EmailCacheService functionality
 */

import express from 'express';
import { EmailCacheService, CachedEmail } from '../cache/EmailCacheService';

const router = express.Router();

// GET /api/cache/:accountId/emails
router.get('/:accountId/emails', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { limit } = req.query;
    
    console.log(`📂 Getting cached emails for account: ${accountId}`);
    
    const emails = await EmailCacheService.getCachedEmails(
      accountId, 
      limit ? parseInt(limit as string) : undefined
    );
    
    res.json({
      success: true,
      emails: emails,
      count: emails.length,
      source: 'cache'
    });
  } catch (error) {
    console.error('❌ Error getting cached emails:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cached emails'
    });
  }
});

// GET /api/cache/email/:emailId/content
router.get('/email/:emailId/content', async (req, res) => {
  try {
    const { emailId } = req.params;
    
    console.log(`📄 Getting cached content for email: ${emailId}`);
    
    const content = await EmailCacheService.getCachedEmailContent(emailId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Email content not found in cache'
      });
    }
    
    res.json({
      success: true,
      content: content,
      source: 'cache'
    });
  } catch (error) {
    console.error('❌ Error getting cached email content:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cached email content'
    });
  }
});

// POST /api/cache/:accountId/emails
router.post('/:accountId/emails', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { emails } = req.body;
    
    if (!Array.isArray(emails)) {
      return res.status(400).json({
        success: false,
        error: 'Emails must be an array'
      });
    }
    
    console.log(`💾 Storing ${emails.length} emails in cache for account: ${accountId}`);
    
    await EmailCacheService.storeEmails(accountId, emails);
    
    res.json({
      success: true,
      message: `Stored ${emails.length} emails in cache`,
      count: emails.length
    });
  } catch (error) {
    console.error('❌ Error storing emails in cache:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to store emails in cache'
    });
  }
});

// POST /api/cache/email/:emailId/read
router.post('/email/:emailId/read', async (req, res) => {
  try {
    const { emailId } = req.params;
    const { isRead = true } = req.body;
    
    console.log(`📖 Updating read status for email ${emailId}: ${isRead ? 'READ' : 'unread'}`);
    
    await EmailCacheService.updateReadStatus(emailId, isRead);
    
    res.json({
      success: true,
      message: `Email marked as ${isRead ? 'read' : 'unread'}`,
      emailId: emailId,
      isRead: isRead
    });
  } catch (error) {
    console.error('❌ Error updating read status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update read status'
    });
  }
});

// DELETE /api/cache/email/:emailId
router.delete('/email/:emailId', async (req, res) => {
  try {
    const { emailId } = req.params;
    
    console.log(`🗑️ Removing email from cache: ${emailId}`);
    
    await EmailCacheService.removeEmail(emailId);
    
    res.json({
      success: true,
      message: 'Email removed from cache',
      emailId: emailId
    });
  } catch (error) {
    console.error('❌ Error removing email from cache:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove email from cache'
    });
  }
});

// GET /api/cache/:accountId/search?q=query
router.get('/:accountId/search', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { q: query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    console.log(`🔍 Searching cached emails for account ${accountId}, query: "${query}"`);
    
    const results = await EmailCacheService.searchCachedEmails(accountId, query);
    
    res.json({
      success: true,
      results: results,
      count: results.length,
      query: query,
      source: 'cache'
    });
  } catch (error) {
    console.error('❌ Error searching cached emails:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search cached emails'
    });
  }
});

// GET /api/cache/:accountId/stats
router.get('/:accountId/stats', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log(`📊 Getting cache stats for account: ${accountId}`);
    
    const stats = await EmailCacheService.getCacheStats(accountId);
    
    res.json({
      success: true,
      stats: stats,
      accountId: accountId
    });
  } catch (error) {
    console.error('❌ Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cache stats'
    });
  }
});

// DELETE /api/cache/:accountId
router.delete('/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log(`🧹 Clearing cache for account: ${accountId}`);
    
    await EmailCacheService.clearAccountCache(accountId);
    
    res.json({
      success: true,
      message: 'Account cache cleared',
      accountId: accountId
    });
  } catch (error) {
    console.error('❌ Error clearing account cache:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear account cache'
    });
  }
});

// POST /api/cache/cleanup
router.post('/cleanup', async (req, res) => {
  try {
    console.log(`🧹 Starting cache cleanup (removing emails older than 30 days)`);
    
    const result = await EmailCacheService.cleanOldEmails();
    
    res.json({
      success: true,
      message: 'Cache cleanup completed',
      deletedCount: result.deletedCount,
      errors: result.errors
    });
  } catch (error) {
    console.error('❌ Error during cache cleanup:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cleanup cache'
    });
  }
});

// GET /api/cache/health
router.get('/health', async (req, res) => {
  try {
    console.log(`🏥 Checking cache health status`);
    
    const health = await EmailCacheService.getCacheHealthStatus();
    
    res.json({
      success: true,
      health: health
    });
  } catch (error) {
    console.error('❌ Error checking cache health:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check cache health'
    });
  }
});

export default router;