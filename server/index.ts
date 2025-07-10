/**
 * Express Server for Mailflow
 * 
 * Serves the React frontend and provides IMAP API endpoints.
 * In production, serves static files from /dist
 * In development, proxies frontend requests to Vite dev server
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { ImapService } from '../src/imap';
import { ConfigManager } from './config/ConfigManager';
import { DatabaseManager } from './database/DatabaseManager';
import { TokenManager } from './auth/TokenManager';
import { AuthMiddleware } from './auth/AuthMiddleware';

// Import route modules
import { createSetupRouter } from './routes/setup';
import { createAuthRouter } from './routes/auth';
import { createImapRouter } from './routes/imap';
import { createSmtpRouter } from './routes/smtp';
import { createHealthRouter } from './routes/health';
import { createAccountsRouter } from './routes/accounts';
import { createEmailsRouter } from './routes/emails';
import { createSettingsRouter } from './routes/settings';
import { createExportRouter } from './routes/export';
import { createCacheRouter } from './routes/cache';
import { createIdleRouter } from './routes/idle';
import { EmailCacheService } from './cache/EmailCacheService';
// emailsV2Routes removed - now using smart routes as main emails routes

const app = express();
const PORT = process.env.PORT || 3001;
const isDevelopment = process.env.NODE_ENV !== 'production';

// Create instances
let configManager: ConfigManager;
let databaseManager: DatabaseManager;
let emailCacheService: EmailCacheService;

// Initialize configuration and database
async function initializeApp() {
  try {
    console.log('🚀 Initializing Mailflow server...');
    
    // Create and initialize configuration manager
    configManager = new ConfigManager();
    await configManager.initialize();
    
    // Create and initialize database
    databaseManager = new DatabaseManager(configManager);
    await databaseManager.initialize();
    
    // Create email cache service
    emailCacheService = new EmailCacheService(databaseManager);
    
    console.log('✅ Mailflow server initialization complete');
  } catch (error) {
    console.error('❌ Failed to initialize Mailflow server:', error);
    process.exit(1);
  }
}

// Middleware
app.use(express.json());
app.use(cors({
  origin: isDevelopment ? 'http://localhost:5173' : true, // Allow same-origin in production
  credentials: true
}));

// Request logging middleware for debugging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📡 ${timestamp} ${req.method} ${req.path}`);
  
  if (req.headers.authorization) {
    const token = req.headers.authorization.replace('Bearer ', '');
    console.log(`🔑 Auth header present: Bearer ${token.substring(0, 20)}...`);
  } else {
    console.log(`❌ No auth header on ${req.path}`);
  }
  
  if (req.body && Object.keys(req.body).length > 0) {
    const bodyLog = { ...req.body };
    if (bodyLog.password) bodyLog.password = '[REDACTED]';
    console.log(`📋 Request body:`, bodyLog);
  }
  
  next();
});

// Setup API routes function - must be called after initialization
function setupApiRoutes() {
  // Create shared instances
  const tokenManager = new TokenManager(configManager);
  const authMiddleware = new AuthMiddleware(tokenManager, databaseManager);
  
  // API Routes
  app.use('/api/setup', createSetupRouter(configManager, databaseManager, authMiddleware));
  app.use('/api/auth', createAuthRouter(databaseManager, tokenManager, authMiddleware));
  app.use('/api/imap', createImapRouter(authMiddleware, emailCacheService));
  app.use('/api/smtp', createSmtpRouter(authMiddleware));
  app.use('/api/cache', createCacheRouter(emailCacheService, authMiddleware));
  app.use('/api/health', createHealthRouter());
  app.use('/api/accounts', createAccountsRouter(databaseManager, authMiddleware));
  app.use('/api/emails', createEmailsRouter(databaseManager, emailCacheService, authMiddleware)); // Smart email API with EmailService
  app.use('/api/settings', createSettingsRouter(databaseManager, authMiddleware));
  app.use('/api/export', createExportRouter(databaseManager, authMiddleware));
  app.use('/api/idle', createIdleRouter(databaseManager, emailCacheService)); // IMAP IDLE real-time connections
  app.use('/api', createExportRouter(databaseManager, authMiddleware)); // Also mount at /api for backward compatibility with /api/import
}

// Serve static files in production
if (!isDevelopment) {
  // Serve React app static files
  app.use(express.static(path.join(__dirname, '../')));
  
  // Catch all handler: send back React's index.html file for client-side routing
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
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

// Start server after initialization
async function startServer() {
  await initializeApp();
  
  // Setup routes after instances are created
  setupApiRoutes();
  
  app.listen(PORT, () => {
    console.log(`🚀 Mailflow server running on port ${PORT}`);
    console.log(`📧 IMAP/SMTP API available at http://localhost:${PORT}/api`);
    
    // Check if setup is completed
    const setupCompleted = configManager.isSetupCompleted();
    if (!setupCompleted) {
      console.log(`🔧 Setup required: Visit http://localhost:${PORT} to complete initial setup`);
    }
    
    if (isDevelopment) {
      console.log(`🔧 Development mode: Frontend at http://localhost:5173`);
    } else {
      console.log(`🌐 Production mode: Serving React app from /dist`);
    }
  });
}

// Start the server
startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  try {
    ImapService.disconnectAll();
    if (databaseManager) {
      await databaseManager.close();
    }
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));