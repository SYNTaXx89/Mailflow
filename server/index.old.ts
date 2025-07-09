/**
 * Express Server for MailFlow
 * 
 * Serves the React frontend and provides IMAP API endpoints.
 * In production, serves static files from /dist
 * In development, proxies frontend requests to Vite dev server
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { ImapService } from '../src/imap';

const app = express();
const PORT = process.env.PORT || 3001;
const isDevelopment = process.env.NODE_ENV !== 'production';

// Data storage paths
const DATA_DIR = path.join(__dirname, '../data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const EMAILS_FILE = path.join(DATA_DIR, 'emails.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper functions for file-based storage
const readJsonFile = (filePath: string, defaultValue: any = {}) => {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return defaultValue;
};

const writeJsonFile = (filePath: string, data: any) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    return false;
  }
};

// Middleware
app.use(express.json());
app.use(cors({
  origin: isDevelopment ? 'http://localhost:5173' : '*',
  credentials: true
}));

// IMAP API Routes
app.post('/api/imap/test-connection', async (req, res) => {
  try {
    console.log('Received test connection request');
    console.log('Request body keys:', Object.keys(req.body));
    
    const { account, password } = req.body;
    console.log('Account data:', {
      email: account?.email,
      username: account?.username,
      imapHost: account?.imap?.host,
      imapPort: account?.imap?.port,
      hasPassword: !!password
    });
    
    const accountWithPassword = { ...account, password };
    console.log('Testing account with IMAP service...');
    
    const success = await ImapService.testAccount(accountWithPassword);
    console.log('IMAP test result:', success);
    
    res.json({ success });
  } catch (error) {
    console.error('IMAP test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Connection test failed' 
    });
  }
});

app.post('/api/imap/fetch-emails', async (req, res) => {
  try {
    const { account, password, limit = 30 } = req.body;
    console.log('API /imap/fetch-emails called with:', { accountId: account.id, limit });
    
    const accountWithPassword = { ...account, password };
    const emails = await ImapService.fetchEmails(accountWithPassword, limit);
    
    console.log('API /imap/fetch-emails returning:', emails.length, 'emails');
    res.json({ emails });
  } catch (error) {
    console.error('IMAP fetch error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch emails' 
    });
  }
});

app.post('/api/imap/fetch-email-content', async (req, res) => {
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

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: isDevelopment ? 'development' : 'production'
  });
});

// ============================================================================
// DATA MANAGEMENT API ROUTES
// ============================================================================

// Accounts API
app.get('/api/accounts', (_req, res) => {
  try {
    const accounts = readJsonFile(ACCOUNTS_FILE, []);
    res.json({ accounts });
  } catch (error) {
    console.error('Failed to load accounts:', error);
    res.status(500).json({ error: 'Failed to load accounts' });
  }
});

app.post('/api/accounts', (req, res) => {
  try {
    const { account } = req.body;
    const accounts = readJsonFile(ACCOUNTS_FILE, []);
    accounts.push(account);
    
    if (writeJsonFile(ACCOUNTS_FILE, accounts)) {
      res.json({ success: true, account });
    } else {
      res.status(500).json({ error: 'Failed to save account' });
    }
  } catch (error) {
    console.error('Failed to create account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.put('/api/accounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { account } = req.body;
    const accounts = readJsonFile(ACCOUNTS_FILE, []);
    const index = accounts.findIndex((acc: any) => acc.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    accounts[index] = { ...accounts[index], ...account };
    
    if (writeJsonFile(ACCOUNTS_FILE, accounts)) {
      res.json({ success: true, account: accounts[index] });
    } else {
      res.status(500).json({ error: 'Failed to update account' });
    }
  } catch (error) {
    console.error('Failed to update account:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

app.delete('/api/accounts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const accounts = readJsonFile(ACCOUNTS_FILE, []);
    const filtered = accounts.filter((acc: any) => acc.id !== id);
    
    if (writeJsonFile(ACCOUNTS_FILE, filtered)) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to delete account' });
    }
  } catch (error) {
    console.error('Failed to delete account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Emails API
app.get('/api/emails', (req, res) => {
  try {
    const { accountId } = req.query;
    console.log('GET /api/emails - accountId:', accountId);
    const emails = readJsonFile(EMAILS_FILE, []);
    console.log('All emails in file:', emails.length);
    
    const filteredEmails = accountId 
      ? emails.filter((email: any) => email.accountId === accountId)
      : emails;
    
    console.log('Filtered emails for account:', filteredEmails.length);
    res.json({ emails: filteredEmails });
  } catch (error) {
    console.error('Failed to load emails:', error);
    res.status(500).json({ error: 'Failed to load emails' });
  }
});

app.post('/api/emails', (req, res) => {
  try {
    const { email } = req.body;
    const emails = readJsonFile(EMAILS_FILE, []);
    emails.push(email);
    
    if (writeJsonFile(EMAILS_FILE, emails)) {
      res.json({ success: true, email });
    } else {
      res.status(500).json({ error: 'Failed to save email' });
    }
  } catch (error) {
    console.error('Failed to create email:', error);
    res.status(500).json({ error: 'Failed to create email' });
  }
});

app.put('/api/emails/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const emails = readJsonFile(EMAILS_FILE, []);
    const index = emails.findIndex((e: any) => e.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    emails[index] = { ...emails[index], ...email };
    
    if (writeJsonFile(EMAILS_FILE, emails)) {
      res.json({ success: true, email: emails[index] });
    } else {
      res.status(500).json({ error: 'Failed to update email' });
    }
  } catch (error) {
    console.error('Failed to update email:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

app.delete('/api/emails/:id', (req, res) => {
  try {
    const { id } = req.params;
    const emails = readJsonFile(EMAILS_FILE, []);
    const filtered = emails.filter((email: any) => email.id !== id);
    
    if (writeJsonFile(EMAILS_FILE, filtered)) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to delete email' });
    }
  } catch (error) {
    console.error('Failed to delete email:', error);
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

// Replace emails for an account (used for IMAP sync)
app.post('/api/emails/replace/:accountId', (req, res) => {
  try {
    const { accountId } = req.params;
    const { emails: newEmails } = req.body;
    const emails = readJsonFile(EMAILS_FILE, []);
    
    // Remove existing emails for this account
    const filtered = emails.filter((email: any) => email.accountId !== accountId);
    
    // Add new emails
    const updated = [...filtered, ...newEmails];
    
    if (writeJsonFile(EMAILS_FILE, updated)) {
      res.json({ success: true, emails: newEmails });
    } else {
      res.status(500).json({ error: 'Failed to replace emails' });
    }
  } catch (error) {
    console.error('Failed to replace emails:', error);
    res.status(500).json({ error: 'Failed to replace emails' });
  }
});

// Settings API
app.get('/api/settings', (_req, res) => {
  try {
    const settings = readJsonFile(SETTINGS_FILE, {
      theme: 'dark',
      emailsPerPage: 50,
      autoRefresh: 5
    });
    res.json({ settings });
  } catch (error) {
    console.error('Failed to load settings:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const { settings } = req.body;
    
    if (writeJsonFile(SETTINGS_FILE, settings)) {
      res.json({ success: true, settings });
    } else {
      res.status(500).json({ error: 'Failed to save settings' });
    }
  } catch (error) {
    console.error('Failed to save settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Export/Import API
app.get('/api/export', (_req, res) => {
  try {
    const accounts = readJsonFile(ACCOUNTS_FILE, []);
    const settings = readJsonFile(SETTINGS_FILE, {});
    
    const exportData = {
      accounts,
      settings,
      timestamp: new Date().toISOString()
    };
    
    res.json(exportData);
  } catch (error) {
    console.error('Failed to export data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

app.post('/api/import', (req, res) => {
  try {
    const { accounts, settings } = req.body;
    
    let success = true;
    if (accounts) {
      success = success && writeJsonFile(ACCOUNTS_FILE, accounts);
    }
    if (settings) {
      success = success && writeJsonFile(SETTINGS_FILE, settings);
    }
    
    if (success) {
      res.json({ success: true, message: 'Data imported successfully' });
    } else {
      res.status(500).json({ error: 'Failed to import data' });
    }
  } catch (error) {
    console.error('Failed to import data:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

// Serve static files in production
if (!isDevelopment) {
  // Serve React app static files
  app.use(express.static(path.join(__dirname, '../../dist')));
  
  // Catch all handler: send back React's index.html file for client-side routing
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'));
  });
}

// Error handling middleware
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: isDevelopment ? error.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MailFlow server running on port ${PORT}`);
  console.log(`📧 IMAP API available at http://localhost:${PORT}/api`);
  
  if (isDevelopment) {
    console.log(`🔧 Development mode: Frontend at http://localhost:3000`);
  } else {
    console.log(`🌐 Production mode: Serving React app from /dist`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  ImapService.disconnectAll();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  ImapService.disconnectAll();
  process.exit(0);
});