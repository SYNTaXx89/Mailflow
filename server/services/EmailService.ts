/**
 * Smart Email Service - Business Logic Orchestrator
 * 
 * This is the brain of our email system. It orchestrates ImapContainer and EmailCacheService
 * to provide intelligent email operations with cache-first strategy.
 * 
 * Responsibilities:
 * - Smart cache vs IMAP decision making
 * - Background refresh management
 * - Email operation orchestration (read, delete, search)
 * - Data format conversion between layers
 * - Business logic implementation
 */

import { ImapContainer, ImapCredentials, RawEmail, RawEmailContent } from '../../src/imap/ImapContainer';
import { MimeParser } from '../../src/imap/MimeParser';
import { EmailParser } from '../../src/imap/EmailParser';
import { EmailCacheService, CachedEmail, CachedEmailContent } from '../cache/EmailCacheService';
import { IdleConnectionManager, IdleCredentials, IdleEvents } from '../../src/imap/IdleConnectionManager';

export interface EmailServiceCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

export interface EmailServiceOptions {
  forceRefresh?: boolean;
  includeContent?: boolean;
  searchQuery?: string;
  limit?: number;
}

export interface EmailServiceResult {
  emails: CachedEmail[];
  source: 'cache' | 'imap' | 'hybrid';
  metadata: {
    lastSync?: Date;
    isRefreshing: boolean;
    cacheHit: boolean;
    cacheAge?: number;
    imapTotal?: number;
  };
}

export interface EmailContentResult {
  content: CachedEmailContent;
  source: 'cache' | 'imap';
  fetchTime: number;
}

export interface SearchResult {
  results: CachedEmail[];
  sources: { cache: number; imap: number };
  totalFound: number;
  searchTime: number;
}

export class EmailService {
  private imapContainer: ImapContainer;
  private accountId: string;
  private credentials: EmailServiceCredentials;
  
  // IDLE connection management
  private idleManager: IdleConnectionManager | null = null;
  private idleEventCallback: ((event: string, data: any) => void) | null = null;
  
  // Cache management
  private static refreshPromises: Map<string, Promise<CachedEmail[]>> = new Map();
  private static lastSync: Map<string, Date> = new Map();
  private static idleManagers: Map<string, IdleConnectionManager> = new Map();
  
  // Business rules - EMAIL CLIENT TIMING (fast refresh for real-time feel)
  private static readonly CACHE_FRESH_DURATION_MS = 30 * 1000; // 30 seconds (email client needs real-time)
  private static readonly CACHE_STALE_DURATION_MS = 60 * 1000; // 1 minute 
  private static readonly BACKGROUND_REFRESH_THRESHOLD_MS = 30 * 1000; // 30 seconds (trigger background refresh quickly)

  constructor(accountId: string, credentials: EmailServiceCredentials) {
    this.accountId = accountId;
    this.credentials = credentials;
    this.imapContainer = new ImapContainer(credentials);
  }

  // ============================================================================
  // SMART EMAIL LOADING
  // ============================================================================

