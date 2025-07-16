/**
 * Pure IMAP Container - Protocol Operations Only
 * 
 * This class handles ONLY raw IMAP protocol operations.
 * NO business logic, NO caching, NO data transformation.
 * 
 * Responsibilities:
 * - Connect/disconnect to IMAP servers
 * - Fetch raw email data
 * - Perform IMAP operations (read/delete/search)
 * - Handle IMAP-level errors
 */

const Imap = require('imap');

export interface ImapCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

export interface RawEmail {
  uid: number;
  flags: string[];
  size: number;
  headers: string;      // Raw headers only
  bodyStructure?: any;  // IMAP body structure
}

export interface RawEmailContent extends RawEmail {
  rawBody: string;     // Complete raw email body
}

export interface RawAttachment {
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  encoding?: string;
}

export interface MailboxInfo {
  total: number;
  unseen: number;
  recent: number;
  flags: string[];
}

export class ImapContainer {
  private connection: any = null;
  private credentials: ImapCredentials;
  private isConnected: boolean = false;

  constructor(credentials: ImapCredentials) {
    this.credentials = credentials;
  }

  /**
   * Connect to IMAP server
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.connection) {
      console.log('📡 IMAP already connected');
      return;
    }

    return new Promise((resolve, reject) => {
      console.log('📡 Connecting to IMAP server:', {
        host: this.credentials.host,
        port: this.credentials.port,
        secure: this.credentials.secure,
        user: this.credentials.user
      });

      this.connection = new Imap({
        host: this.credentials.host,
        port: this.credentials.port,
        tls: this.credentials.secure,
        user: this.credentials.user,
        password: this.credentials.password,
        keepalive: true,     // Keep connection alive for performance
        connTimeout: 5000,   // 5 second connection timeout (faster)
        authTimeout: 3000    // 3 second auth timeout (faster)
      });

      this.connection.once('ready', () => {
        console.log('✅ IMAP connection ready');
        this.isConnected = true;
        resolve();
      });

      this.connection.once('error', (err: Error) => {
        console.error('❌ IMAP connection error:', err);
        this.isConnected = false;
        reject(err);
      });

      this.connection.once('end', () => {
        console.log('📡 IMAP connection ended');
        this.isConnected = false;
      });

      this.connection.connect();
    });
  }

  /**
   * Disconnect from IMAP server
   */
  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.connection || !this.isConnected) {
        console.log('🔌 IMAP already disconnected');
        resolve();
        return;
      }

      console.log('🔌 Initiating IMAP disconnect...');
      
      // Add timeout for disconnect
      const timeout = setTimeout(() => {
        console.warn('⚠️ IMAP disconnect timeout, forcing cleanup');
        this.isConnected = false;
        this.connection = null;
        resolve();
      }, 5000); // 5 second timeout

      this.connection.once('end', () => {
        clearTimeout(timeout);
        this.isConnected = false;
        this.connection = null;
        console.log('✅ IMAP disconnected gracefully');
        resolve();
      });

      this.connection.once('error', (err: any) => {
        console.warn('⚠️ IMAP disconnect error:', err.message);
        clearTimeout(timeout);
        this.isConnected = false;
        this.connection = null;
        resolve(); // Still resolve, don't reject on disconnect errors
      });

      this.connection.end();
    });
  }

  /**
   * Open INBOX folder (read-only by default)
   */
  private async openInbox(readOnly: boolean = true): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Not connected to IMAP server');
    }

    return new Promise((resolve, reject) => {
      this.connection.openBox('INBOX', readOnly, (err: any, box: any) => {
        if (err) {
          console.error('❌ Error opening inbox:', err);
          reject(err);
        } else {
          console.log('📂 Inbox opened:', {
            messages: box.messages.total,
            unseen: box.messages.unseen,
            recent: box.messages.recent
          });
          resolve(box);
        }
      });
    });
  }

  /**
   * Get mailbox information
   */
  async getMailboxInfo(): Promise<MailboxInfo> {
    const inbox = await this.openInbox();
    
    return {
      total: inbox.messages.total,
      unseen: inbox.messages.unseen,
      recent: inbox.messages.recent,
      flags: inbox.flags || []
    };
  }

  /**
   * Fetch most recent emails (by sequence number)
   * Returns raw IMAP data with minimal processing
   */
  async fetchRecentEmails(limit: number = 30): Promise<RawEmail[]> {
    const inbox = await this.openInbox();
    const totalMessages = inbox.messages.total;

    if (totalMessages === 0) {
      console.log('📭 No messages in mailbox');
      return [];
    }

    return new Promise((resolve, reject) => {
      // POTENTIAL FIX: Fetch a larger range to account for missing emails
      // This might be due to deleted messages or sequence number gaps
      const bufferSize = Math.min(10, Math.floor(limit * 0.5)); // 50% buffer
      const adjustedLimit = limit + bufferSize;
      
      const startSeq = Math.max(1, totalMessages - adjustedLimit + 1);
      const endSeq = totalMessages;
      const fetchRange = `${startSeq}:${endSeq}`;

      console.log(`📥 Fetching emails from sequence ${fetchRange} (requesting ${adjustedLimit} to get newest ${limit} of ${totalMessages})`);
      console.log(`📊 Debug: totalMessages=${totalMessages}, limit=${limit}, bufferSize=${bufferSize}, startSeq=${startSeq}, endSeq=${endSeq}`);
      console.log(`🔍 Today is ${new Date().toLocaleDateString()} - expecting recent emails`);

      const emails: RawEmail[] = [];
      const timeout = setTimeout(() => {
        console.log(`⏰ IMAP fetch timeout after 15 seconds, processed ${emails.length} emails so far`);
        reject(new Error('IMAP fetch timeout after 15 seconds'));
      }, 15000); // Reduced from 30 seconds

      const fetch = this.connection.seq.fetch(fetchRange, {
        bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)',
        struct: true
      });

      fetch.on('message', (msg: any, __seqno: number) => {
        let header = '';
        let uid: number | null = null;
        let struct: any = null;

        msg.on('body', (stream: any) => {
          stream.on('data', (chunk: any) => {
            header += chunk.toString('utf8');
          });
        });

        msg.once('attributes', (attrs: any) => {
          uid = attrs.uid;
          struct = attrs.struct;
        });

        msg.once('end', () => {
          try {
            if (!uid) {
              console.warn(`⚠️ No UID for message, skipping`);
              return;
            }

            const email: RawEmail = {
              uid: uid,
              flags: [], // Will be populated if needed
              headers: header,
              size: struct ? struct.size || 0 : 0,
              bodyStructure: struct
            };

            emails.push(email);
            console.log(`📧 Processed email (UID: ${uid})`);
          } catch (error) {
            console.error(`❌ Error processing email:`, error);
          }
        });
      });

      fetch.once('error', (err: any) => {
        console.error('❌ IMAP fetch error:', err);
        clearTimeout(timeout);
        reject(err);
      });

      fetch.once('end', () => {
        clearTimeout(timeout);
        
        // Sort by UID (newest first, assuming higher UID = newer)
        emails.sort((a, b) => b.uid - a.uid);
        
        // Return only the requested limit (trim any extra buffered emails)
        const resultEmails = emails.slice(0, limit);
        
        console.log(`✅ IMAP fetch complete: ${emails.length} emails fetched, returning ${resultEmails.length}`);
        resolve(resultEmails);
      });
    });
  }

  /**
   * Alternative: Fetch recent emails using date-based UID search
   * This might be more reliable than sequence-based fetching
   */
  async fetchRecentEmailsByDate(daysBack: number = 7, limit: number = 30): Promise<RawEmail[]> {
    await this.openInbox();
    
    // Calculate date range
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);
    
    // IMAP expects date in format: "1-Jan-2024"
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = sinceDate.getDate();
    const month = months[sinceDate.getMonth()];
    const year = sinceDate.getFullYear();
    const imapDateStr = `${day}-${month}-${year}`;
    
    console.log(`🔍 Searching for emails since ${imapDateStr} (${daysBack} days back)`);
    
    return new Promise((resolve, reject) => {
      // Search for recent emails by date
      this.connection.search([['SINCE', imapDateStr]], (err: any, uids: number[]) => {
        if (err) {
          console.error('❌ Error searching emails by date:', err);
          reject(err);
          return;
        }
        
        if (!uids || uids.length === 0) {
          console.log('📭 No emails found in date range');
          resolve([]);
          return;
        }
        
        // Sort UIDs descending (newest first) and limit
        const sortedUIDs = uids.sort((a, b) => b - a).slice(0, limit);
        console.log(`📨 Found ${uids.length} emails, fetching newest ${sortedUIDs.length}`);
        
        // Fetch the emails
        this.fetchEmailsByUID(sortedUIDs)
          .then(resolve)
          .catch(reject);
      });
    });
  }

  /**
   * Fetch specific emails by UID
   */
  async fetchEmailsByUID(uids: number[]): Promise<RawEmail[]> {
    if (uids.length === 0) return [];

    await this.openInbox();

    return new Promise((resolve, reject) => {
      const uidList = uids.join(',');
      console.log(`📥 Fetching emails by UID: ${uidList}`);

      const emails: RawEmail[] = [];
      const fetch = this.connection.fetch(uidList, {
        bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)',
        struct: true
      });

      fetch.on('message', (msg: any, __seqno: number) => {
        let header = '';
        let uid: number | null = null;
        let struct: any = null;

        msg.on('body', (stream: any) => {
          stream.on('data', (chunk: any) => {
            header += chunk.toString('utf8');
          });
        });

        msg.once('attributes', (attrs: any) => {
          uid = attrs.uid;
          struct = attrs.struct;
        });

        msg.once('end', () => {
          try {
            const email: RawEmail = {
              uid: uid!,
              flags: [],
              headers: header,
              size: struct ? struct.size || 0 : 0,
              bodyStructure: struct
            };

            emails.push(email);
          } catch (error) {
            console.error(`❌ Error processing email UID ${uid}:`, error);
          }
        });
      });

      fetch.once('error', (err: any) => {
        reject(err);
      });

      fetch.once('end', () => {
        emails.sort((a, b) => b.uid - a.uid);
        console.log(`✅ Fetched ${emails.length} emails by UID`);
        resolve(emails);
      });
    });
  }

  /**
   * Fetch full email content including body - single efficient request
   */
  async fetchEmailContent(uid: number): Promise<RawEmailContent> {
    await this.openInbox();

    return new Promise((resolve, reject) => {
      console.log(`📄 Fetching complete email for UID: ${uid}`);

      let completeEmailData = '';
      let struct: any = null;

      // Fetch complete email in one request (much faster)
      const fetch = this.connection.fetch([uid], {
        bodies: '', // Fetch complete email (headers + body) in one go
        struct: true
      });

      fetch.on('message', (msg: any) => {
        msg.on('body', (stream: any) => {
          stream.on('data', (chunk: Buffer) => {
            completeEmailData += chunk.toString('utf8');
          });
        });

        msg.once('attributes', (attrs: any) => {
          struct = attrs.struct;
        });

        msg.once('end', () => {
          try {
            // Split to get headers for metadata
            const headerBodySplit = completeEmailData.split('\n\n');
            const headers = headerBodySplit[0] || '';
            
            const emailContent: RawEmailContent = {
              uid: uid,
              flags: [],
              headers: headers,
              size: struct ? struct.size || 0 : 0,
              bodyStructure: struct,
              rawBody: completeEmailData
            };

            console.log(`✅ Email content ready for UID: ${uid} (${completeEmailData.length} chars)`);
            resolve(emailContent);
          } catch (error) {
            console.error(`❌ Error preparing email content for UID ${uid}:`, error);
            reject(error);
          }
        });
      });

      fetch.once('error', (err: any) => {
        console.error(`❌ Error fetching email content for UID ${uid}:`, err);
        reject(err);
      });

      fetch.once('end', () => {
        console.log(`🔄 Email fetch complete for UID: ${uid}`);
      });
    });
  }

  /**
   * Mark email as read
   */
  async markAsRead(uid: number): Promise<void> {
    await this.openInbox(false); // Open for writing

    return new Promise((resolve, reject) => {
      console.log(`📖 Marking email UID ${uid} as read`);
      
      this.connection.addFlags([uid], ['\\Seen'], (err: any) => {
        if (err) {
          console.error(`❌ Error marking email ${uid} as read:`, err);
          reject(err);
        } else {
          console.log(`✅ Email UID ${uid} marked as read`);
          resolve();
        }
      });
    });
  }

  /**
   * Mark email as unread
   */
  async markAsUnread(uid: number): Promise<void> {
    await this.openInbox(false); // Open for writing

    return new Promise((resolve, reject) => {
      console.log(`📧 Marking email UID ${uid} as unread`);
      
      this.connection.delFlags([uid], ['\\Seen'], (err: any) => {
        if (err) {
          console.error(`❌ Error marking email ${uid} as unread:`, err);
          reject(err);
        } else {
          console.log(`✅ Email UID ${uid} marked as unread`);
          resolve();
        }
      });
    });
  }

  /**
   * Delete email (move to trash)
   */
  async deleteEmail(uid: number): Promise<void> {
    await this.openInbox(false); // Open for writing

    return new Promise((resolve, reject) => {
      console.log(`🗑️ Deleting email UID ${uid}`);
      
      this.connection.addFlags([uid], ['\\Deleted'], (err: any) => {
        if (err) {
          console.error(`❌ Error deleting email ${uid}:`, err);
          reject(err);
        } else {
          // Expunge to actually remove the email
          this.connection.expunge((expungeErr: any) => {
            if (expungeErr) {
              console.error(`❌ Error expunging email ${uid}:`, expungeErr);
              reject(expungeErr);
            } else {
              console.log(`✅ Email UID ${uid} deleted`);
              resolve();
            }
          });
        }
      });
    });
  }

  /**
   * Search emails by criteria
   */
  async searchEmails(criteria: string | string[]): Promise<number[]> {
    await this.openInbox();

    return new Promise((resolve, reject) => {
      console.log(`🔍 Searching emails with criteria:`, criteria);
      
      this.connection.search(criteria, (err: any, results: number[]) => {
        if (err) {
          console.error('❌ Search error:', err);
          reject(err);
        } else {
          console.log(`✅ Search complete: ${results.length} results`);
          resolve(results || []);
        }
      });
    });
  }

  /**
   * Fetch attachment by UID and attachment ID
   */
  async fetchAttachment(uid: number, attachmentId: string): Promise<Buffer> {
    await this.openInbox();

    return new Promise((resolve, reject) => {
      console.log(`📎 Fetching attachment ${attachmentId} from email UID ${uid}`);
      
      // This is a simplified version - real implementation would need
      // to parse the email structure and extract the specific attachment
      const fetch = this.connection.fetch([uid], {
        bodies: attachmentId,
        struct: true
      });

      let attachmentData = Buffer.alloc(0);

      fetch.on('message', (msg: any) => {
        msg.on('body', (stream: any, info: any) => {
          if (info.which === attachmentId) {
            stream.on('data', (chunk: Buffer) => {
              attachmentData = Buffer.concat([attachmentData, chunk]);
            });
          }
        });

        msg.once('end', () => {
          console.log(`✅ Attachment ${attachmentId} fetched (${attachmentData.length} bytes)`);
          resolve(attachmentData);
        });
      });

      fetch.once('error', (err: any) => {
        console.error(`❌ Error fetching attachment ${attachmentId}:`, err);
        reject(err);
      });
    });
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

}