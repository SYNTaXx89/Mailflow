import express from 'express';
import { ImapService, ImapContainer } from '../../src/imap';
import { MimeParser } from '../../src/imap/MimeParser';
import { AuthMiddleware } from '../auth/AuthMiddleware';
import { EmailCacheService } from '../cache/EmailCacheService';

export const createImapRouter = (authMiddleware: AuthMiddleware, emailCacheService: EmailCacheService) => {
  const router = express.Router();
  
  // Apply authentication middleware to all IMAP routes
  router.use(authMiddleware.authenticate);

router.post('/test-connection', async (req, res) => {
  try {
    console.log('🧪 Testing IMAP connection with new ImapContainer');
    const { account, password } = req.body;
    
    // Create credentials object for new ImapContainer
    const credentials = {
      host: account.imap.host,
      port: account.imap.port,
      secure: account.imap.security === 'SSL/TLS',
      user: account.username || account.email,
      password: password
    };
    
    console.log('🔌 Testing connection with credentials:', {
      host: credentials.host,
      port: credentials.port,
      secure: credentials.secure,
      user: credentials.user
    });
    
    // Test with new ImapContainer
    const imapContainer = new ImapContainer(credentials);
    await imapContainer.connect();
    
    const mailboxInfo = await imapContainer.getMailboxInfo();
    console.log('📊 Mailbox info:', mailboxInfo);
    
    await imapContainer.disconnect();
    
    res.json({ 
      success: true, 
      mailboxInfo: mailboxInfo,
      message: 'Connection successful with new ImapContainer'
    });
  } catch (error) {
    console.error('❌ IMAP test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Connection test failed' 
    });
  }
});

router.post('/fetch-emails', async (req, res) => {
  try {
    const { account, password, limit = 30, forceRefresh = false } = req.body;
    console.log('API /imap/fetch-emails called with:', { accountId: account.id, limit, forceRefresh });
    
    const accountWithPassword = { ...account, password };
    
    // CACHE-FIRST STRATEGY:
    // 1. Always return cached emails immediately for speed
    // 2. Trigger background IMAP refresh if needed
    // 3. Client can request forceRefresh for real-time updates
    
    const result = await ImapService.fetchEmailsWithCache(accountWithPassword, limit, forceRefresh);
    
    console.log('API /imap/fetch-emails returning:', result.emails.length, 'emails, source:', result.source);
    res.json({ 
      emails: result.emails,
      source: result.source, // 'cache' | 'imap' | 'hybrid'
      lastSync: result.lastSync,
      isRefreshing: result.isRefreshing
    });
  } catch (error) {
    console.error('IMAP fetch error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch emails' 
    });
  }
});

router.post('/fetch-email-content', async (req, res) => {
  try {
    const { account, password, emailId } = req.body;
    const accountWithPassword = { ...account, password };
    const email = await ImapService.fetchEmailContent(accountWithPassword, emailId);
    res.json({ email });
  } catch (error) {
    console.error('IMAP content fetch error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch email content' 
    });
  }
});

// TEST ROUTE: Direct ImapContainer email fetching
router.post('/test-fetch-emails', async (req, res) => {
  try {
    console.log('🧪 Testing email fetch with new ImapContainer');
    const { account, password, limit = 10 } = req.body;
    
    const credentials = {
      host: account.imap.host,
      port: account.imap.port,
      secure: account.imap.security === 'SSL/TLS',
      user: account.username || account.email,
      password: password
    };
    
    const imapContainer = new ImapContainer(credentials);
    await imapContainer.connect();
    
    console.log('📧 Fetching recent emails...');
    const rawEmails = await imapContainer.fetchRecentEmails(limit);
    
    await imapContainer.disconnect();
    
    console.log(`✅ Fetched ${rawEmails.length} raw emails`);
    
    // Parse first email headers for debugging
    if (rawEmails[0]) {
      const parsedHeader = MimeParser.parseEmailHeader(rawEmails[0].headers);
      console.log('📝 First email sample:', {
        uid: rawEmails[0].uid,
        subject: parsedHeader.subject,
        from: parsedHeader.from,
        date: parsedHeader.date,
        hasAttachments: MimeParser.checkForAttachments(rawEmails[0].bodyStructure)
      });
    }
    
    res.json({ 
      success: true, 
      emails: rawEmails,
      count: rawEmails.length,
      message: 'Raw emails fetched with new ImapContainer'
    });
  } catch (error) {
    console.error('❌ Email fetch test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Email fetch test failed' 
    });
  }
});

// TEST ROUTE: IMAP + Cache Integration Test
router.post('/test-integration', async (req, res) => {
  try {
    console.log('🧪 Testing IMAP + Cache integration');
    const { account, password, limit = 5 } = req.body;
    
    const credentials = {
      host: account.imap.host,
      port: account.imap.port,
      secure: account.imap.security === 'SSL/TLS',
      user: account.username || account.email,
      password: password
    };
    
    // Step 1: Fetch fresh emails from IMAP
    console.log('📧 Step 1: Fetching fresh emails from IMAP...');
    const imapContainer = new ImapContainer(credentials);
    await imapContainer.connect();
    const rawEmails = await imapContainer.fetchRecentEmails(limit);
    await imapContainer.disconnect();
    
    // Step 2: Convert to cache format and store
    console.log('💾 Step 2: Converting and storing in cache...');
    
    const cachedEmails = rawEmails.map(raw => {
      const parsedHeader = MimeParser.parseEmailHeader(raw.headers);
      
      return {
        id: `imap-${raw.uid}`,
        accountId: account.id,
        uid: raw.uid,
        from: parseEmailAddress(parsedHeader.from),
        to: parseEmailAddress(parsedHeader.to),
        subject: parsedHeader.subject,
        date: parsedHeader.date,
        isRead: raw.flags.includes('\\Seen'),
        hasAttachments: MimeParser.checkForAttachments(raw.bodyStructure),
        preview: `Email from ${parsedHeader.from} - ${parsedHeader.subject}`,
        messageId: parsedHeader.messageId,
        size: raw.size,
        cachedAt: new Date()
      };
    });
    
    await emailCacheService.storeEmails(account.id, cachedEmails);
    
    // Step 3: Retrieve from cache to verify
    console.log('📂 Step 3: Retrieving from cache to verify...');
    const retrievedEmails = await emailCacheService.getCachedEmails(account.id, limit);
    
    // Step 4: Get cache stats
    console.log('📊 Step 4: Getting cache statistics...');
    const cacheStats = await emailCacheService.getCacheStats(account.id);
    
    res.json({
      success: true,
      message: 'IMAP + Cache integration test completed',
      steps: {
        imap: { count: rawEmails.length, sample: rawEmails[0] },
        cache_stored: { count: cachedEmails.length },
        cache_retrieved: { count: retrievedEmails.length, sample: retrievedEmails[0] },
        cache_stats: cacheStats
      }
    });
    
  } catch (error) {
    console.error('❌ Integration test error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Integration test failed'
    });
  }
});

// Helper function for parsing email addresses
function parseEmailAddress(emailString: string): { name: string; email: string } {
  if (!emailString) {
    return { name: 'Unknown', email: '' };
  }

  const match = emailString.match(/^(.+?)\\s*<(.+?)>$/);
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

  return router;
};

// Temporary backward compatibility
export default createImapRouter;