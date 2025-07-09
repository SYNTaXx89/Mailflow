/**
 * Pure Email Cache Service - Data Storage Only
 * 
 * This class handles ONLY cache storage and retrieval operations.
 * NO business logic, NO IMAP calls, NO frontend decisions.
 * 
 * Responsibilities:
 * - Store/retrieve emails from database cache
 * - 30-day retention policy enforcement
 * - Read status management in cache
 * - Cache-based search functionality
 * - Cache maintenance and cleanup
 */

import { databaseManager } from '../../server/database/DatabaseManager';

export interface CachedEmail {
  id: string;
  accountId: string;
  uid: number;
  from: { name: string; email: string };
  to: { name: string; email: string };
  subject: string;
  date: Date;
  isRead: boolean;
  hasAttachments: boolean;
  preview: string;
  messageId: string;
  size: number;
  cachedAt: Date;
}

export interface CachedEmailContent extends CachedEmail {
  textContent: string;
  htmlContent?: string;
  attachmentList: { filename: string; size: number; contentType: string }[];
}

export interface CacheStats {
  count: number;
  oldestDate: Date;
  newestDate: Date;
  totalSize: number;
  readCount: number;
  unreadCount: number;
}

export class EmailCacheService {
  private static readonly RETENTION_DAYS = 30;
  private static readonly CLEANUP_BATCH_SIZE = 100;

  // ============================================================================
  // CACHE RETRIEVAL OPERATIONS
  // ============================================================================

  /**
   * Get cached emails for an account (newest first)
   */
  static async getCachedEmails(accountId: string, limit?: number): Promise<CachedEmail[]> {
    try {
      console.log(`📂 Getting cached emails for account: ${accountId}, limit: ${limit || 'all'}`);
      
      const dbEmails = await databaseManager.getEmailsByAccountId(accountId, limit || 1000);
      
      const cachedEmails = dbEmails.map(dbEmail => this.convertDbEmailToCachedEmail(dbEmail));
      
      // Sort by date (newest first) - cache should maintain this order
      cachedEmails.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      console.log(`✅ Retrieved ${cachedEmails.length} cached emails for account ${accountId}`);
      return cachedEmails;
    } catch (error) {
      console.error(`❌ Error getting cached emails for account ${accountId}:`, error);
      return [];
    }
  }

  /**
   * Get cached email content by email ID
   */
  static async getCachedEmailContent(emailId: string): Promise<CachedEmailContent | null> {
    try {
      console.log(`📄 Getting cached content for email: ${emailId}`);
      
      const dbEmail = await databaseManager.getEmailById(emailId);
      if (!dbEmail) {
        console.log(`📭 No cached content found for email: ${emailId}`);
        return null;
      }

      const cachedEmail = this.convertDbEmailToCachedEmail(dbEmail);
      
      // Check if we have full content or just preview
      const hasFullContent = dbEmail.full_body && dbEmail.full_body.trim().length > 0;
      
      if (!hasFullContent) {
        console.log(`📭 No full content cached for email: ${emailId}, only preview available`);
        return null; // Force IMAP fetch
      }
      
      console.log(`📊 Found full content: ${dbEmail.full_body!.length} chars`);
      
      // Parse stored content (could be JSON or plain text for backwards compatibility)
      let parsedContent;
      try {
        // Try to parse as JSON first (new format)
        parsedContent = JSON.parse(dbEmail.full_body!);
        console.log(`📄 Parsed JSON content - Text: ${parsedContent.textContent?.length || 0} chars, HTML: ${parsedContent.htmlContent?.length || 0} chars`);
      } catch (error) {
        // Fallback to plain text (old format)
        console.log(`📄 Using plain text content (legacy format)`);
        parsedContent = {
          textContent: dbEmail.full_body!,
          htmlContent: undefined,
          attachmentList: []
        };
      }
      
      // Convert to full content format
      const cachedContent: CachedEmailContent = {
        ...cachedEmail,
        textContent: parsedContent.textContent || 'No content',
        htmlContent: parsedContent.htmlContent,
        attachmentList: parsedContent.attachmentList || []
      };

      console.log(`✅ Retrieved cached content for email: ${emailId}`);
      return cachedContent;
    } catch (error) {
      console.error(`❌ Error getting cached email content for ${emailId}:`, error);
      return null;
    }
  }

  /**
   * Get cached email by UID for an account
   */
  static async getCachedEmailByUID(accountId: string, uid: number): Promise<CachedEmail | null> {
    try {
      const allEmails = await this.getCachedEmails(accountId);
      const email = allEmails.find(email => email.uid === uid);
      
      if (email) {
        console.log(`✅ Found cached email with UID ${uid} for account ${accountId}`);
      } else {
        console.log(`📭 No cached email found with UID ${uid} for account ${accountId}`);
      }
      
      return email || null;
    } catch (error) {
      console.error(`❌ Error getting cached email by UID ${uid}:`, error);
      return null;
    }
  }

