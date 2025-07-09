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
import { configManager } from './config/ConfigManager';
import { databaseManager } from './database/DatabaseManager';

// Import route modules
import setupRoutes from './routes/setup';
import authRoutes from './routes/auth';
import imapRoutes from './routes/imap';
import smtpRoutes from './routes/smtp';
import healthRoutes from './routes/health';
import accountsRoutes from './routes/accounts';
import emailsRoutes from './routes/emails';
import settingsRoutes from './routes/settings';
import exportRoutes from './routes/export';
import cacheRoutes from './routes/cache';
import idleRoutes from './routes/idle';
// emailsV2Routes removed - now using smart routes as main emails routes

const app = express();
const PORT = process.env.PORT || 3001;
const isDevelopment = process.env.NODE_ENV !== 'production';

// Initialize configuration and database
async function initializeApp() {
  try {
    console.log('🚀 Initializing Mailflow server...');
    
    // Initialize configuration manager
    await configManager.initialize();
    
    // Initialize database
    await databaseManager.initialize();
    
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

// API Routes
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/imap', imapRoutes);
app.use('/api/smtp', smtpRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/emails', emailsRoutes); // Smart email API with EmailService
app.use('/api/settings', settingsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/idle', idleRoutes); // IMAP IDLE real-time connections
app.use('/api', exportRoutes); // Also mount at /api for backward compatibility with /api/import

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
    await databaseManager.close();
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));