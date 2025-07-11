const Imap = require('imap');
import { Account } from '../../src/types';
import { ImapConfig, EmailPreview, EmailFull } from './types';
import { EmailParser } from './EmailParser';

export class ImapClient {
  private imap: any = null;
  private config: ImapConfig;
  private accountId: string;

  constructor(account: Account, accountId: string, password?: string) {
    if (!account.imap) {
      throw new Error('Account missing IMAP configuration');
    }

    console.log(`ImapClient constructor - accountId: ${accountId}, account.id: ${account.id}`);
    this.accountId = accountId;
    this.config = {
      host: account.imap.host,
      port: account.imap.port,
      secure: account.imap.security === 'SSL/TLS',
      user: account.username || account.email,
      password: password || 'password'
    };
  }

  /**
   * Connect to IMAP server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Creating new IMAP connection with config:', {
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        user: this.config.user
      });

      this.imap = new Imap({
        host: this.config.host,
        port: this.config.port,
        tls: this.config.secure,
        user: this.config.user,
        password: this.config.password,
        keepalive: false,
        connTimeout: 10000,  // 10 second connection timeout
        authTimeout: 5000    // 5 second auth timeout
      });

      this.imap!.once('ready', () => {
        console.log('IMAP connection ready, state:', this.imap.state);
        resolve();
      });

      this.imap!.once('error', (err: Error) => {
        console.error('IMAP connection error:', err);
        reject(err);
      });

      this.imap!.once('end', () => {
        console.log('IMAP connection ended');
      });

      this.imap!.connect();
    });
  }

  /**
   * Disconnect from IMAP server
   */
  disconnect(): void {
    if (this.imap) {
      this.imap.end();
      this.imap = null;
    }
  }