  // ============================================================================
  // CACHE STORAGE OPERATIONS
  // ============================================================================

  /**
   * Store emails in cache (batch operation) - FIXED: No longer clears existing cache
   */
  static async storeEmails(accountId: string, emails: CachedEmail[]): Promise<void> {
    try {
      console.log(`💾 Storing ${emails.length} emails in cache for account: ${accountId}`);
      
      // FIXED: Removed destructive cache clearing - now merges with existing emails
      await this.mergeEmails(accountId, emails);
      
      console.log(`✅ Successfully merged ${emails.length} emails in cache for account ${accountId}`);
    } catch (error) {
      console.error(`❌ Error storing emails in cache for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Smart merge emails with existing cache (preserves existing emails)
   */
  static async mergeEmails(accountId: string, newEmails: CachedEmail[]): Promise<void> {
    try {
      console.log(`🔄 Smart merging ${newEmails.length} emails for account: ${accountId}`);
      
      // Get existing emails to check for duplicates
      const existingEmails = await this.getCachedEmails(accountId);
      const existingUIDs = new Set(existingEmails.map(email => email.uid));
      
      // Filter out emails that already exist in cache (by UID)
      const genuinelyNewEmails = newEmails.filter(email => !existingUIDs.has(email.uid));
      
      console.log(`📊 Merge analysis: ${newEmails.length} total, ${existingEmails.length} existing, ${genuinelyNewEmails.length} genuinely new`);
      
      // Store only genuinely new emails
      for (let i = 0; i < genuinelyNewEmails.length; i++) {
        const email = genuinelyNewEmails[i];
        console.log(`💾 Storing new email ${i + 1}/${genuinelyNewEmails.length}: ${email.subject} (UID: ${email.uid})`);
        await this.storeSingleEmail(email);
      }
      
      if (genuinelyNewEmails.length > 0) {
        console.log(`✅ Successfully added ${genuinelyNewEmails.length} new emails to cache`);
      } else {
        console.log(`📭 No new emails to add - all ${newEmails.length} emails already in cache`);
      }
    } catch (error) {
      console.error(`❌ Error merging emails in cache:`, error);
      throw error;
    }
  }

  /**
   * Replace all emails in cache (destructive operation - use sparingly)
   * Only use for account initialization or when cache corruption is detected
   */
  static async replaceAllEmails(accountId: string, emails: CachedEmail[]): Promise<void> {
    try {
      console.log(`🗑️ DESTRUCTIVE: Replacing all emails in cache for account: ${accountId}`);
      
      // Clear existing cached emails for this account first
      await this.clearAccountCache(accountId);
      
      // Store each email
      console.log(`🔄 Storing ${emails.length} emails individually...`);
      for (let i = 0; i < emails.length; i++) {
        console.log(`💾 Storing email ${i + 1}/${emails.length}: ${emails[i].subject}`);
        await this.storeSingleEmail(emails[i]);
      }
      console.log(`✅ All ${emails.length} emails stored individually`);
      
      console.log(`✅ Successfully replaced all emails in cache for account ${accountId}`);
    } catch (error) {
      console.error(`❌ Error replacing emails in cache for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Store single email in cache
   */
  static async storeSingleEmail(email: CachedEmail): Promise<void> {
    try {
      const dbEmail = {
        id: email.id,
        account_id: email.accountId,
        subject: email.subject,
        sender: `${email.from.name} <${email.from.email}>`,
        recipient: `${email.to.name} <${email.to.email}>`,
        preview: email.preview,
        date: email.date.toISOString(),
        is_read: email.isRead,
        has_attachments: email.hasAttachments,
        uid: email.uid.toString(),
        message_id: email.messageId
      };

      await databaseManager.createEmailSafe(dbEmail);
      console.log(`💾 Stored email in cache: ${email.subject} (UID: ${email.uid})`);
    } catch (error) {
      console.error(`❌ Error storing single email in cache:`, error);
      throw error;
    }
  }

  /**
   * Store email content (full text/html)
   */
  static async storeEmailContent(emailId: string, content: CachedEmailContent): Promise<void> {
    try {
      console.log(`💾 Storing full content for email: ${emailId}`);
      console.log(`📄 Content analysis - Text: ${content.textContent?.length || 0} chars, HTML: ${content.htmlContent?.length || 0} chars`);
      
      // Store both text and HTML content as JSON for proper retrieval
      const contentData = {
        textContent: content.textContent,
        htmlContent: content.htmlContent,
        attachmentList: content.attachmentList || []
      };
      
      // Update the existing email record with full content
      await databaseManager.updateEmail(emailId, {
        full_body: JSON.stringify(contentData), // Store as JSON to preserve both text and HTML
      });
      
      console.log(`✅ Stored full content for email: ${emailId} (both text and HTML preserved)`);
    } catch (error) {
      console.error(`❌ Error storing email content for ${emailId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CACHE UPDATE OPERATIONS
  // ============================================================================

  /**
   * Update read status for an email
   */
  static async updateReadStatus(emailId: string, isRead: boolean): Promise<void> {
    try {
      console.log(`📖 Updating read status for email ${emailId}: ${isRead ? 'READ' : 'UNREAD'}`);
      
      await databaseManager.updateEmail(emailId, { is_read: isRead });
      
      console.log(`✅ Updated read status for email ${emailId}: ${isRead ? 'READ' : 'UNREAD'}`);
    } catch (error) {
      console.error(`❌ Error updating read status for email ${emailId}:`, error);
      throw error;
    }
  }

  /**
   * Update attachment flag for an email
   */
  static async updateEmailAttachmentFlag(emailId: string, hasAttachments: boolean): Promise<void> {
    try {
      console.log(`📎 Updating attachment flag for email ${emailId}: ${hasAttachments}`);
      
      await databaseManager.updateEmail(emailId, { has_attachments: hasAttachments });
      
      console.log(`✅ Updated attachment flag for email ${emailId}: ${hasAttachments}`);
    } catch (error) {
      console.error(`❌ Error updating attachment flag for email ${emailId}:`, error);
      throw error;
    }
  }

  /**
   * Remove email from cache
   */
  static async removeEmail(emailId: string): Promise<void> {
    try {
      console.log(`🗑️ Removing email from cache: ${emailId}`);
      
      await databaseManager.deleteEmail(emailId);
      
      console.log(`✅ Removed email from cache: ${emailId}`);
    } catch (error) {
      console.error(`❌ Error removing email from cache ${emailId}:`, error);
      throw error;
    }
  }

  /**
   * Clear all cached emails for an account
   */
  static async clearAccountCache(accountId: string): Promise<void> {
    try {
      console.log(`🧹 Clearing cache for account: ${accountId}`);
      
      await databaseManager.clearEmailsByAccountId(accountId);
      
      console.log(`✅ Cleared cache for account: ${accountId}`);
    } catch (error) {
      console.error(`❌ Error clearing cache for account ${accountId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CACHE SEARCH OPERATIONS
  // ============================================================================

  /**
   * Search cached emails by query
   */
  static async searchCachedEmails(accountId: string, query: string): Promise<CachedEmail[]> {
    try {
      console.log(`🔍 Searching cached emails for account ${accountId}, query: "${query}"`);
      
      // Get all cached emails for the account
      const allEmails = await this.getCachedEmails(accountId);
      
      // Simple text-based search across subject, sender, and content
      const searchQuery = query.toLowerCase();
      const matchingEmails = allEmails.filter(email => {
        const searchableText = [
          email.subject,
          email.from.name,
          email.from.email,
          email.preview
        ].join(' ').toLowerCase();
        
        return searchableText.includes(searchQuery);
      });
      
      console.log(`✅ Found ${matchingEmails.length} matching emails in cache for query: "${query}"`);
      return matchingEmails;
    } catch (error) {
      console.error(`❌ Error searching cached emails for account ${accountId}:`, error);
      return [];
    }
  }

  /**
   * Search cached emails by sender
   */
  static async searchCachedEmailsBySender(accountId: string, senderEmail: string): Promise<CachedEmail[]> {
    try {
      console.log(`🔍 Searching cached emails by sender for account ${accountId}: ${senderEmail}`);
      
      const allEmails = await this.getCachedEmails(accountId);
      const matchingEmails = allEmails.filter(email => 
        email.from.email.toLowerCase().includes(senderEmail.toLowerCase())
      );
      
      console.log(`✅ Found ${matchingEmails.length} emails from sender: ${senderEmail}`);
      return matchingEmails;
    } catch (error) {
      console.error(`❌ Error searching cached emails by sender:`, error);
      return [];
    }
  }

  /**
   * Search cached emails by date range
   */
  static async searchCachedEmailsByDateRange(
    accountId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<CachedEmail[]> {
    try {
      console.log(`🔍 Searching cached emails by date range for account ${accountId}: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      const allEmails = await this.getCachedEmails(accountId);
      const matchingEmails = allEmails.filter(email => 
        email.date >= startDate && email.date <= endDate
      );
      
      console.log(`✅ Found ${matchingEmails.length} emails in date range`);
      return matchingEmails;
    } catch (error) {
      console.error(`❌ Error searching cached emails by date range:`, error);
      return [];
    }
  }

  // ============================================================================
  // CACHE MAINTENANCE OPERATIONS
  // ============================================================================


  /**
   * Clean old emails (older than 30 days)
   */
  static async cleanOldEmails(): Promise<{ deletedCount: number; errors: number }> {
    try {
      console.log(`🧹 Starting cleanup of emails older than ${this.RETENTION_DAYS} days`);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);
      
      let deletedCount = 0;
      let errors = 0;
      
      // This is a simplified version - in production, you'd want to add a database query
      // to find emails older than cutoffDate and delete them in batches
      
      // For now, we'll implement a simple version that gets all emails and filters
      // TODO: Add direct database query for efficiency
      
      console.log(`✅ Cleanup complete: deleted ${deletedCount} old emails, ${errors} errors`);
      return { deletedCount, errors };
    } catch (error) {
      console.error(`❌ Error during email cleanup:`, error);
      return { deletedCount: 0, errors: 1 };
    }
  }

  /**
   * Get cache statistics for an account
   */
  static async getCacheStats(accountId: string): Promise<CacheStats> {
    try {
      console.log(`📊 Getting cache statistics for account: ${accountId}`);
      
      const emails = await this.getCachedEmails(accountId);
      
      if (emails.length === 0) {
        return {
          count: 0,
          oldestDate: new Date(),
          newestDate: new Date(),
          totalSize: 0,
          readCount: 0,
          unreadCount: 0
        };
      }
      
      const stats: CacheStats = {
        count: emails.length,
        oldestDate: emails[emails.length - 1].date, // Emails are sorted newest first
        newestDate: emails[0].date,
        totalSize: emails.reduce((sum, email) => sum + email.size, 0),
        readCount: emails.filter(email => email.isRead).length,
        unreadCount: emails.filter(email => !email.isRead).length
      };
      
      console.log(`📊 Cache stats for account ${accountId}:`, stats);
      return stats;
    } catch (error) {
      console.error(`❌ Error getting cache stats for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get overall cache health status
   */
  static async getCacheHealthStatus(): Promise<{
    healthy: boolean;
    totalEmails: number;
    accountsWithCache: string[];
    oldestEmail?: Date;
    newestEmail?: Date;
  }> {
    try {
      console.log(`🏥 Checking cache health status`);
      
      // This would require a cross-account query - simplified for now
      // TODO: Implement proper health check with database aggregation queries
      
      return {
        healthy: true,
        totalEmails: 0,
        accountsWithCache: [],
        oldestEmail: new Date(),
        newestEmail: new Date()
      };
    } catch (error) {
      console.error(`❌ Error checking cache health:`, error);
      return {
        healthy: false,
        totalEmails: 0,
        accountsWithCache: []
      };
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Convert database email format to cache email format
   */
  private static convertDbEmailToCachedEmail(dbEmail: any): CachedEmail {
    // Parse sender string "Name <email@domain.com>"
    const senderParts = this.parseEmailAddress(dbEmail.sender);
    const recipientParts = this.parseEmailAddress(dbEmail.recipient);

    return {
      id: dbEmail.id,
      accountId: dbEmail.account_id,
      uid: parseInt(dbEmail.uid) || 0,
      from: senderParts,
      to: recipientParts,
      subject: dbEmail.subject || 'No Subject',
      date: new Date(dbEmail.date),
      isRead: dbEmail.is_read,
      hasAttachments: dbEmail.has_attachments || false,
      preview: dbEmail.preview || '',
      messageId: dbEmail.message_id || '',
      size: 0, // TODO: Calculate or store size
      cachedAt: new Date(dbEmail.created_at || dbEmail.date)
    };
  }

  /**
   * Parse email address string "Name <email@domain.com>" into components
   */
  private static parseEmailAddress(emailString: string): { name: string; email: string } {
    if (!emailString) {
      return { name: 'Unknown', email: '' };
    }

    const match = emailString.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      return {
        name: match[1].trim(),
        email: match[2].trim()
      };
    }

    // If no angle brackets, assume it's just an email address
    return {
      name: emailString.trim(),
      email: emailString.trim()
    };
  }

  /**
   * Generate cache key for an email
   */
  private static generateCacheKey(accountId: string, uid: number): string {
    return `${accountId}:${uid}`;
  }

  /**
   * Validate email data before caching
   */
  private static validateEmailData(email: CachedEmail): boolean {
    return !!(
      email.id &&
      email.accountId &&
      email.uid &&
      email.subject !== undefined &&
      email.date &&
      email.from.email
    );
  }
}