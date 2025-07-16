import { Account, Email } from '../../src/types';
import { ImapClient } from './ImapClient';
// TODO: This is bad architecture - client code shouldn't access database directly
// import { databaseManager } from '../../server/database/DatabaseManager';

export class ImapService {
  private static clients: Map<string, ImapClient> = new Map();
  private static refreshPromises: Map<string, Promise<Email[]>> = new Map();
  private static lastSync: Map<string, Date> = new Map();
  
  // Cache settings
  // private static CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private static BACKGROUND_REFRESH_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

  /**
   * Get or create IMAP client for account
   */
  static getClient(account: Account & { password?: string }): ImapClient {
    const clientId = account.id;
    
    if (!this.clients.has(clientId)) {
      const client = new ImapClient(account, account.id, account.password);
      this.clients.set(clientId, client);
    }

    return this.clients.get(clientId)!;
  }

  /**
   * Test account connection
   */
  static async testAccount(account: Account & { password?: string }): Promise<boolean> {
    try {
      const client = new ImapClient(account, account.id, account.password);
      return await client.testConnection();
    } catch (error) {
      console.error('Account test failed:', error);
      return false;
    }
  }

  /**
   * Fetch emails for account
   */
  static async fetchEmails(account: Account & { password?: string }, limit: number = 30): Promise<Email[]> {
    try {
      console.log('ImapService.fetchEmails - starting for account:', account.id);
      const client = this.getClient(account);
      console.log('ImapService.fetchEmails - got client, calling fetchEmailPreviews');
      
      const previews = await client.fetchEmailPreviews(limit);
      console.log('ImapService.fetchEmails - previews returned:', previews.length, 'previews');
      console.log('ImapService.fetchEmails - previews array:', previews);
      
      const emails = previews.map(preview => ({
        id: preview.id,
        accountId: preview.accountId,
        from: preview.from,
        subject: preview.subject,
        date: preview.date,
        isRead: preview.isRead,
        preview: preview.preview,
        content: ''
      }));
      
      console.log('ImapService.fetchEmails - converted emails:', emails.length, 'emails');
      console.log('ImapService.fetchEmails - converted emails array:', emails);
      
      // Debug: Check if conversion is working properly
      if (previews.length > 0 && emails.length === 0) {
        console.error('BUG: Had previews but no converted emails!');
        console.error('Previews:', previews);
      } else if (previews.length !== emails.length) {
        console.warn('Preview/Email count mismatch:', previews.length, 'vs', emails.length);
      }
      
      return emails;
    } catch (error) {
      console.error('Failed to fetch emails:', error);
      return [];
    }
  }

