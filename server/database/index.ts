/**
 * Database Factory - Creates appropriate database manager based on environment
 * 
 * Automatically detects PostgreSQL connection string and switches between
 * SQLite (local/fallback) and PostgreSQL (production) implementations.
 */

import { DatabaseManager } from './DatabaseManager';
import { PostgreSQLDatabaseManager } from './PostgreSQLDatabaseManager';
import { ConfigManager } from '../config/ConfigManager';
import { IDatabaseManager } from './IDatabaseManager';

/**
 * Create database manager based on environment variables
 * 
 * Checks for PostgreSQL connection string in environment:
 * - DATABASE_URL (Railway/Render standard)
 * - POSTGRES_URL (alternative name)
 * 
 * If found, uses PostgreSQL. Otherwise, falls back to SQLite.
 */
export async function createDatabaseManager(configManager: ConfigManager): Promise<IDatabaseManager> {
  // Check for PostgreSQL connection string
  const postgresUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (postgresUrl) {
    console.log('🐘 PostgreSQL connection string detected, using PostgreSQL database');
    console.log(`📡 Connecting to: ${postgresUrl.replace(/\/\/[^@]+@/, '//***:***@')}`); // Hide credentials in logs
    
    const pgManager = new PostgreSQLDatabaseManager(configManager, postgresUrl);
    await pgManager.initialize();
    return pgManager;
  } else {
    console.log('📁 No PostgreSQL connection string found, using SQLite database');
    
    const sqliteManager = new DatabaseManager(configManager);
    await sqliteManager.initialize();
    return sqliteManager;
  }
}

// Re-export all types for compatibility with existing imports
export type { User, Account, Email, AppSettings } from './IDatabaseManager';
export type { IDatabaseManager } from './IDatabaseManager';

// Re-export classes for type unions
export { DatabaseManager } from './DatabaseManager';
export { PostgreSQLDatabaseManager } from './PostgreSQLDatabaseManager';