  /**
   * 🧠 SMART EMAIL LOADING
   * 
   * Business Logic:
   * 1. forceRefresh=true → Skip cache, fetch fresh from IMAP
   * 2. No cache → Fetch fresh from IMAP and cache
   * 3. Cache fresh (< 2min) → Return cache immediately
   * 4. Cache stale (> 2min) → Return cache + trigger background refresh
   */
  async getEmails(options: EmailServiceOptions = {}): Promise<EmailServiceResult> {
    const startTime = Date.now();
    const { forceRefresh = false, limit = 30 } = options;
    
    console.log(`🧠 EmailService.getEmails - Account: ${this.accountId}, ForceRefresh: ${forceRefresh}, Limit: ${limit}`);
    
    try {
      // Step 1: Assess cache situation
      const cacheAssessment = await this.assessCacheStatus();
      console.log(`📊 Cache assessment:`, cacheAssessment);
      
      // Step 2: Business logic decision tree
      if (forceRefresh) {
        console.log(`⚡ Force refresh requested - fetching fresh IMAP data`);
        // Skip cache entirely and fetch fresh data
        return await this.performFreshImapFetch(limit, startTime);
      }
      
      if (cacheAssessment.emails.length === 0) {
        console.log(`📭 No cache found - performing initial IMAP fetch`);
        return await this.performFreshImapFetch(limit, startTime);
      }
      
      if (cacheAssessment.isFresh) {
        console.log(`💨 URGENT: Cache is fresh - returning ${cacheAssessment.emails.length} cached emails immediately`);
        console.log(`🔍 URGENT: Cache UIDs: [${cacheAssessment.emails.slice(0, 5).map(e => e.uid).join(', ')}${cacheAssessment.emails.length > 5 ? '...' : ''}]`);
        const result = {
          emails: cacheAssessment.emails.slice(0, limit),
          source: 'cache' as const,
          metadata: {
            lastSync: cacheAssessment.lastSync,
            isRefreshing: this.isRefreshInProgress(),
            cacheHit: true,
            cacheAge: cacheAssessment.ageMs
          }
        };
        console.log(`🔍 URGENT: Actually returning ${result.emails.length} emails from cache`);
        return result;
      }
      
      if (cacheAssessment.isStale) {
        console.log(`🔄 Cache is stale - returning cache and triggering background refresh`);
        this.triggerBackgroundRefresh(limit);
        return {
          emails: cacheAssessment.emails.slice(0, limit),
          source: 'hybrid',
          metadata: {
            lastSync: cacheAssessment.lastSync,
            isRefreshing: true,
            cacheHit: true,
            cacheAge: cacheAssessment.ageMs
          }
        };
      }
      
      // Default case - return cache
      console.log(`📂 Returning cached emails (default case)`);
      return {
        emails: cacheAssessment.emails.slice(0, limit),
        source: 'cache',
        metadata: {
          lastSync: cacheAssessment.lastSync,
          isRefreshing: false,
          cacheHit: true,
          cacheAge: cacheAssessment.ageMs
        }
      };
      
    } catch (error) {
      console.error(`❌ Error in EmailService.getEmails:`, error);
      
      // Fallback to cache-only mode
      try {
        const fallbackEmails = await EmailCacheService.getCachedEmails(this.accountId, limit);
        return {
          emails: fallbackEmails,
          source: 'cache',
          metadata: {
            isRefreshing: false,
            cacheHit: true
          }
        };
      } catch (fallbackError) {
        console.error(`❌ Fallback to cache also failed:`, fallbackError);
        throw error;
      }
    }
  }