  /**
   * 🚀 SMART CACHE-FIRST EMAIL FETCHING
   * 
   * Strategy:
   * 1. Return cached emails immediately (sub-second response)
   * 2. Check if cache is stale (> 2 minutes)
   * 3. If stale, trigger background IMAP refresh
   * 4. Store fresh emails in database cache
   * 5. Client can poll for updates or use WebSocket (future)
   */
  static async fetchEmailsWithCache(
    account: Account & { password?: string }, 
    limit: number = 30, 
    forceRefresh: boolean = false
  ): Promise<{
    emails: Email[], 
    source: 'cache' | 'imap' | 'hybrid',
    lastSync?: Date,
    isRefreshing: boolean
  }> {
    const accountId = account.id;
    console.log(`🔄 fetchEmailsWithCache - Account: ${accountId}, ForceRefresh: ${forceRefresh}`);
    
    try {
      // Step 1: Get cached emails from database (ALWAYS - for speed)
      const cachedEmails = await this.getCachedEmails(accountId, limit);
      const lastSyncTime = this.lastSync.get(accountId);
      const now = new Date();
      
      console.log(`📄 Cache status - Cached emails: ${cachedEmails.length}, Last sync: ${lastSyncTime?.toISOString() || 'never'}`);
      
      // Step 2: Determine if we need to refresh
      const needsRefresh = forceRefresh || 
                          !lastSyncTime || 
                          (now.getTime() - lastSyncTime.getTime()) > this.BACKGROUND_REFRESH_THRESHOLD_MS;
      
      const isCurrentlyRefreshing = this.refreshPromises.has(accountId);
      
      console.log(`🔍 Refresh check - Needs refresh: ${needsRefresh}, Currently refreshing: ${isCurrentlyRefreshing}`);
      
      // Step 3: Handle different scenarios
      if (forceRefresh) {
        // Force refresh - wait for fresh IMAP data
        console.log('⚡ Force refresh requested - fetching fresh IMAP data');
        const freshEmails = await this.performImapRefresh(account, limit);
        return {
          emails: freshEmails,
          source: 'imap',
          lastSync: this.lastSync.get(accountId),
          isRefreshing: false
        };
      } else if (cachedEmails.length === 0 && !isCurrentlyRefreshing) {
        // No cache - must fetch fresh data
        console.log('📭 No cached emails - fetching fresh IMAP data');
        const freshEmails = await this.performImapRefresh(account, limit);
        return {
          emails: freshEmails,
          source: 'imap',
          lastSync: this.lastSync.get(accountId),
          isRefreshing: false
        };
      } else if (needsRefresh && !isCurrentlyRefreshing) {
        // Cache exists but stale - return cache + trigger background refresh
        console.log('🔄 Cache stale - returning cache and triggering background refresh');
        this.triggerBackgroundRefresh(account, limit);
        return {
          emails: cachedEmails,
          source: 'cache',
          lastSync: lastSyncTime,
          isRefreshing: true
        };
      } else {
        // Cache is fresh or refresh in progress
        console.log('✅ Cache is fresh - returning cached emails');
        return {
          emails: cachedEmails,
          source: 'cache',
          lastSync: lastSyncTime,
          isRefreshing: isCurrentlyRefreshing
        };
      }
    } catch (error) {
      console.error('❌ Error in fetchEmailsWithCache:', error);
      // Fallback to basic fetch
      const emails = await this.fetchEmails(account, limit);
      return {
        emails,
        source: 'imap',
        lastSync: this.lastSync.get(accountId),
        isRefreshing: false
      };
    }
  }

  /**
   * Get cached emails from database
   */
  private static async getCachedEmails(_accountId: string, _limit: number): Promise<Email[]> {
    try {
      // TODO: This should be done through API, not direct database access
      // const dbEmails = await databaseManager.getEmailsByAccountId(accountId, limit);
      const dbEmails: any[] = [];
      
      // Convert database format to frontend Email format
      return dbEmails.map(dbEmail => ({
        id: dbEmail.id,
        accountId: dbEmail.account_id,
        from: {
          name: dbEmail.sender.split(' <')[0] || dbEmail.sender,
          email: dbEmail.sender.includes('<') ? 
                 dbEmail.sender.split('<')[1].replace('>', '') : 
                 dbEmail.sender
        },
        subject: dbEmail.subject || '',
        date: new Date(dbEmail.date),
        isRead: dbEmail.is_read,
        preview: dbEmail.preview || '',
        content: dbEmail.full_body || dbEmail.preview || '',
        uid: dbEmail.uid
      })).sort((a, b) => b.date.getTime() - a.date.getTime()); // Newest first
    } catch (error) {
      console.error('❌ Error getting cached emails:', error);
      return [];
    }
  }