  /**
   * Test IMAP connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      this.disconnect();
      return true;
    } catch (error) {
      console.error('IMAP connection test failed:', error);
      return false;
    }
  }

  /**
   * Open inbox folder
   */
  private openInbox(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('Not connected to IMAP server'));
        return;
      }

      console.log('Opening inbox, IMAP state:', this.imap.state);

      this.imap.openBox('INBOX', true, (err: any, box: any) => {
        if (err) {
          console.error('Error opening inbox:', err);
          console.error('IMAP state when error occurred:', this.imap.state);
          reject(err);
        } else {
          console.log('Inbox opened successfully. Box info:', {
            messages: box.messages.total,
            unseen: box.messages.unseen,
            flags: box.flags
          });
          resolve(box);
        }
      });
    });
  }

  /**
   * Fetch email previews (headers + preview text)
   */
  async fetchEmailPreviews(limit: number = 30): Promise<EmailPreview[]> {
    try {
      if (!this.imap || this.imap.state !== 'authenticated') {
        console.log('IMAP not connected or not authenticated, connecting...');
        if (this.imap) {
          this.disconnect();
        }
        await this.connect();
      }

      const inbox = await this.openInbox();
      const totalMessages = inbox.messages.total;
      console.log(`Total messages in mailbox: ${totalMessages}`);

      if (totalMessages === 0) {
        console.log('No messages in mailbox');
        return [];
      }

      return new Promise((resolve, reject) => {
        if (!this.imap) {
          reject(new Error('IMAP connection lost'));
          return;
        }

        console.log('Starting to fetch email previews...');
        console.log('IMAP connection state:', this.imap.state);
        
        const timeout = setTimeout(() => {
          console.error('IMAP fetch timeout after 30 seconds');
          reject(new Error('IMAP fetch timeout'));
        }, 30000);
        
        // Calculate range to fetch newest emails first
        const startSeq = Math.max(1, totalMessages - limit + 1);
        const endSeq = totalMessages;
        const fetchRange = `${startSeq}:${endSeq}`;
        
        console.log(`Fetching messages from sequence ${fetchRange} (newest first)`);
        
        const fetch = this.imap.seq.fetch(fetchRange, {
          bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)',
          struct: true
        });

        const emails: EmailPreview[] = [];

        fetch.on('message', async (msg: any, seqno: number) => {
          let header = '';
          let uid: number | null = null;
          let headerParsed = false;
          console.log(`Processing message ${seqno}`);

          msg.on('body', (stream: any) => {
            stream.on('data', (chunk: any) => {
              header += chunk.toString('utf8');
            });
          });

          msg.once('attributes', (attrs: any) => {
            uid = attrs.uid;
            console.log(`Message ${seqno} has UID: ${uid}`);
            
            if (!headerParsed && header) {
              processEmail();
            }
          });

          msg.once('end', async () => {
            if (!headerParsed) {
              processEmail();
            }
          });

          const processEmail = async () => {
            if (headerParsed) return;
            headerParsed = true;
            
            try {
              console.log(`Header for message ${seqno} (UID: ${uid}):`, header.substring(0, 200) + '...');
              const headerInfo = await EmailParser.parseEmailHeader(header);
              console.log(`Parsed header for message ${seqno} (UID: ${uid}):`, headerInfo);
              
              const messageId = uid || seqno;
              
              const email: EmailPreview = {
                id: `imap-${messageId}`,
                accountId: this.accountId,
                from: headerInfo.from,
                subject: headerInfo.subject,
                date: headerInfo.date,
                isRead: false,
                preview: '',
                uid: messageId
              };

              console.log(`Created email preview with accountId: ${this.accountId} and UID: ${messageId}`);
              emails.push(email);
              console.log(`Added email ${seqno} (UID: ${messageId}) to list. Total emails so far: ${emails.length}`);
            } catch (error) {
              console.error(`Error parsing email header for message ${seqno}:`, error);
            }
          };
        });

        fetch.once('error', (err: any) => {
          console.error('IMAP fetch error:', err);
          clearTimeout(timeout);
          reject(err);
        });

        fetch.once('end', () => {
          console.log(`Fetch completed. Total emails fetched: ${emails.length}`);
          
          // Sort emails by date (newest first) to ensure proper ordering
          emails.sort((a, b) => b.date.getTime() - a.date.getTime());
          
          console.log('Final emails array (sorted by date):', emails);
          console.log('Emails array length:', emails.length);
          console.log('First few emails:', emails.slice(0, 3));
          clearTimeout(timeout);
          resolve(emails);
        });
      });
    } catch (error) {
      console.error('Error fetching email previews:', error);
      return [];
    }
  }

  /**
   * Fetch full email content
   */
  async fetchEmailContent(uid: number): Promise<EmailFull | null> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.imap || this.imap.state !== 'authenticated') {
          console.log('IMAP not connected or not authenticated, connecting now...');
          if (this.imap) {
            this.disconnect();
          }
          await this.connect();
        }
        
        if (!this.imap) {
          reject(new Error('Failed to establish IMAP connection'));
          return;
        }
      } catch (error) {
        console.error('Failed to connect to IMAP:', error);
        reject(error);
        return;
      }

      this.openInbox()
        .then((_inbox) => {
          console.log(`Fetching email content for UID: ${uid}`);
          const fetch = this.imap.fetch(uid, {
            bodies: '',
            struct: true
          });

          let emailData = '';
          let content = '';
          let html = '';

          fetch.on('message', (msg: any, _seqno: number) => {
            msg.on('body', (stream: any, _info: any) => {
              stream.on('data', (chunk: Buffer) => {
                emailData += chunk.toString('utf8');
              });
            });

            msg.once('end', async () => {
              let headers = { from: { name: 'Unknown', email: 'unknown@example.com' }, subject: 'No Subject', date: new Date() };
              
              try {
                const parsedMail = await EmailParser.parseEmail(emailData);
                
                headers = EmailParser.parseEmailHeaders(parsedMail);
                
                if (emailData) {
                  content = EmailParser.extractEmailContent(parsedMail);
                  
                  if (parsedMail.html) {
                    html = parsedMail.html;
                  }
                }
                
                console.log(`Parsed with mailparser - content length: ${content.length}, html length: ${html.length}`);
              } catch (mailparserError) {
                console.error('mailparser failed:', mailparserError);
                content = EmailParser.extractContentFromRawData(emailData);
              }

              if (!content || content.trim() === '') {
                console.log('No content from mailparser, extracting from raw data...');
                content = EmailParser.extractContentFromRawData(emailData);
              }

              const email: EmailFull = {
                id: `imap-${uid}`,
                accountId: this.accountId,
                from: headers.from,
                subject: headers.subject,
                date: headers.date,
                isRead: false,
                preview: EmailParser.generatePreview(content),
                uid: uid,
                content: content,
                html: html
              };

              resolve(email);
            });
          });

          fetch.once('error', (err: Error) => {
            console.error('Fetch error:', err);
            reject(err);
          });

          fetch.once('end', () => {
            console.log('Fetch completed');
          });
        })
        .catch((error) => {
          console.error('Error opening inbox:', error);
          reject(error);
        });
    });
  }
}