  /**
   * 🧠 SMART EMAIL CONTENT LOADING
   */
  async getEmailContent(emailId: string): Promise<EmailContentResult> {
    const startTime = Date.now();
    console.log(`📄 EmailService.getEmailContent - Email: ${emailId}`);
    
    try {
      // Step 1: Try cache first (fast)
      const cachedContent = await EmailCacheService.getCachedEmailContent(emailId);
      if (cachedContent && (cachedContent.textContent || cachedContent.htmlContent)) {
        console.log(`⚡ Email content found in cache: ${emailId}`);
        console.log(`📄 Cache content analysis:`, {
          hasText: !!cachedContent.textContent,
          hasHtml: !!cachedContent.htmlContent,
          textLength: cachedContent.textContent?.length || 0,
          htmlLength: cachedContent.htmlContent?.length || 0
        });
        
        console.log(`✅ Full content found in cache, returning`);
        return {
          content: cachedContent,
          source: 'cache',
          fetchTime: Date.now() - startTime
        };
      } else {
        console.log(`📭 No cached content found for: ${emailId}`);
      }
      
      // Step 2: Not in cache or insufficient content - fetch from IMAP
      console.log(`🔄 Email content not in cache, fetching from IMAP: ${emailId}`);
      
      const cachedEmail = await EmailCacheService.getCachedEmailByUID(this.accountId, this.extractUidFromEmailId(emailId));
      if (!cachedEmail) {
        throw new Error(`Email not found: ${emailId}`);
      }
      
      // Fetch from IMAP (reuse connection for performance)
      console.log(`⚡ Fetching email content from IMAP (keepalive connection)...`);
      await this.imapContainer.connect();
      const rawContent = await this.imapContainer.fetchEmailContent(cachedEmail.uid);
      // Note: Keep connection alive for subsequent requests (don't disconnect)
      
      // Parse MIME content using robust EmailParser (mailparser library)
      console.log(`🔍 Parsing email content with EmailParser...`);
      const parsedEmail = await EmailParser.parseEmail(rawContent.rawBody);
      const extractedContent = EmailParser.extractEmailContent(parsedEmail);
      
      console.log(`📧 Content extracted - Has HTML: ${!!parsedEmail.html}, Has Text: ${!!parsedEmail.text}`);
      
      // Extract attachments
      const attachments = EmailParser.extractAttachments(parsedEmail);
      console.log(`📎 Found ${attachments.length} attachments`);
      
      // Convert to our format
      const parsedContent = {
        textContent: parsedEmail.text || 'No content',
        htmlContent: parsedEmail.html || undefined,
        attachments: attachments
      };
      
      // Convert and cache
      const processedContent = this.convertRawContentToCachedContent(rawContent, cachedEmail, parsedContent);
      
      // Update hasAttachments flag if we found attachments during parsing
      if (attachments.length > 0 && !cachedEmail.hasAttachments) {
        console.log(`📎 Updating hasAttachments flag for email: ${emailId}`);
        await EmailCacheService.updateEmailAttachmentFlag(emailId, true);
        processedContent.hasAttachments = true;
      }
      
      await EmailCacheService.storeEmailContent(emailId, processedContent);
      
      console.log(`✅ Email content fetched and cached: ${emailId}`);
      return {
        content: processedContent,
        source: 'imap',
        fetchTime: Date.now() - startTime
      };
      
    } catch (error) {
      console.error(`❌ Error getting email content for ${emailId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // EMAIL OPERATIONS
  // ============================================================================

  /**
   * 🧠 SMART READ STATUS MANAGEMENT
   */
  async markAsRead(emailId: string): Promise<void> {
    console.log(`📖 EmailService.markAsRead - Email: ${emailId}`);
    
    try {
      const cachedEmail = await EmailCacheService.getCachedEmailByUID(this.accountId, this.extractUidFromEmailId(emailId));
      if (!cachedEmail) {
        throw new Error(`Email not found: ${emailId}`);
      }

      // Update both IMAP and cache simultaneously
      const imapPromise = this.updateReadStatusInImap(cachedEmail.uid, true);
      const cachePromise = EmailCacheService.updateReadStatus(emailId, true);
      
      await Promise.all([imapPromise, cachePromise]);
      console.log(`✅ Email marked as read: ${emailId}`);
    } catch (error) {
      console.error(`❌ Error marking email as read ${emailId}:`, error);
      throw error;
    }
  }

  /**
   * 🧠 SMART EMAIL DELETION
   */
  async deleteEmail(emailId: string): Promise<void> {
    console.log(`🗑️ EmailService.deleteEmail - Email: ${emailId}`);
    
    try {
      const cachedEmail = await EmailCacheService.getCachedEmailByUID(this.accountId, this.extractUidFromEmailId(emailId));
      if (!cachedEmail) {
        throw new Error(`Email not found: ${emailId}`);
      }

      // Delete from IMAP first, then cache
      await this.imapContainer.connect();
      await this.imapContainer.deleteEmail(cachedEmail.uid);
      await this.imapContainer.disconnect();
      
      await EmailCacheService.removeEmail(emailId);
      console.log(`✅ Email deleted: ${emailId}`);
    } catch (error) {
      console.error(`❌ Error deleting email ${emailId}:`, error);
      throw error;
    }
  }

  /**
   * 🧠 SMART EMAIL SEARCH
   */
  async searchEmails(query: string): Promise<SearchResult> {
    const startTime = Date.now();
    console.log(`🔍 EmailService.searchEmails - Query: "${query}"`);
    
    try {
      // Step 1: Fast cache search
      console.log(`📂 Searching cache for: "${query}"`);
      const cacheResults = await EmailCacheService.searchCachedEmails(this.accountId, query);
      
      // Step 2: Comprehensive IMAP search (if needed)
      let imapResults: CachedEmail[] = [];
      try {
        console.log(`🔄 Searching IMAP for: "${query}"`);
        await this.imapContainer.connect();
        
        // Search by subject first (most common)
        const subjectUIDs = await this.imapContainer.searchEmails(['SUBJECT', query]);
        
        if (subjectUIDs.length > 0) {
          const rawEmails = await this.imapContainer.fetchEmailsByUID(subjectUIDs.slice(0, 20)); // Limit IMAP results
          imapResults = rawEmails.map(raw => this.convertRawEmailToCachedEmail(raw));
        }
        
        await this.imapContainer.disconnect();
      } catch (imapError) {
        console.warn(`⚠️ IMAP search failed, using cache only:`, imapError);
      }
      
      // Step 3: Merge and deduplicate results
      const mergedResults = this.mergeSearchResults(cacheResults, imapResults);
      
      const searchResult: SearchResult = {
        results: mergedResults,
        sources: { cache: cacheResults.length, imap: imapResults.length },
        totalFound: mergedResults.length,
        searchTime: Date.now() - startTime
      };
      
      console.log(`✅ Search complete: ${searchResult.totalFound} results in ${searchResult.searchTime}ms`);
      return searchResult;
      
    } catch (error) {
      console.error(`❌ Error searching emails:`, error);
      throw error;
    }
  }

  /**
   * 🧠 SMART ATTACHMENT HANDLING
   */
  async getAttachment(emailId: string, attachmentId: string): Promise<{
    buffer: Buffer;
    filename: string;
    contentType: string;
    size: number;
  }> {
    console.log(`📎 EmailService.getAttachment - Email: ${emailId}, Attachment: ${attachmentId}`);
    
    try {
      // First get the cached email content to retrieve attachment metadata
      const cachedContent = await EmailCacheService.getCachedEmailContent(emailId);
      if (!cachedContent) {
        throw new Error(`Email not found: ${emailId}`);
      }
      
      // Find the attachment metadata
      const attachmentIndex = parseInt(attachmentId) - 1; // attachmentId is 1-based
      if (attachmentIndex < 0 || attachmentIndex >= cachedContent.attachmentList.length) {
        throw new Error(`Attachment not found: ${attachmentId}`);
      }
      
      const attachmentMeta = cachedContent.attachmentList[attachmentIndex];
      
      // Security: Check attachment size limit (25MB)
      const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB
      if (attachmentMeta.size > MAX_ATTACHMENT_SIZE) {
        throw new Error(`Attachment too large: ${attachmentMeta.size} bytes (max ${MAX_ATTACHMENT_SIZE} bytes)`);
      }

      // Extract UID from emailId
      const uid = this.extractUidFromEmailId(emailId);
      
      // Get the full email content to extract attachment
      await this.imapContainer.connect();
      const rawContent = await this.imapContainer.fetchEmailContent(uid);
      const parsedEmail = await EmailParser.parseEmail(rawContent.rawBody);
      await this.imapContainer.disconnect();
      
      // Get the attachment from the parsed email
      if (!parsedEmail.attachments || parsedEmail.attachments.length <= attachmentIndex) {
        throw new Error(`Attachment ${attachmentId} not found in email`);
      }
      
      const attachment = parsedEmail.attachments[attachmentIndex];
      
      if (!attachment.content) {
        throw new Error(`Attachment ${attachmentId} has no content`);
      }
      
      const attachmentBuffer = attachment.content;
      
      // Security: Sanitize filename to prevent path traversal
      const sanitizedFilename = attachmentMeta.filename.replace(/[^a-zA-Z0-9.-_]/g, '_');
      
      console.log(`✅ Attachment fetched: ${sanitizedFilename} (${attachmentBuffer.length} bytes)`);
      return {
        buffer: attachmentBuffer,
        filename: sanitizedFilename,
        contentType: attachmentMeta.contentType || 'application/octet-stream',
        size: attachmentBuffer.length
      };
    } catch (error) {
      console.error(`❌ Error getting attachment ${attachmentId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Assess current cache status
   */
  private async assessCacheStatus(): Promise<{
    emails: CachedEmail[];
    lastSync?: Date;
    ageMs: number;
    isFresh: boolean;
    isStale: boolean;
  }> {
    const emails = await EmailCacheService.getCachedEmails(this.accountId);
    const lastSync = EmailService.lastSync.get(this.accountId);
    const now = Date.now();
    const ageMs = lastSync ? (now - lastSync.getTime()) : Infinity;
    
    return {
      emails,
      lastSync,
      ageMs,
      isFresh: ageMs < EmailService.CACHE_FRESH_DURATION_MS,
      isStale: ageMs > EmailService.BACKGROUND_REFRESH_THRESHOLD_MS
    };
  }

  /**
   * Perform fresh IMAP fetch and cache results
   */
  private async performFreshImapFetch(limit: number, startTime: number): Promise<EmailServiceResult> {
    console.log(`🔄 Performing fresh IMAP fetch for account: ${this.accountId}`);
    
    try {
      await this.imapContainer.connect();
      
      // Get mailbox info first
      const mailboxInfo = await this.imapContainer.getMailboxInfo();
      console.log(`📊 Mailbox info:`, mailboxInfo);
      
      // Fetch emails - use sequence-based but fetch MORE to ensure we get recent ones
      console.log(`🔄 Fetching emails using sequence-based method with larger buffer`);
      
      // Fetch 50 emails to avoid IMAP timeout (reduced from 100)
      const fetchLimit = Math.min(50, mailboxInfo.total);
      let rawEmails = await this.imapContainer.fetchRecentEmails(fetchLimit);
      
      // Sort by UID (newest first, assuming higher UID = newer) and take only what we need
      rawEmails.sort((a, b) => b.uid - a.uid);
      rawEmails = rawEmails.slice(0, limit);
      
      console.log(`📊 Fetched ${fetchLimit} emails, returning newest ${rawEmails.length}`);
      
      console.log(`🔌 Disconnecting from IMAP server...`);
      await this.imapContainer.disconnect();
      console.log(`✅ IMAP disconnected successfully`);
      
      // Convert to cache format
      console.log(`🔄 Converting ${rawEmails.length} raw emails to cache format...`);
      const cachedEmails = rawEmails.map(raw => this.convertRawEmailToCachedEmail(raw));
      console.log(`✅ Converted to ${cachedEmails.length} cached emails`);
      console.log(`🔍 DEBUG: First cached email:`, cachedEmails[0]?.subject || 'NO SUBJECT');
      
      // Store in cache
      console.log(`💾 Storing ${cachedEmails.length} emails in cache...`);
      await EmailCacheService.storeEmails(this.accountId, cachedEmails);
      console.log(`✅ Cache storage complete`);
      
      // Update sync timestamp
      EmailService.lastSync.set(this.accountId, new Date());
      
      console.log(`✅ Fresh IMAP fetch complete: ${cachedEmails.length} emails cached`);
      
      const result = {
        emails: cachedEmails,
        source: 'imap' as const,
        metadata: {
          lastSync: new Date(),
          isRefreshing: false,
          cacheHit: false,
          imapTotal: mailboxInfo.total
        }
      };
      
      console.log(`🔍 URGENT: EmailService returning ${result.emails.length} emails`);
      console.log(`🔍 URGENT: Email UIDs being returned: [${result.emails.slice(0, 5).map(e => e.uid).join(', ')}${result.emails.length > 5 ? '...' : ''}]`);
      console.log(`🔍 URGENT: Most recent email date: ${result.emails[0]?.date || 'no emails'}`);
      return result;
    } catch (error) {
      console.error(`❌ Fresh IMAP fetch failed:`, error);
      throw error;
    }
  }

  /**
   * Trigger background refresh (non-blocking)
   */
  private triggerBackgroundRefresh(limit: number): void {
    if (EmailService.refreshPromises.has(this.accountId)) {
      console.log(`⏳ Background refresh already in progress for account: ${this.accountId}`);
      return;
    }
    
    console.log(`🚀 Triggering background refresh for account: ${this.accountId}`);
    
    const refreshPromise = this.performFreshImapFetch(limit, Date.now())
      .then(result => {
        console.log(`🎉 Background refresh completed for account: ${this.accountId}`);
        return result.emails;
      })
      .catch(error => {
        console.error(`💥 Background refresh failed for account: ${this.accountId}:`, error);
        return [];
      })
      .finally(() => {
        EmailService.refreshPromises.delete(this.accountId);
      });
    
    EmailService.refreshPromises.set(this.accountId, refreshPromise);
  }

  /**
   * Check if refresh is in progress
   */
  private isRefreshInProgress(): boolean {
    return EmailService.refreshPromises.has(this.accountId);
  }

  // ============================================================================
  // DATA CONVERSION HELPERS
  // ============================================================================

  /**
   * Convert raw IMAP email to cached email format
   */
  private convertRawEmailToCachedEmail(raw: RawEmail): CachedEmail {
    const parsedHeader = MimeParser.parseEmailHeader(raw.headers);
    
    return {
      id: `imap-${raw.uid}`,
      accountId: this.accountId,
      uid: raw.uid,
      from: this.parseEmailAddress(parsedHeader.from),
      to: this.parseEmailAddress(parsedHeader.to),
      subject: parsedHeader.subject,
      date: parsedHeader.date,
      isRead: raw.flags.includes('\\Seen'),
      hasAttachments: MimeParser.checkForAttachments(raw.bodyStructure),
      preview: `${parsedHeader.subject} - ${parsedHeader.from}`,
      messageId: parsedHeader.messageId,
      size: raw.size,
      cachedAt: new Date()
    };
  }

  /**
   * Convert raw email content to cached content format
   */
  private convertRawContentToCachedContent(raw: RawEmailContent, baseEmail: CachedEmail, parsedContent: any): CachedEmailContent {
    return {
      ...baseEmail,
      textContent: parsedContent.textContent,
      htmlContent: parsedContent.htmlContent,
      attachmentList: parsedContent.attachments.map((att: any) => ({
        filename: att.filename,
        size: att.size,
        contentType: att.contentType
      }))
    };
  }

  /**
   * Merge search results and remove duplicates
   */
  private mergeSearchResults(cacheResults: CachedEmail[], imapResults: CachedEmail[]): CachedEmail[] {
    const merged = [...cacheResults];
    const existingUIDs = new Set(cacheResults.map(email => email.uid));
    
    for (const imapEmail of imapResults) {
      if (!existingUIDs.has(imapEmail.uid)) {
        merged.push(imapEmail);
        existingUIDs.add(imapEmail.uid);
      }
    }
    
    // Sort by date (newest first) - use date from parsed emails
    return merged.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /**
   * Update read status in IMAP
   */
  private async updateReadStatusInImap(uid: number, isRead: boolean): Promise<void> {
    await this.imapContainer.connect();
    if (isRead) {
      await this.imapContainer.markAsRead(uid);
    } else {
      await this.imapContainer.markAsUnread(uid);
    }
    await this.imapContainer.disconnect();
  }

  /**
   * Parse email address string
   */
  private parseEmailAddress(emailString: string): { name: string; email: string } {
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

    return {
      name: emailString.trim(),
      email: emailString.trim()
    };
  }

  /**
   * Extract UID from email ID
   */
  private extractUidFromEmailId(emailId: string): number {
    const match = emailId.match(/imap-(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  // ============================================================================
  // IDLE CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Start IDLE connection for real-time email notifications
   */
  async startIdleConnection(eventCallback?: (event: string, data: any) => void): Promise<void> {
    console.log(`🔄 Starting IDLE connection for account: ${this.accountId}`);
    
    // Store callback for events
    this.idleEventCallback = eventCallback || null;
    
    // Convert credentials format
    const idleCredentials: IdleCredentials = {
      host: this.credentials.host,
      port: this.credentials.port,
      secure: this.credentials.secure,
      user: this.credentials.user,
      password: this.credentials.password
    };
    
    // Create IDLE event handlers
    const idleEvents: IdleEvents = {
      onNewMail: (count: number) => {
        console.log(`📧 IDLE: New mail notification for account ${this.accountId}: ${count} messages`);
        this.handleIdleNewMail(count);
      },
      
      onMailDeleted: (seqno: number) => {
        console.log(`🗑️ IDLE: Email deleted notification for account ${this.accountId}: sequence ${seqno}`);
        this.handleIdleMailDeleted(seqno);
      },
      
      onError: (error: Error) => {
        console.error(`❌ IDLE: Connection error for account ${this.accountId}:`, error);
        this.handleIdleError(error);
      },
      
      onConnect: () => {
        console.log(`✅ IDLE: Connected for account ${this.accountId}`);
        this.handleIdleConnect();
      },
      
      onDisconnect: () => {
        console.log(`📡 IDLE: Disconnected for account ${this.accountId}`);
        this.handleIdleDisconnect();
      }
    };
    
    // Create and start IDLE manager
    this.idleManager = new IdleConnectionManager(idleCredentials, idleEvents);
    EmailService.idleManagers.set(this.accountId, this.idleManager);
    
    try {
      await this.idleManager.start();
      console.log(`✅ IDLE connection started for account: ${this.accountId}`);
    } catch (error) {
      console.error(`❌ Failed to start IDLE connection for account ${this.accountId}:`, error);
      throw error;
    }
  }

  /**
   * Stop IDLE connection
   */
  async stopIdleConnection(): Promise<void> {
    console.log(`🛑 Stopping IDLE connection for account: ${this.accountId}`);
    
    if (this.idleManager) {
      try {
        await this.idleManager.stop();
        EmailService.idleManagers.delete(this.accountId);
        this.idleManager = null;
        console.log(`✅ IDLE connection stopped for account: ${this.accountId}`);
      } catch (error) {
        console.error(`❌ Error stopping IDLE connection for account ${this.accountId}:`, error);
      }
    }
  }

  /**
   * Manual refresh during IDLE connection
   */
  async refreshDuringIdle(): Promise<void> {
    if (this.idleManager) {
      console.log(`🔄 Manual refresh during IDLE for account: ${this.accountId}`);
      await this.idleManager.manualRefresh();
    } else {
      console.log(`🔄 No IDLE connection active, using regular refresh for account: ${this.accountId}`);
      // Fall back to regular refresh
      const result = await this.getEmails({ forceRefresh: true });
      console.log(`✅ Regular refresh complete: ${result.emails.length} emails`);
    }
  }

  /**
   * Get IDLE connection status
   */
  getIdleStatus() {
    return this.idleManager ? this.idleManager.getStatus() : null;
  }

  // ============================================================================
  // IDLE EVENT HANDLERS
  // ============================================================================

  private async handleIdleNewMail(count: number): Promise<void> {
    try {
      if (count === 0) {
        // Manual refresh or polling check
        console.log(`🔄 IDLE: Manual refresh or polling check for account ${this.accountId}`);
      } else {
        console.log(`📧 IDLE: Processing ${count} new emails for account ${this.accountId}`);
      }
      
      // Fetch new emails and merge with cache
      await this.performIncrementalImapFetch();
      
      // Notify frontend if callback provided
      if (this.idleEventCallback) {
        this.idleEventCallback('newMail', { count, accountId: this.accountId });
      }
    } catch (error) {
      console.error(`❌ Error handling IDLE new mail for account ${this.accountId}:`, error);
    }
  }

  private handleIdleMailDeleted(seqno: number): void {
    console.log(`🗑️ IDLE: Email deleted (sequence ${seqno}) for account ${this.accountId}`);
    
    // Notify frontend if callback provided
    if (this.idleEventCallback) {
      this.idleEventCallback('mailDeleted', { seqno, accountId: this.accountId });
    }
  }

  private handleIdleError(error: Error): void {
    console.error(`❌ IDLE: Error for account ${this.accountId}:`, error);
    
    // Notify frontend if callback provided
    if (this.idleEventCallback) {
      this.idleEventCallback('error', { error: error.message, accountId: this.accountId });
    }
  }

  private handleIdleConnect(): void {
    console.log(`✅ IDLE: Connected for account ${this.accountId}`);
    
    // Notify frontend if callback provided
    if (this.idleEventCallback) {
      this.idleEventCallback('connect', { accountId: this.accountId });
    }
  }

  private handleIdleDisconnect(): void {
    console.log(`📡 IDLE: Disconnected for account ${this.accountId}`);
    
    // Notify frontend if callback provided
    if (this.idleEventCallback) {
      this.idleEventCallback('disconnect', { accountId: this.accountId });
    }
  }

  /**
   * Perform incremental IMAP fetch (for IDLE new mail events)
   */
  private async performIncrementalImapFetch(): Promise<void> {
    try {
      console.log(`🔄 IDLE: Performing incremental fetch for account ${this.accountId}`);
      
      // Get current cache to determine what we have
      const cachedEmails = await EmailCacheService.getCachedEmails(this.accountId);
      const highestCachedUID = cachedEmails.length > 0 ? 
        Math.max(...cachedEmails.map(e => e.uid)) : 0;
      
      console.log(`📊 IDLE: Highest cached UID: ${highestCachedUID}`);
      
      // Connect to IMAP and fetch emails newer than our highest UID
      await this.imapContainer.connect();
      
      try {
        // Search for emails with UID greater than our highest cached UID
        // For node-imap UID search, we need to use the proper format
        let newUIDs: number[] = [];
        
        if (highestCachedUID > 0) {
          console.log(`📧 IDLE: Searching for UIDs > ${highestCachedUID} using fetchRecentEmailsByDate fallback`);
          // Use date-based search as fallback since UID search is problematic
          const recentEmails = await this.imapContainer.fetchRecentEmailsByDate(1, 50); // Last 1 day, max 50
          
          // Filter to only emails with UID > our highest cached UID
          newUIDs = recentEmails
            .map(email => email.uid)
            .filter(uid => uid > highestCachedUID)
            .sort((a, b) => b - a); // Newest first
          
          console.log(`📧 IDLE: Found ${newUIDs.length} new UIDs after filtering: [${newUIDs.slice(0, 5).join(', ')}${newUIDs.length > 5 ? '...' : ''}]`);
        } else {
          console.log(`📧 IDLE: No cached emails, using searchEmails with ALL`);
          newUIDs = await this.imapContainer.searchEmails(['ALL']);
          newUIDs = newUIDs.slice(0, 30); // Limit to 30 most recent
        }
        
        if (newUIDs.length > 0) {
          console.log(`📧 IDLE: Found ${newUIDs.length} new emails to fetch`);
          
          // Fetch the new emails
          const rawEmails = await this.imapContainer.fetchEmailsByUID(newUIDs);
          const cachedEmails = rawEmails.map(raw => this.convertRawEmailToCachedEmail(raw));
          
          // Merge with existing cache (will not duplicate)
          await EmailCacheService.storeEmails(this.accountId, cachedEmails);
          
          console.log(`✅ IDLE: Added ${cachedEmails.length} new emails to cache`);
        } else {
          console.log(`📭 IDLE: No new emails found`);
        }
      } finally {
        await this.imapContainer.disconnect();
      }
    } catch (error) {
      console.error(`❌ IDLE: Error during incremental fetch for account ${this.accountId}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Close IMAP connection when service is done
   */
  async disconnect(): Promise<void> {
    try {
      // Stop IDLE connection if active
      await this.stopIdleConnection();
      
      // Disconnect regular IMAP container
      await this.imapContainer.disconnect();
      console.log(`🔌 EmailService disconnected for account: ${this.accountId}`);
    } catch (error) {
      console.warn(`⚠️ Error disconnecting EmailService for account ${this.accountId}:`, error);
    }
  }

  // ============================================================================
  // STATIC UTILITY METHODS
  // ============================================================================

  /**
   * Get refresh status for account
   */
  static getRefreshStatus(accountId: string): { isRefreshing: boolean; lastSync?: Date } {
    return {
      isRefreshing: EmailService.refreshPromises.has(accountId),
      lastSync: EmailService.lastSync.get(accountId)
    };
  }

  /**
   * Clear all background operations
   */
  static clearAllOperations(): void {
    EmailService.refreshPromises.clear();
    EmailService.lastSync.clear();
  }

  /**
   * Start IDLE connections for all accounts
   */
  static async startAllIdleConnections(eventCallback?: (event: string, data: any) => void): Promise<void> {
    console.log('🔄 Starting IDLE connections for all active accounts...');
    
    // This would typically get accounts from a service
    // For now, we'll need to implement this when we integrate with the API
  }

  /**
   * Stop all IDLE connections
   */
  static async stopAllIdleConnections(): Promise<void> {
    console.log('🛑 Stopping all IDLE connections...');
    
    for (const [accountId, idleManager] of EmailService.idleManagers) {
      try {
        console.log(`🛑 Stopping IDLE for account: ${accountId}`);
        await idleManager.stop();
      } catch (error) {
        console.error(`❌ Error stopping IDLE for account ${accountId}:`, error);
      }
    }
    
    EmailService.idleManagers.clear();
    console.log('✅ All IDLE connections stopped');
  }

  /**
   * Get status of all IDLE connections
   */
  static getAllIdleStatuses(): Map<string, any> {
    const statuses = new Map();
    
    for (const [accountId, idleManager] of EmailService.idleManagers) {
      statuses.set(accountId, idleManager.getStatus());
    }
    
    return statuses;
  }

  /**
   * Create EmailService instance from account data
   */
  static createFromAccount(account: any): EmailService {
    const credentials: EmailServiceCredentials = {
      host: account.imap.host,
      port: account.imap.port,
      secure: account.imap.security === 'SSL/TLS',
      user: account.username || account.email,
      password: account.password
    };

    return new EmailService(account.id, credentials);
  }
}