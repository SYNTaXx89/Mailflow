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
 * Checks for PostgreSQL configuration in environment:
 * Option 1 - Connection URLs:
 * - DATABASE_URL (Railway/Render standard)
 * - POSTGRES_URL (alternative name)
 * 
 * Option 2 - Individual parameters:
 * - POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
 * 
 * If found, uses PostgreSQL. Otherwise, falls back to SQLite.
 */
export async function createDatabaseManager(configManager: ConfigManager): Promise<IDatabaseManager> {
  // Check for PostgreSQL connection - either full URL or individual components
  const postgresUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  // Check for individual PostgreSQL parameters
  const postgresHost = process.env.POSTGRES_HOST;
  const postgresPort = process.env.POSTGRES_PORT || '5432';
  const postgresDb = process.env.POSTGRES_DB;
  const postgresUser = process.env.POSTGRES_USER;
  const postgresPassword = process.env.POSTGRES_PASSWORD;
  
  let connectionString: string | null = null;
  
  if (postgresUrl) {
    // Use provided connection URL
    connectionString = postgresUrl;
    console.log('🐘 PostgreSQL connection URL detected, using PostgreSQL database');
    console.log(`📡 Connecting to: ${postgresUrl.replace(/\/\/[^@]+@/, '//***:***@')}`); // Hide credentials in logs
  } else if (postgresHost && postgresDb && postgresUser && postgresPassword) {
    // Build connection URL from individual parameters
    connectionString = `postgresql://${postgresUser}:${postgresPassword}@${postgresHost}:${postgresPort}/${postgresDb}`;
    console.log('🐘 PostgreSQL parameters detected, using PostgreSQL database');
    console.log(`📡 Connecting to: postgresql://***:***@${postgresHost}:${postgresPort}/${postgresDb}`); // Hide credentials in logs
  }
  
  if (connectionString) {
    const pgManager = new PostgreSQLDatabaseManager(configManager, connectionString);
    await pgManager.initialize();
    return pgManager;
  } else {
    console.log('📁 No PostgreSQL configuration found, using SQLite database');
    
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