  /**
   * Perform IMAP refresh and cache results
   */
  private static async performImapRefresh(account: Account & { password?: string }, limit: number): Promise<Email[]> {
    const accountId = account.id;
    console.log(`⬇️ Starting IMAP refresh for account: ${accountId}`);
    
    try {
      // Fetch fresh emails from IMAP
      const freshEmails = await this.fetchEmails(account, limit);
      
      // Cache emails in database
      await this.cacheEmails(accountId, freshEmails);
      
      // Update sync timestamp
      this.lastSync.set(accountId, new Date());
      
      console.log(`✅ IMAP refresh complete - cached ${freshEmails.length} emails`);
      return freshEmails;
    } catch (error) {
      console.error(`❌ IMAP refresh failed for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Trigger background refresh without blocking
   */
  private static triggerBackgroundRefresh(account: Account & { password?: string }, limit: number): void {
    const accountId = account.id;
    
    if (this.refreshPromises.has(accountId)) {
      console.log(`⏳ Background refresh already in progress for account: ${accountId}`);
      return;
    }
    
    console.log(`🚀 Triggering background refresh for account: ${accountId}`);
    
    const refreshPromise = this.performImapRefresh(account, limit)
      .then(emails => {
        console.log(`🎉 Background refresh completed for account: ${accountId} - ${emails.length} emails`);
        return emails;
      })
      .catch(error => {
        console.error(`💥 Background refresh failed for account: ${accountId}:`, error);
        return [];
      })
      .finally(() => {
        // Clean up promise when done
        this.refreshPromises.delete(accountId);
      });
    
    this.refreshPromises.set(accountId, refreshPromise);
  }

  /**
   * Cache emails in database
   */
  private static async cacheEmails(accountId: string, emails: Email[]): Promise<void> {
    try {
      console.log(`💾 Caching ${emails.length} emails for account: ${accountId}`);
      
      // Clear existing cached emails for this account
      // TODO: This should be done through API, not direct database access
      // await databaseManager.clearEmailsByAccountId(accountId);
      
      // TODO: Insert fresh emails - implement when API is available
      // for (const email of emails) {
      //   const dbEmail = {
      //     id: email.id,
      //     account_id: accountId,
      //     subject: email.subject,
      //     sender: `${email.from.name} <${email.from.email}>`,
      //     recipient: '', // TODO: Add recipient field if needed
      //     preview: email.preview,
      //     full_body: email.content || undefined,
      //     date: email.date.toISOString(),
      //     is_read: email.isRead,
      //     uid: email.uid?.toString(),
      //     message_id: email.id
      //   };
      //   
      //   // TODO: This should be done through API, not direct database access
      //   // await databaseManager.createEmail(dbEmail);
      // }
      
      console.log(`✅ Successfully cached ${emails.length} emails`);
    } catch (error) {
      console.error('❌ Error caching emails:', error);
      // Don't throw - caching failure shouldn't break email fetching
    }
  }

  /**
   * Fetch full email content
   */
  static async fetchEmailContent(account: Account & { password?: string }, emailId: string): Promise<Email | null> {
    try {
      console.log(`ImapService.fetchEmailContent called with emailId: ${emailId}`);
      const uid = parseInt(emailId.replace('imap-', ''));
      console.log(`Parsed UID from emailId: ${uid}`);
      const client = this.getClient(account);
      const fullEmail = await client.fetchEmailContent(uid);
      
      if (!fullEmail) return null;

      return {
        id: fullEmail.id,
        accountId: fullEmail.accountId,
        from: fullEmail.from,
        subject: fullEmail.subject,
        date: fullEmail.date,
        isRead: fullEmail.isRead,
        preview: fullEmail.preview,
        content: fullEmail.content
      };
    } catch (error) {
      console.error('Failed to fetch email content:', error);
      return null;
    }
  }

  /**
   * Get refresh status for account
   */
  static getRefreshStatus(accountId: string): { isRefreshing: boolean; lastSync?: Date } {
    return {
      isRefreshing: this.refreshPromises.has(accountId),
      lastSync: this.lastSync.get(accountId)
    };
  }

  /**
   * Disconnect all clients
   */
  static disconnectAll(): void {
    this.clients.forEach(client => client.disconnect());
    this.clients.clear();
    this.refreshPromises.clear();
    this.lastSync.clear();
  }
}